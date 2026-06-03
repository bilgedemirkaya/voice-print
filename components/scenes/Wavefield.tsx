"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useReducedMotion } from "framer-motion";
import * as THREE from "three";
import type { BloomEffect } from "postprocessing";
import { useAudioStore } from "@/lib/store/audioStore";
import { wavefieldUniforms } from "./wavefieldUniforms";

const SEG_X = 64;
const SEG_Y = 48;
const WIDTH = 8;
const DEPTH = 6;
const COLS = SEG_X + 1;
const VERTS = COLS * (SEG_Y + 1);

function pseudoNoise(x: number, y: number, t: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + t * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

/** The audio-reactive wireframe terrain. Reads AnimationParams from the store; place inside a <Canvas>. */
export function Wavefield() {
  const reduced = useReducedMotion() ?? false;
  const geomRef = useRef<THREE.PlaneGeometry>(null);
  const colorAttrRef = useRef<THREE.BufferAttribute | null>(null);
  const timeRef = useRef(0);

  const colors = useMemo(() => new Float32Array(VERTS * 3), []);
  const low = useMemo(() => new THREE.Color(), []);
  const mid = useMemo(() => new THREE.Color(), []);
  const high = useMemo(() => new THREE.Color(), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const geom = geomRef.current;
    if (!geom) return;
    const attribute = new THREE.BufferAttribute(colors, 3);
    geom.setAttribute("color", attribute);
    colorAttrRef.current = attribute;
    return () => {
      colorAttrRef.current = null;
    };
  }, [colors]);

  useFrame((_, delta) => {
    const geom = geomRef.current;
    if (!geom) return;

    const state = useAudioStore.getState();
    const params = state.voicePalette
      ? { ...state.params, palette: state.voicePalette }
      : state.params;
    const u = wavefieldUniforms(params, { reducedMotion: reduced });
    timeRef.current += delta * u.speed;
    const t = timeRef.current;

    low.set(u.palette[0]);
    mid.set(u.palette[1]);
    high.set(u.palette[2]);

    const position = geom.attributes.position;
    const colorAttr = colorAttrRef.current;
    const wave = params.waveform;
    const waveMax = Math.max(1, wave.length - 1);

    for (let i = 0; i < position.count; i++) {
      const ix = i % COLS;
      const iy = (i / COLS) | 0;
      const u0 = ix / SEG_X;
      const v0 = iy / SEG_Y;

      const sample = wave.length ? wave[Math.min(waveMax, (u0 * waveMax) | 0)] : 0;
      const ambient = (Math.sin(u0 * 6 + t * 0.6) + Math.cos(v0 * 7 - t * 0.5)) * 0.12;
      const ripple =
        Math.sin(u0 * 8 + t) * u.bass * 0.6 +
        Math.sin(v0 * 10 - t * 1.3) * u.mid * 0.5 +
        Math.sin((u0 + v0) * 16 + t * 2) * u.treble * 0.35;
      const glitch = u.jitter > 0 ? (pseudoNoise(ix, iy, (t * 8) | 0) - 0.5) * u.jitter * 0.6 : 0;

      const z = (ambient + sample * 0.8 + ripple + glitch) * u.amplitude;
      position.setZ(i, z);

      if (colorAttr) {
        const h = THREE.MathUtils.clamp(z / (u.amplitude * 1.6) + 0.5, 0, 1);
        if (h < 0.5) scratch.copy(low).lerp(mid, h * 2);
        else scratch.copy(mid).lerp(high, (h - 0.5) * 2);
        const c = i * 3;
        colors[c] = scratch.r;
        colors[c + 1] = scratch.g;
        colors[c + 2] = scratch.b;
      }
    }

    position.needsUpdate = true;
    if (colorAttr) colorAttr.needsUpdate = true;
  });

  return (
    <mesh rotation={[-Math.PI / 2.4, 0, 0]} position={[0, -0.5, 0]}>
      <planeGeometry ref={geomRef} args={[WIDTH, DEPTH, SEG_X, SEG_Y]} />
      <meshBasicMaterial vertexColors wireframe transparent opacity={0.95} />
    </mesh>
  );
}

/** Neon CRT glow: bloom whose intensity swells with the voice's energy (damped if reduced-motion). */
function ReactiveBloom({ reduced }: { reduced: boolean }) {
  const ref = useRef<BloomEffect | null>(null);
  useFrame(() => {
    if (!ref.current) return;
    const energy = useAudioStore.getState().params.energy;
    ref.current.intensity = reduced ? 0.7 : 0.45 + energy * 2.6;
  });
  return (
    <Bloom ref={ref} mipmapBlur luminanceThreshold={0.12} luminanceSmoothing={0.4} intensity={0.8} />
  );
}

/** Canvas wrapper. Loaded client-side only (WebGL) — import via next/dynamic with ssr:false. */
export function WavefieldCanvas() {
  const reduced = useReducedMotion() ?? false;
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 1.6, 5], fov: 50 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <color attach="background" args={["#140a28"]} />
      <Wavefield />
      <EffectComposer>
        <ReactiveBloom reduced={reduced} />
      </EffectComposer>
    </Canvas>
  );
}
