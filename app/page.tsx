"use client";

import { useEffect, useState } from "react";
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
import { cn } from "@/lib/cn";

export default function DesktopPage() {
  const [windowOpen, setWindowOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const activeScene = useAudioStore((s) => s.activeScene);
  const crtEnabled = useAudioStore((s) => s.crtEnabled);
  const reducedMotion = useReducedMotion();
  const loadVoices = useAudioStore((s) => s.loadVoices);
  const voicesStatus = useAudioStore((s) => s.voicesStatus);
  const [pendingOpen, setPendingOpen] = useState(false);

  // Prefetch voices once so the settings dialog can open instantly later.
  useEffect(() => {
    void loadVoices();
  }, [loadVoices]);

  // Open the settings dialog only once voices have settled — avoids an empty/loading flash.
  const openSettings = () => {
    if (voicesStatus === "ready" || voicesStatus === "error") {
      setDialogOpen(true);
    } else {
      setPendingOpen(true);
      void loadVoices();
    }
  };
  useEffect(() => {
    if (pendingOpen && (voicesStatus === "ready" || voicesStatus === "error")) {
      setDialogOpen(true);
      setPendingOpen(false);
    }
  }, [pendingOpen, voicesStatus]);

  return (
    <main className="desktop-bg relative min-h-screen overflow-hidden">
      <div className={maximized ? "absolute inset-2 bottom-12" : "absolute left-4 top-4"}>
        <AnimatePresence>
          {windowOpen && (
            <Window
              key="visualizer"
              title="VOICESCREEN.SCR — Visualizer"
              resizable={!maximized}
              fill={maximized}
              maximized={maximized}
              width={880}
              height={560}
              minWidth={420}
              minHeight={320}
              onMinimize={() => setWindowOpen(false)}
              onMaximize={() => setMaximized((m) => !m)}
              onClose={() => {
                setMaximized(false);
                setWindowOpen(false);
              }}
            >
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="relative min-h-0 flex-1 overflow-hidden bevel-inset bg-[#140a28]">
                  <SceneView scene={activeScene} />
                </div>
                <div className="flex shrink-0 items-end justify-between gap-2">
                  <Recorder onRecorded={openSettings} />
                  <Button onClick={openSettings} disabled={pendingOpen}>
                    {pendingOpen ? "Loading voices…" : "Display Properties…"}
                  </Button>
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
          className="fixed bottom-9 left-1 z-50 flex w-60 bevel-raised bg-w95-silver p-1"
        >
          <div className="mr-1 flex items-end justify-center bg-[linear-gradient(to_top,#9b51e0,#5cb8ff)] px-1.5 py-3">
            <span className="rotate-180 text-base font-bold tracking-wider text-white [writing-mode:vertical-rl]">
              VOICESCREEN<span className="opacity-70">.SCR</span>
            </span>
          </div>
          <ul className="flex-1 self-stretch py-1 text-sm">
            {[
              {
                label: "Open Visualizer",
                icon: "🖥",
                onClick: () => {
                  setWindowOpen(true);
                  setStartOpen(false);
                },
              },
              {
                label: "Display Properties…",
                icon: "🎨",
                onClick: () => {
                  openSettings();
                  setStartOpen(false);
                },
              },
            ].map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={item.onClick}
                  className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-w95-navy hover:text-white focus-visible:bg-w95-navy focus-visible:text-white focus-visible:outline-none"
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <TaskBar onStartClick={() => setStartOpen((open) => !open)}>
        <button
          type="button"
          onClick={() => setWindowOpen((open) => !open)}
          className={cn(
            "flex h-7 min-w-[170px] items-center gap-2 bg-w95-silver px-2 text-left text-sm",
            windowOpen ? "bevel-pressed" : "bevel-raised",
          )}
        >
          <span aria-hidden className="grid h-3.5 w-3.5 grid-cols-2 grid-rows-2 gap-px">
            <span className="bg-[#ff6fb5]" />
            <span className="bg-[#b06bff]" />
            <span className="bg-[#5fd0ff]" />
            <span className="bg-[#ffe066]" />
          </span>
          <span className="truncate">VOICESCREEN.SCR</span>
        </button>
      </TaskBar>

      <CrtOverlay enabled={crtEnabled && !reducedMotion} />
    </main>
  );
}
