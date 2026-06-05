import { clamp01 } from "@/lib/audio/features";
import type { AnimationParams } from "@/lib/audio/types";

/** Per-frame style for the Axolotl scene. Pure data — no canvas, no React. */
export type AxolotlStyle = {
  bob: number; // wave amplitude in px (energy) — how big the rainbow surf is
  bobSpeed: number; // how fast it bobs (treble)
  scroll: number; // px/frame the trail + stars march left (energy)
  trail: number; // 0..1 rainbow vividness (energy)
  wiggle: number; // gill + tail wobble (energy); 0 under reduced motion
  mouth: number; // 0..1 smile/mouth openness (energy) — the axolotl beams as you get louder
  starColor: string; // twinkle accent, from the voice palette
};

/**
 * Map AnimationParams → Axolotl style: the rainbow surfs bigger (and scrolls faster + brighter)
 * the louder you are; treble makes the bob jauntier; the star color follows the voice palette.
 */
export function axolotlStyle(
  params: AnimationParams,
  options: { reducedMotion?: boolean } = {},
): AxolotlStyle {
  const reduced = options.reducedMotion ?? false;
  const energy = clamp01(params.energy);
  const treble = clamp01(params.treble);
  return {
    bob: reduced ? 5 : 8 + energy * 64,
    bobSpeed: reduced ? 1.6 : 2.2 + treble * 4,
    scroll: reduced ? 1 : 2 + energy * 5,
    trail: reduced ? 0.45 : 0.4 + energy * 0.6,
    wiggle: reduced ? 0 : 0.3 + energy,
    mouth: clamp01(energy * 1.6),
    starColor: params.palette[0],
  };
}
