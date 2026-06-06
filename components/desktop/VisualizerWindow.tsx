"use client";

import { useRef } from "react";
import { Button } from "@/components/retro/Button";
import { Window } from "@/components/retro/Window";
import { Recorder } from "@/components/controls/Recorder";
import { SceneViewport } from "./SceneViewport";
import { useIsMobile } from "@/lib/useIsMobile";

type VisualizerWindowProps = {
  maximized: boolean;
  /** Fill the parent (maximized or mobile): no drag/resize. */
  fullscreen: boolean;
  /** Whether the maximize control is offered (hidden on mobile, which is always maximized). */
  allowMaximize: boolean;
  /** Display Properties is still loading voices, so its button is disabled. */
  pendingOpen: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  onClose: () => void;
  onOpenSettings: () => void;
  onAddVoice: () => void;
};

/** The visualizer window: the reactive scene viewport above the recorder + Display Properties. */
export function VisualizerWindow({
  maximized,
  fullscreen,
  allowMaximize,
  pendingOpen,
  onMinimize,
  onMaximize,
  onClose,
  onOpenSettings,
  onAddVoice,
}: VisualizerWindowProps) {
  const isMobile = useIsMobile();
  const sceneRef = useRef<HTMLDivElement>(null);
  const getSceneCanvas = (): HTMLCanvasElement | null =>
    sceneRef.current?.querySelector("canvas") ?? null;

  return (
    <Window
      title="VOICEPRINT.SCR — Visualizer"
      resizable={!fullscreen && !isMobile}
      fill={fullscreen}
      maximized={maximized}
      width={isMobile ? 400 : 880}
      height={isMobile ? 280 : 560}
      minWidth={420}
      minHeight={isMobile ? 280 : 560}
      onMinimize={onMinimize}
      onMaximize={allowMaximize ? onMaximize : undefined}
      onClose={onClose}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <SceneViewport ref={sceneRef} />
        <div className="flex shrink-0 flex-wrap items-end justify-between gap-2">
          <Recorder
            onRecorded={onOpenSettings}
            onAddVoice={onAddVoice}
            getSceneCanvas={getSceneCanvas}
          />
          <Button onClick={onOpenSettings} disabled={pendingOpen}>
            {pendingOpen ? "Loading voices…" : "Display Properties…"}
          </Button>
        </div>
      </div>
    </Window>
  );
}
