import { clamp01 } from "@/lib/audio/features";
import type { AnimationParams } from "@/lib/audio/types";

/** Per-frame style for the Pipes scene. Pure data — no canvas, no React. */
export type PipesStyle = {
  growthRate: number; // segments per second (bass)
  thickness: number; // pipe width (mid)
  turnChance: number; // 0..1 chance to turn each segment (roughness)
  colors: [string, string, string];
};

/** Map AnimationParams → Pipes style (CLAUDE.md §5): growth rate by bass. */
export function pipesStyle(
  params: AnimationParams,
  options: { reducedMotion?: boolean } = {},
): PipesStyle {
  const reduced = options.reducedMotion ?? false;
  return {
    growthRate: reduced ? 4 : 6 + clamp01(params.bass) * 30,
    thickness: 4 + clamp01(params.mid) * 8,
    turnChance: 0.1 + clamp01(params.roughness) * 0.4,
    colors: params.palette,
  };
}
