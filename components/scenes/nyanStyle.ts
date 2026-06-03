import { clamp01 } from "@/lib/audio/features";
import type { AnimationParams } from "@/lib/audio/types";

/** Per-frame style for the Nyan scene. Pure data — no canvas, no React. */
export type NyanStyle = {
  bob: number; // vertical bob amplitude in px (energy)
  bobSpeed: number; // how fast it bobs (treble)
  scroll: number; // px/frame the trail + stars march left (energy)
  trail: number; // 0..1 rainbow vividness (energy)
  wiggle: number; // leg/tail wiggle (energy); 0 under reduced motion
  starColor: string; // twinkle accent, from the voice palette
};

/**
 * Map AnimationParams → Nyan style: the cat bobs more (and the rainbow scrolls faster + brighter)
 * the louder you are; treble makes the bob jauntier; the star color follows the voice palette.
 */
export function nyanStyle(
  params: AnimationParams,
  options: { reducedMotion?: boolean } = {},
): NyanStyle {
  const reduced = options.reducedMotion ?? false;
  const energy = clamp01(params.energy);
  const treble = clamp01(params.treble);
  return {
    bob: reduced ? 5 : 8 + energy * 64,
    bobSpeed: reduced ? 1.6 : 2.2 + treble * 4,
    scroll: reduced ? 1 : 2 + energy * 5,
    trail: reduced ? 0.45 : 0.4 + energy * 0.6,
    wiggle: reduced ? 0 : 0.3 + energy,
    starColor: params.palette[0],
  };
}
