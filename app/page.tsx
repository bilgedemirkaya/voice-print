"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, useReducedMotion } from "framer-motion";
import { Dialog } from "@/components/retro/Dialog";
import { CrtOverlay } from "@/components/retro/CrtOverlay";
import { BootSplash } from "@/components/retro/BootSplash";
import { FilterPicker } from "@/components/controls/FilterPicker";
import { VisualizerWindow } from "@/components/desktop/VisualizerWindow";
import { StartMenu } from "@/components/desktop/StartMenu";
import { DesktopTaskBar } from "@/components/desktop/DesktopTaskBar";
import { useAudioStore } from "@/lib/store/audioStore";
import { useVoices } from "@/lib/queries";
import { voicePaletteForLabels } from "@/lib/voicePalette";
import { useIsMobile } from "@/lib/useIsMobile";
import { sfx } from "@/lib/sfx";

export default function DesktopPage() {
  const [windowOpen, setWindowOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);

  const crtEnabled = useAudioStore((s) => s.crtEnabled);
  const setDraftVoice = useAudioStore((s) => s.setDraftVoice);
  const reducedMotion = useReducedMotion();
  // Subscribing here kicks off the voices fetch on mount and tracks when it has settled.
  const voicesQuery = useVoices();
  const voicesReady = voicesQuery.status !== "pending";
  const isMobile = useIsMobile();
  // Only a desktop maximize fills the whole desktop. Mobile is a large *centered* window (sized by
  // the wrapper below) so it uses the screen without being pinned edge-to-edge.
  const fullscreen = maximized;

  // Restore any saved access code / bring-your-own-key once on mount (voices fetch via useVoices).
  useEffect(() => {
    useAudioStore.getState().hydrateAccess();
  }, []);

  // Open the settings dialog only once voices have settled — avoids an empty/loading flash.
  const openSettings = () => {
    if (voicesReady) {
      sfx.open();
      setDialogOpen(true);
    } else {
      setPendingOpen(true);
    }
  };
  useEffect(() => {
    if (pendingOpen && voicesReady) {
      setDialogOpen(true);
      setPendingOpen(false);
    }
  }, [pendingOpen, voicesReady]);

  // "+ Add a voice" composes a *new* take: start a draft (defaulting to a not-yet-used voice) so
  // the dialog's scene/voice edits ride on the draft — never the selected "You"/voice take.
  const addVoice = () => {
    const voices = voicesQuery.data?.voices ?? [];
    if (voices.length > 0) {
      const used = new Set(useAudioStore.getState().conversions.map((c) => c.voiceId));
      const next = voices.find((v) => !used.has(v.id)) ?? voices[0];
      setDraftVoice(next.id, next.name, voicePaletteForLabels(next.labels));
    }
    openSettings();
  };

  return (
    <main className="desktop-bg relative h-[100dvh] overflow-hidden">
      <div
        className={
          fullscreen
            ? "absolute inset-2 bottom-12"
            : "absolute inset-0 bottom-12 flex items-center justify-center p-3 sm:p-4"
        }
      >
        <AnimatePresence>
          {windowOpen && (
            // On mobile the window fills a large *centered* box (so it's prominent but not pinned
            // edge-to-edge); on desktop it's the normal fixed/maximized window.
            <div
              key="visualizer"
              className={isMobile ? "h-[58dvh] max-h-[320px] w-full max-w-[460px]" : "contents"}
            >
              <VisualizerWindow
                maximized={maximized}
                fullscreen={fullscreen || isMobile}
                allowMaximize={!isMobile}
                pendingOpen={pendingOpen}
                onMinimize={() => setWindowOpen(false)}
                onMaximize={() => setMaximized((m) => !m)}
                onClose={() => {
                  setMaximized(false);
                  setWindowOpen(false);
                }}
                onOpenSettings={openSettings}
                onAddVoice={addVoice}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={dialogOpen} title="Display Properties" onClose={() => setDialogOpen(false)}>
        <FilterPicker onApplied={() => setDialogOpen(false)} />
      </Dialog>

      {startOpen && (
        <StartMenu
          onOpenVisualizer={() => {
            setWindowOpen(true);
            setStartOpen(false);
          }}
          onOpenSettings={() => {
            openSettings();
            setStartOpen(false);
          }}
        />
      )}

      <DesktopTaskBar
        windowOpen={windowOpen}
        onToggleWindow={() => setWindowOpen((open) => !open)}
        onStartClick={() => setStartOpen((open) => !open)}
      />

      <CrtOverlay enabled={crtEnabled && !reducedMotion} />
      <BootSplash />
    </main>
  );
}
