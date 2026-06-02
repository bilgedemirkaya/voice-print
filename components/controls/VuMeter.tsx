"use client";

import { useAudioStore } from "@/lib/store/audioStore";

const SEGMENTS = 16;

/** Retro segmented level meter driven by the live audio energy. */
export function VuMeter() {
  const energy = useAudioStore((s) => s.params.energy);
  const lit = Math.round(Math.min(1, Math.max(0, energy)) * SEGMENTS);

  return (
    <div aria-hidden className="bevel-inset flex items-center gap-0.5 bg-[#140a28] p-1">
      {Array.from({ length: SEGMENTS }, (_, i) => {
        const on = i < lit;
        const color = i < SEGMENTS * 0.6 ? "#3ddc84" : i < SEGMENTS * 0.85 ? "#ffe066" : "#ff5f6d";
        return (
          <span key={i} className="h-3 w-1" style={{ backgroundColor: on ? color : "#241640" }} />
        );
      })}
    </div>
  );
}
