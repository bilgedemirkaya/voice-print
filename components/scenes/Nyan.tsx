"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { useAudioStore } from "@/lib/store/audioStore";
import { nyanStyle, type NyanStyle } from "./nyanStyle";

const W = 640;
const H = 360;
const CELL = 18; // marching-stripe size on the rainbow
const STAR_COUNT = 34;
// Classic Nyan rainbow, top → bottom.
const RAINBOW = ["#ff0f4b", "#ff8c00", "#ffe600", "#36e000", "#00a8ff", "#7a3cff"];
const BAND_H = 7;

type Star = { x: number; y: number; size: number; phase: number };

/** A twinkling 4-point pixel star. */
function drawStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color: string,
  alpha: number,
): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x - s, y - 1, s * 2, 2);
  ctx.fillRect(x - 1, y - s, 2, s * 2);
  ctx.globalAlpha = 1;
}

/** Original pixel-cat homage (no copied sprite): pop-tart body, gray head, wiggling legs + tail. */
function drawCat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  t: number,
  wiggle: number,
): void {
  const bodyW = 66;
  const bodyH = 44;
  const bx = cx - bodyW / 2;
  const by = cy - bodyH / 2;

  // Tail (back-left), wiggling.
  const tailY = cy + Math.sin(t * 2) * (3 + wiggle * 5);
  ctx.fillStyle = "#9a9a9a";
  ctx.fillRect(bx - 12, tailY - 3, 14, 6);

  // Legs, wiggling out of phase.
  ctx.fillStyle = "#8c8c8c";
  for (let i = 0; i < 4; i++) {
    const lx = bx + 8 + i * 14;
    const ly = by + bodyH - 4 + Math.sin(t * 2 + i * 1.5) * (2 + wiggle * 4);
    ctx.fillRect(lx, ly, 8, 10);
  }

  // Pop-tart body: pink frosting border + tan inner + sprinkles.
  ctx.fillStyle = "#ff9ed2";
  ctx.fillRect(bx, by, bodyW, bodyH);
  ctx.fillStyle = "#f3c98a";
  ctx.fillRect(bx + 4, by + 4, bodyW - 8, bodyH - 8);
  const sprinkles: Array<[number, number, string]> = [
    [14, 12, "#ff3b6b"],
    [30, 26, "#33d6ff"],
    [44, 14, "#ffe600"],
    [22, 32, "#7a3cff"],
    [50, 30, "#36e000"],
  ];
  for (const [dx, dy, c] of sprinkles) {
    ctx.fillStyle = c;
    ctx.fillRect(bx + dx, by + dy, 3, 3);
  }

  // Head (front-right): gray block with ears, eyes, cheeks, mouth.
  const hw = 30;
  const hh = 30;
  const hx = bx + bodyW - 8;
  const hy = cy - hh / 2;
  ctx.fillStyle = "#b9b9b9";
  ctx.fillRect(hx, hy, hw, hh);
  ctx.fillRect(hx + 3, hy - 6, 6, 8); // ear
  ctx.fillRect(hx + hw - 9, hy - 6, 6, 8); // ear
  ctx.fillStyle = "#000000"; // eyes
  ctx.fillRect(hx + 8, hy + 9, 4, 4);
  ctx.fillRect(hx + 18, hy + 9, 4, 4);
  ctx.fillStyle = "#ff7fa8"; // cheeks
  ctx.fillRect(hx + 4, hy + 16, 5, 4);
  ctx.fillRect(hx + 21, hy + 16, 5, 4);
  ctx.fillStyle = "#000000"; // tiny mouth
  ctx.fillRect(hx + 13, hy + 18, 4, 2);
}

/** NYAN — a pixel cat that bobs to your voice, trailing a marching rainbow (CLAUDE.md §5). */
export function Nyan() {
  const reduced = useReducedMotion() ?? false;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.imageSmoothingEnabled = false; // keep the pixels crisp

    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      size: 2 + Math.floor(Math.random() * 3),
      phase: Math.random() * Math.PI * 2,
    }));

    const catCenterX = 400;
    const trailEnd = catCenterX - 40; // rainbow runs from the left edge to the cat's tail
    let t = 0;
    let scrollOffset = 0;
    let raf = 0;

    const tick = (): void => {
      raf = requestAnimationFrame(tick);
      const s = useAudioStore.getState();
      const params = s.voicePalette ? { ...s.params, palette: s.voicePalette } : s.params;
      const style: NyanStyle = nyanStyle(params, { reducedMotion: reduced });

      t += 0.016 * style.bobSpeed;
      scrollOffset += style.scroll;
      const cy = H / 2 + Math.sin(t) * style.bob;

      // Space background.
      ctx.fillStyle = "#0a0618";
      ctx.fillRect(0, 0, W, H);

      // Twinkling stars marching left.
      for (const star of stars) {
        star.x -= style.scroll * 0.6;
        if (star.x < -4) {
          star.x = W + 4;
          star.y = Math.random() * H;
        }
        const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(t + star.phase));
        drawStar(ctx, star.x, star.y, star.size, style.starColor, twinkle);
      }

      // Rainbow trail (bobs with the cat), with marching darker squares for the scroll feel.
      const trailTop = cy - (RAINBOW.length * BAND_H) / 2;
      ctx.globalAlpha = style.trail;
      for (let b = 0; b < RAINBOW.length; b++) {
        const y = trailTop + b * BAND_H;
        ctx.fillStyle = RAINBOW[b];
        ctx.fillRect(0, y, trailEnd, BAND_H);
        ctx.fillStyle = "rgba(0,0,0,0.16)";
        for (let x = -(scrollOffset % (CELL * 2)); x < trailEnd; x += CELL * 2) {
          ctx.fillRect(x, y, CELL, BAND_H);
        }
      }
      ctx.globalAlpha = 1;

      drawCat(ctx, catCenterX, cy, t, style.wiggle);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  return <canvas ref={canvasRef} width={W} height={H} className="h-full w-full object-contain" />;
}
