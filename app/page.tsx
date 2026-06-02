"use client";

import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/retro/Button";
import { Dialog } from "@/components/retro/Dialog";
import { TaskBar } from "@/components/retro/TaskBar";
import { Window } from "@/components/retro/Window";

const SCREENSAVERS = ["MYSTIFY", "WAVEFIELD", "STARFIELD", "PIPES"] as const;

export default function DesktopPage() {
  const [windowOpen, setWindowOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);

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
                <div className="flex aspect-video items-center justify-center bevel-inset bg-[#1a1033] text-xs text-w95-silver">
                  audio-reactive canvas arrives in M3
                </div>
                <div className="flex justify-end">
                  <Button onClick={() => setDialogOpen(true)}>Display Properties…</Button>
                </div>
              </div>
            </Window>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={dialogOpen} title="Display Properties" onClose={() => setDialogOpen(false)}>
        <div className="flex flex-col gap-3">
          <p className="text-sm font-bold">Screen Saver</p>
          <div className="bevel-inset bg-white p-2 text-sm">
            <ul className="space-y-1">
              {SCREENSAVERS.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-w95-darkgray">Wired to voices &amp; scenes in M6.</p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setDialogOpen(false)}>OK</Button>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          </div>
        </div>
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
    </main>
  );
}
