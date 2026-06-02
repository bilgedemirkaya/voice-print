"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/retro/Button";
import { ParamsReadout } from "@/components/controls/ParamsReadout";
import { Recorder } from "@/components/controls/Recorder";
import { Window } from "@/components/retro/Window";
import { paletteFromBrightness, silentParams } from "@/lib/audio/params";
import { useAudioStore } from "@/lib/store/audioStore";

/**
 * Debug surface (M2): record from the mic and watch AnimationParams react, or push a synthetic
 * "demo signal" to see the readout move without a microphone.
 */
export default function DebugPage() {
  const setParams = useAudioStore((s) => s.setParams);
  const [demo, setDemo] = useState(false);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!demo) {
      setParams(silentParams());
      return;
    }
    let t = 0;
    const loop = (): void => {
      t += 0.03;
      const energy = (Math.sin(t) + 1) / 2;
      const brightness = (Math.sin(t * 0.7) + 1) / 2;
      const waveform = new Float32Array(128);
      for (let i = 0; i < waveform.length; i++) {
        waveform[i] = Math.sin(t * 4 + i * 0.2) * energy;
      }
      setParams({
        energy,
        bass: (Math.sin(t * 1.3) + 1) / 2,
        mid: (Math.sin(t * 1.7 + 1) + 1) / 2,
        treble: (Math.sin(t * 2.3 + 2) + 1) / 2,
        brightness,
        roughness: (Math.sin(t * 0.9) + 1) / 2,
        palette: paletteFromBrightness(brightness, energy),
        waveform,
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [demo, setParams]);

  return (
    <main className="desktop-bg min-h-screen p-6">
      <div className="mx-auto max-w-xl">
        <Window title="AnimationParams — Debug">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Recorder />
              <Button onClick={() => setDemo((value) => !value)}>
                {demo ? "Stop demo" : "Demo signal"}
              </Button>
            </div>
            <ParamsReadout />
          </div>
        </Window>
      </div>
    </main>
  );
}
