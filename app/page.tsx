"use client";

import { useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/retro/Button";
import { Dialog } from "@/components/retro/Dialog";
import { TaskBar } from "@/components/retro/TaskBar";
import { Window } from "@/components/retro/Window";
import { CrtOverlay } from "@/components/retro/CrtOverlay";
import { Recorder } from "@/components/controls/Recorder";
import { FilterPicker } from "@/components/controls/FilterPicker";
import { SceneView } from "@/components/scenes/registry";
import { useAudioStore } from "@/lib/store/audioStore";

export default function DesktopPage() {
  const [windowOpen, setWindowOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const activeScene = useAudioStore((s) => s.activeScene);
  const crtEnabled = useAudioStore((s) => s.crtEnabled);
  const reducedMotion = useReducedMotion();

  return (
    <main className="desktop-bg relative min-h-screen overflow-hidden">
      <div className="absolute left-1/2 top-24 -translate-x-1/2">
        <AnimatePresence>
          {windowOpen && (
            <Window
              key="visualizer"
              title="VOICESCREEN.SCR — Visualizer"
              width={520}
              onMinimize={() => setWindowOpen(false)}
              onClose={() => setWindowOpen(false)}
            >
              <div className="flex flex-col gap-3">
                <div className="relative aspect-video overflow-hidden bevel-inset bg-[#140a28]">
                  <SceneView scene={activeScene} />
                </div>
                <div className="flex items-end justify-between gap-2">
                  <Recorder />
                  <Button onClick={() => setDialogOpen(true)}>Display Properties…</Button>
                </div>
              </div>
            </Window>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={dialogOpen} title="Display Properties" onClose={() => setDialogOpen(false)}>
        <FilterPicker onApplied={() => setDialogOpen(false)} />
      </Dialog>

      {startOpen && (
        <nav
          aria-label="Start menu"
          className="fixed bottom-9 left-1 z-50 w-48 bevel-raised bg-w95-silver p-1"
        >
          <ul className="text-sm">
            <li>
              <button
                type="button"
                className="w-full px-2 py-1 text-left hover:bg-w95-navy hover:text-white focus-visible:bg-w95-navy focus-visible:text-white focus-visible:outline-none"
                onClick={() => {
                  setWindowOpen(true);
                  setStartOpen(false);
                }}
              >
                Open Visualizer
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full px-2 py-1 text-left hover:bg-w95-navy hover:text-white focus-visible:bg-w95-navy focus-visible:text-white focus-visible:outline-none"
                onClick={() => {
                  setDialogOpen(true);
                  setStartOpen(false);
                }}
              >
                Display Properties…
              </button>
            </li>
          </ul>
        </nav>
      )}

      <TaskBar onStartClick={() => setStartOpen((open) => !open)} />

      <CrtOverlay enabled={crtEnabled && !reducedMotion} />
    </main>
  );
}
