"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { useAudioStore } from "@/lib/store/audioStore";
import { starfieldStyle } from "./starfieldStyle";

const W = 640;
const H = 360;
const COUNT = 180;

type Star = { x: number; y: number; z: number; pz: number };

function spawnStar(): Star {
  const z = Math.random() * W + 1;
  return { x: (Math.random() * 2 - 1) * W, y: (Math.random() * 2 - 1) * H, z, pz: z };
}

/** Warp-speed star streaks flying toward the viewer (CLAUDE.md §5). */
export function Starfield() {
  const reduced = useReducedMotion() ?? false;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const cx = W / 2;
    const cy = H / 2;
    const stars: Star[] = Array.from({ length: COUNT }, spawnStar);

    ctx.fillStyle = "#05030f";
    ctx.fillRect(0, 0, W, H);

    let raf = 0;
    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      const state = useAudioStore.getState();
      const params = state.voicePalette
        ? { ...state.params, palette: state.voicePalette }
        : state.params;
      const style = starfieldStyle(params, { reducedMotion: reduced });

      // Slight fade leaves short trails behind the streaks.
      ctx.fillStyle = "rgba(5,3,15,0.4)";
      ctx.fillRect(0, 0, W, H);

      for (const s of stars) {
        s.pz = s.z;
        s.z -= style.speed * 2;
        if (s.z < 1) {
          Object.assign(s, spawnStar(), { z: W, pz: W });
          continue;
        }
        const sx = cx + (s.x / s.z) * W * style.streak;
        const sy = cy + (s.y / s.z) * H * style.streak;
        const px = cx + (s.x / s.pz) * W * style.streak;
        const py = cy + (s.y / s.pz) * H * style.streak;
        if (sx < 0 || sx > W || sy < 0 || sy > H) continue;

        const depth = 1 - s.z / W; // 0 far … 1 near
        ctx.strokeStyle = style.colors[Math.min(2, Math.floor(depth * 3))];
        ctx.lineWidth = 0.5 + depth * 2;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        ctx.stroke();
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return <canvas ref={canvasRef} width={W} height={H} className="h-full w-full object-contain" />;
}
