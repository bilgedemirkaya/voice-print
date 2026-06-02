"use client";

import dynamic from "next/dynamic";
import type { SceneId } from "@/lib/store/audioStore";

const WavefieldCanvas = dynamic(
  () => import("./Wavefield").then((m) => m.WavefieldCanvas),
  { ssr: false, loading: () => <div className="h-full w-full bg-[#140a28]" /> },
);

export type SceneMeta = { id: SceneId; name: string; implemented: boolean };

/** Named "screensavers" shown in the Display Properties picker (CLAUDE.md §2, §5). */
export const SCENES: SceneMeta[] = [
  { id: "wavefield", name: "WAVEFIELD", implemented: true },
  { id: "mystify", name: "MYSTIFY", implemented: false },
  { id: "starfield", name: "STARFIELD", implemented: false },
  { id: "pipes", name: "PIPES", implemented: false },
];

/** Renders the active scene, or an honest placeholder for scenes not built yet (M7/M8). */
export function SceneView({ scene }: { scene: SceneId }) {
  if (scene === "wavefield") return <WavefieldCanvas />;
  const name = SCENES.find((s) => s.id === scene)?.name ?? scene;
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#140a28] text-xs text-w95-silver">
      {name} — coming in a later build
    </div>
  );
}
