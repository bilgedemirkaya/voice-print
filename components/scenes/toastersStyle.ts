import { clamp01 } from "@/lib/audio/features";
import type { AnimationParams } from "@/lib/audio/types";

/** Per-frame style for the Flying Toasters scene. Pure data — no canvas, no React. */
export type ToastersStyle = {
  speed: number; // drift speed across the screen (energy)
  flap: number; // wing flap rate (treble)
  tint: string; // edge/accent color from the voice palette
};

/**
 * Map AnimationParams → Flying Toasters style: they drift faster the louder you are, flap their
 * wings quicker with treble, and pick up an edge tint from the voice palette.
 */
export function toastersStyle(
  params: AnimationParams,
  options: { reducedMotion?: boolean } = {},
): ToastersStyle {
  const reduced = options.reducedMotion ?? false;
  const energy = clamp01(params.energy);
  const treble = clamp01(params.treble);
  return {
    speed: reduced ? 0.6 : 0.8 + energy * 3.4,
    flap: reduced ? 2 : 3 + treble * 7,
    tint: params.palette[1],
  };
}
