import { clamp01 } from "@/lib/audio/features";
import type { AnimationParams } from "@/lib/audio/types";

/** Per-frame drawing style for the Mystify scene. Pure data — no canvas, no React. */
export type MystifyStyle = {
  speed: number; // vertex velocity multiplier
  jitter: number; // random velocity nudge from roughness
  lineWidth: number; // stroke width (bass)
  trailFade: number; // 0..1 alpha used to fade prior frames; lower = longer afterimage trails
  colors: [string, string, string];
};

/**
 * Map AnimationParams → Mystify style (CLAUDE.md §5). Pure/deterministic for unit testing.
 * Under reduced motion, vertices move slower, jitter less, and trails fade faster (less smear).
 */
export function mystifyStyle(
  params: AnimationParams,
  options: { reducedMotion?: boolean } = {},
): MystifyStyle {
  const reduced = options.reducedMotion ?? false;
  const energy = clamp01(params.energy);
  return {
    speed: reduced ? 0.35 : 0.5 + energy * 1.8,
    jitter: clamp01(params.roughness) * (reduced ? 0.2 : 1),
    lineWidth: 1.2 + clamp01(params.bass) * 2.5,
    trailFade: reduced ? 0.3 : 0.05 + (1 - energy) * 0.08,
    colors: params.palette,
  };
}
