"use client";

import { useAudioStore } from "@/lib/store/audioStore";
import type { AnimationParams } from "@/lib/audio/types";

const BAR_FIELDS = ["energy", "bass", "mid", "treble", "brightness", "roughness"] as const;

/** Live, labeled readout of the current AnimationParams — used to prove the analysis works (M2). */
export function ParamsReadout() {
  const params = useAudioStore((s) => s.params);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        {BAR_FIELDS.map((field) => (
          <Bar key={field} label={field} value={params[field]} />
        ))}
      </div>
      <Palette palette={params.palette} />
      <Waveform waveform={params.waveform} />
    </div>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20">{label}</span>
      <div className="bevel-inset relative h-4 flex-1 bg-white">
        <div
          className="h-full bg-w95-navy"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="w-10 text-right tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

function Palette({ palette }: { palette: AnimationParams["palette"] }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20">palette</span>
      <div className="flex flex-1 gap-1">
        {palette.map((color, i) => (
          <div
            key={i}
            className="bevel-inset h-6 flex-1"
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}

function Waveform({ waveform }: { waveform: Float32Array }) {
  const width = 320;
  const height = 64;
  const points = Array.from(waveform, (value, i) => {
    const x = (i / Math.max(1, waveform.length - 1)) * width;
    const y = height / 2 - value * (height / 2) * 0.9;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return (
    <div className="bevel-inset bg-[#1a1033] p-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="block h-16 w-full"
      >
        <polyline points={points} fill="none" stroke="#7ee8fa" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
