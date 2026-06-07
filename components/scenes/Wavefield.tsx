"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import { WAVEFORM_SIZE } from "@/lib/audio/params";
import { selectVisualParams, useAudioStore } from "@/lib/store/audioStore";
import { wavefieldUniforms } from "./wavefieldUniforms";

const SEG_X = 64;
const SEG_Y = 48;
const WIDTH = 8;
const DEPTH = 6;

// Locked *horizontal* field of view. three.js holds the vertical FOV constant by default, so the
// terrain's front edge spills past the left/right window edges as the canvas narrows. Locking the
// horizontal FOV instead keeps the terrain framed identically — fully inside the window — at any
// aspect ratio (desktop, resized, or mobile).
const HFOV_DEG = 64;

/**
 * Vertex shader: displaces the plane along its normal each frame. This is the work that used to run
 * as a ~3k-iteration JS loop on the CPU every frame — moving it onto the GPU means the main thread
 * only sets a handful of uniforms. The `wavefieldUniforms()` pure function (unit-tested) supplies
 * those uniform values, so the name finally means what it says.
 *
 * The displacement terms (ambient swell + waveform sample + per-band ripples + glitch) mirror the
 * previous CPU formula exactly, so the look is preserved. `vHeight` carries the normalized crest
 * height to the fragment shader for the palette ramp.
 */
const VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uAmplitude;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uJitter;
  uniform sampler2D uWave;

  varying float vHeight;

  // Hash noise mirroring the CPU pseudoNoise() the scene used before the shader port.
  float pseudoNoise(float x, float y, float t) {
    return fract(sin(x * 12.9898 + y * 78.233 + t * 37.719) * 43758.5453);
  }

  void main() {
    float t = uTime;
    float u0 = uv.x;
    float v0 = uv.y;

    float sampleWave = texture2D(uWave, vec2(u0, 0.5)).r;
    float ambient = (sin(u0 * 6.0 + t * 0.6) + cos(v0 * 7.0 - t * 0.5)) * 0.12;
    float ripple =
      sin(u0 * 8.0 + t) * uBass * 0.6 +
      sin(v0 * 10.0 - t * 1.3) * uMid * 0.5 +
      sin((u0 + v0) * 16.0 + t * 2.0) * uTreble * 0.35;
    float glitch = uJitter > 0.0
      ? (pseudoNoise(floor(u0 * ${SEG_X}.0), floor(v0 * ${SEG_Y}.0), floor(t * 8.0)) - 0.5) * uJitter * 0.6
      : 0.0;

    float z = (ambient + sampleWave * 0.8 + ripple + glitch) * uAmplitude;

    // Normalized crest height for the palette ramp (uAmplitude is always >= ~0.06, so the divide
    // is safe; max() guards the degenerate case defensively).
    vHeight = clamp(z / max(uAmplitude * 1.6, 1e-4) + 0.5, 0.0, 1.0);

    vec3 displaced = position + normal * z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

/**
 * Fragment shader: the low→mid→high palette ramp by crest height, then a lerp toward white as a
 * cheap neon "bloom" that brightens with energy. Additive blending on the wireframe does the rest.
 */
const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColorLow;
  uniform vec3 uColorMid;
  uniform vec3 uColorHigh;
  uniform float uGlow;

  varying float vHeight;

  void main() {
    vec3 col = vHeight < 0.5
      ? mix(uColorLow, uColorMid, vHeight * 2.0)
      : mix(uColorMid, uColorHigh, (vHeight - 0.5) * 2.0);
    col = mix(col, vec3(1.0), uGlow * vHeight);
    gl_FragColor = vec4(col, 0.92);
  }
`;

/** Keeps the terrain framed the same width regardless of the canvas aspect ratio. */
function ResponsiveCamera() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const aspect = size.width / Math.max(1, size.height);
    const hfov = (HFOV_DEG * Math.PI) / 180;
    camera.fov = (2 * Math.atan(Math.tan(hfov / 2) / aspect) * 180) / Math.PI;
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

/** The audio-reactive wireframe terrain. Reads AnimationParams from the store; place inside a <Canvas>. */
export function Wavefield() {
  const reduced = useReducedMotion() ?? false;
  const timeRef = useRef(0);
  // We drive the material's uniforms each frame. r3f doesn't preserve the identity of the `uniforms`
  // prop object, so mutate the ones the renderer actually reads — via a ref to the material itself.
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // One uniforms object + one wave texture for the material's lifetime; we only mutate `.value`s and
  // the texture data per frame, so nothing is allocated in the render loop.
  const { uniforms, waveTexture, waveData } = useMemo(() => {
    const waveData = new Float32Array(WAVEFORM_SIZE);
    const waveTexture = new THREE.DataTexture(
      waveData,
      WAVEFORM_SIZE,
      1,
      THREE.RedFormat,
      THREE.FloatType,
    );
    // Nearest sampling matches the old CPU nearest-pick and avoids the float-linear-filter extension.
    waveTexture.minFilter = THREE.NearestFilter;
    waveTexture.magFilter = THREE.NearestFilter;
    waveTexture.needsUpdate = true;

    const uniforms = {
      uTime: { value: 0 },
      uAmplitude: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uJitter: { value: 0 },
      uGlow: { value: 0 },
      uColorLow: { value: new THREE.Color() },
      uColorMid: { value: new THREE.Color() },
      uColorHigh: { value: new THREE.Color() },
      uWave: { value: waveTexture },
    };
    return { uniforms, waveTexture, waveData };
  }, []);

  // The DataTexture isn't attached to the scene graph, so r3f won't auto-dispose it — own its teardown.
  useEffect(() => () => waveTexture.dispose(), [waveTexture]);

  useFrame((_, delta) => {
    const mat = materialRef.current;
    if (!mat) return;
    const live = mat.uniforms;

    const params = selectVisualParams(useAudioStore.getState());
    const u = wavefieldUniforms(params, { reducedMotion: reduced });

    timeRef.current += delta * u.speed;
    live.uTime.value = timeRef.current;
    live.uAmplitude.value = u.amplitude;
    live.uBass.value = u.bass;
    live.uMid.value = u.mid;
    live.uTreble.value = u.treble;
    live.uJitter.value = u.jitter;
    // Neon glow: with additive blending, brighter crests bloom harder the louder you are.
    live.uGlow.value = reduced ? 0 : Math.min(0.7, params.energy * 0.55);
    live.uColorLow.value.set(u.palette[0]);
    live.uColorMid.value.set(u.palette[1]);
    live.uColorHigh.value.set(u.palette[2]);

    const wave = params.waveform;
    const n = Math.min(waveData.length, wave.length);
    for (let i = 0; i < n; i++) waveData[i] = wave[i];
    waveTexture.needsUpdate = true;
  });

  return (
    <mesh rotation={[-Math.PI / 2.4, 0, 0]} position={[0, -0.5, 0]}>
      <planeGeometry args={[WIDTH, DEPTH, SEG_X, SEG_Y]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        wireframe
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Canvas wrapper. Loaded client-side only (WebGL) — import via next/dynamic with ssr:false. */
export function WavefieldCanvas() {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 2.1, 6], fov: 50 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={["#140a28"]} />
      <ResponsiveCamera />
      <Wavefield />
    </Canvas>
  );
}
