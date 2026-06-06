"use client";

import { forwardRef } from "react";
import { SceneView } from "@/components/scenes/registry";
import { useIsTransforming } from "@/components/controls/useTransform";
import { selectActiveScene, useAudioStore } from "@/lib/store/audioStore";
import { cn } from "@/lib/cn";

/**
 * The visualizer canvas with its live status badges: which clip is playing, a "converting voice"
 * overlay during a transform, and a "REC" badge while an export clip is being recorded. The
 * forwarded ref points at the canvas container so the parent can grab the <canvas> for export.
 */
export const SceneViewport = forwardRef<HTMLDivElement, { className?: string }>(
  function SceneViewport({ className }, ref) {
  const activeScene = useAudioStore(selectActiveScene);
  const playingLabel = useAudioStore((s) => s.playingLabel);
  const exporting = useAudioStore((s) => s.exporting);
  const transforming = useIsTransforming();

  return (
    <div
      ref={ref}
      className={cn(
        "relative overflow-hidden bevel-inset bg-[#072a45]",
        className ?? "min-h-0 flex-1",
      )}
    >
      <SceneView scene={activeScene} />
      {playingLabel && (
        <div className="pointer-events-none absolute left-2 top-2 flex items-center gap-1.5 bg-black/55 px-2 py-1 text-[11px] font-bold text-white">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-[#5fd0ff] motion-safe:animate-pulse"
          />
          {playingLabel}
        </div>
      )}
      {transforming && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0a0618]/75 text-white">
          <p className="text-xs font-bold tracking-[0.3em]">CONVERTING VOICE…</p>
          <div className="bevel-inset flex gap-0.5 bg-[#140a28] p-1">
            {Array.from({ length: 12 }, (_, i) => (
              <span
                key={i}
                className="h-2.5 w-2.5 bg-[#5cb8ff] motion-safe:animate-pulse"
                style={{ animationDelay: `${i * 0.08}s` }}
              />
            ))}
          </div>
        </div>
      )}
      {exporting && (
        <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1.5 bg-black/55 px-2 py-1 text-[11px] font-bold text-white">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-[#e53935] motion-safe:animate-pulse"
          />
          REC
        </div>
      )}
    </div>
  );
});
