"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { fitCanvasCover } from "@/lib/canvasCover";
import { selectVisualParams, useAudioStore } from "@/lib/store/audioStore";
import type { AnimationParams } from "@/lib/audio/types";

/** Paint one frame into the (already fitted) context using the live params. */
export type SceneDraw = (params: AnimationParams) => void;

/**
 * Runs once per mount (and when reduced-motion flips): seed persistent state and capture the
 * context, then return the per-frame {@link SceneDraw}. Capturing `reducedMotion` here lets the
 * returned closure pass it to its pure `*Style` function.
 */
export type SceneSetup = (ctx: CanvasRenderingContext2D, reducedMotion: boolean) => SceneDraw;

export type Canvas2DSceneOptions = {
  /** Reference scene size; the canvas is cover-fitted to this each frame (fills the box, crops overflow). */
  width: number;
  height: number;
  /** Keep pixels crisp — re-asserted every frame, since resizing the canvas resets the context. */
  pixelated?: boolean;
  /** Which part survives the cover-crop when aspect ratios differ (0..1). Defaults to centered. */
  anchorX?: number;
  anchorY?: number;
};

/**
 * Shared lifecycle for the 2D-canvas scenes (Mystify, Starfield, Axolotl, Toasters): owns the canvas
 * ref, the rAF loop, cover-fitting, reduced-motion, and teardown. A scene supplies a `setup` that
 * returns its `draw(params)`; the hook feeds it the live params with the voice palette applied.
 */
export function useCanvas2DScene(
  setup: SceneSetup,
  { width, height, pixelated = false, anchorX = 0.5, anchorY = 0.5 }: Canvas2DSceneOptions,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion() ?? false;
  // Hold the latest setup without making it an effect dep — inline closures change identity.
  const setupRef = useRef(setup);
  setupRef.current = setup;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const draw = setupRef.current(ctx, reduced);
    let raf = 0;
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      // Cover-fit so the scene fills every pixel (no letterbox strips that show through as bars)…
      fitCanvasCover(canvas, ctx, width, height, anchorX, anchorY);
      if (pixelated) ctx.imageSmoothingEnabled = false; // …so re-assert crisp pixels each frame
      draw(selectVisualParams(useAudioStore.getState()));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, width, height, pixelated, anchorX, anchorY]);

  return canvasRef;
}
