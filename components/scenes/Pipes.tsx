"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { useAudioStore } from "@/lib/store/audioStore";
import { pipesStyle, type PipesStyle } from "./pipesStyle";

const W = 640;
const H = 360;
const CELL = 20;
const COLS = Math.floor(W / CELL);
const ROWS = Math.floor(H / CELL);
const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

type Head = { cx: number; cy: number; dir: number; color: number };

function randomHead(): Head {
  return {
    cx: Math.floor(Math.random() * COLS),
    cy: Math.floor(Math.random() * ROWS),
    dir: Math.floor(Math.random() * 4),
    color: Math.floor(Math.random() * 3),
  };
}

/** A growing 3D-pipes homage on a grid; growth rate driven by bass (CLAUDE.md §5). */
export function Pipes() {
  const reduced = useReducedMotion() ?? false;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    ctx.fillStyle = "#0a0618";
    ctx.fillRect(0, 0, W, H);
    ctx.lineCap = "round";

    let head = { ...randomHead(), cx: Math.floor(COLS / 2), cy: Math.floor(ROWS / 2) };
    let filled = 0;

    const step = (style: PipesStyle): void => {
      if (Math.random() < style.turnChance) head.dir = Math.floor(Math.random() * 4);
      const [dx, dy] = DIRS[head.dir];
      const nx = head.cx + dx;
      const ny = head.cy + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
        head.dir = Math.floor(Math.random() * 4);
        return;
      }

      ctx.strokeStyle = style.colors[head.color % style.colors.length];
      ctx.lineWidth = style.thickness;
      ctx.beginPath();
      ctx.moveTo(head.cx * CELL + CELL / 2, head.cy * CELL + CELL / 2);
      ctx.lineTo(nx * CELL + CELL / 2, ny * CELL + CELL / 2);
      ctx.stroke();

      head.cx = nx;
      head.cy = ny;
      filled += 1;

      if (filled > COLS * ROWS * 0.9) {
        ctx.fillStyle = "rgba(10,6,24,0.75)";
        ctx.fillRect(0, 0, W, H);
        filled = 0;
        head = { ...randomHead(), color: head.color + 1 };
      }
    };

    let acc = 0;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick);
      const style = pipesStyle(useAudioStore.getState().params, { reducedMotion: reduced });
      acc += ((now - last) / 1000) * style.growthRate;
      last = now;
      let budget = 0;
      while (acc >= 1 && budget < 40) {
        step(style);
        acc -= 1;
        budget += 1;
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return <canvas ref={canvasRef} width={W} height={H} className="h-full w-full" />;
}
