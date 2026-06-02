import { clamp01 } from "@/lib/audio/features";
import type { AnimationParams } from "@/lib/audio/types";

/** Per-frame style for the Starfield scene. Pure data — no canvas, no React. */
export type StarfieldStyle = {
  speed: number; // warp speed (energy)
  streak: number; // streak length factor (energy)
  bass: number;
  mid: number;
  treble: number;
  colors: [string, string, string];
};

/** Map AnimationParams → Starfield style (CLAUDE.md §5): speed by energy, color by band split. */
export function starfieldStyle(
  params: AnimationParams,
  options: { reducedMotion?: boolean } = {},
): StarfieldStyle {
  const reduced = options.reducedMotion ?? false;
  const energy = clamp01(params.energy);
  return {
    speed: reduced ? 0.3 : 0.6 + energy * 3,
    streak: reduced ? 0.3 : 0.4 + energy * 1.6,
    bass: clamp01(params.bass),
    mid: clamp01(params.mid),
    treble: clamp01(params.treble),
    colors: params.palette,
  };
}
