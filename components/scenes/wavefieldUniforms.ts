import { clamp01 } from "@/lib/audio/features";
import type { AnimationParams } from "@/lib/audio/types";

/** Scalar drivers the Wavefield scene consumes each frame. Pure data — no three.js, no React. */
export type WavefieldUniforms = {
  amplitude: number; // vertical displacement scale (energy + a baseline so idle stays alive)
  speed: number; // scroll speed; 0 under reduced motion
  jitter: number; // glitch amount from roughness
  bass: number;
  mid: number;
  treble: number;
  brightness: number;
  palette: [string, string, string];
};

export type WavefieldOptions = { reducedMotion?: boolean };

/**
 * Map AnimationParams → Wavefield uniforms (CLAUDE.md §5). Pure and deterministic so it can be
 * unit-tested without a browser. Under reduced motion, scrolling stops and amplitude/jitter damp.
 */
export function wavefieldUniforms(
  params: AnimationParams,
  options: WavefieldOptions = {},
): WavefieldUniforms {
  const reduced = options.reducedMotion ?? false;
  const energy = clamp01(params.energy);
  return {
    amplitude: clamp01(0.15 + energy * 0.85) * (reduced ? 0.4 : 1),
    speed: reduced ? 0 : 0.2 + energy * 1.8,
    jitter: clamp01(params.roughness) * (reduced ? 0.25 : 1),
    bass: clamp01(params.bass),
    mid: clamp01(params.mid),
    treble: clamp01(params.treble),
    brightness: clamp01(params.brightness),
    palette: params.palette,
  };
}
