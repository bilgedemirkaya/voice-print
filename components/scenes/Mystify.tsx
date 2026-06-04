"use client";

import { useCanvas2DScene } from "./useCanvas2DScene";
import { mystifyStyle } from "./mystifyStyle";

const W = 640;
const H = 360;
const SHAPES = 2;
const VERTS = 5;

type Vertex = { x: number; y: number; vx: number; vy: number };

/** Classic Mystify homage: bouncing polylines with afterimage trails, reacting to the voice. */
export function Mystify() {
  const canvasRef = useCanvas2DScene(
    (ctx, reduced) => {
      const shapes: Vertex[][] = Array.from({ length: SHAPES }, () =>
        Array.from({ length: VERTS }, () => ({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() * 2 - 1) * 2,
          vy: (Math.random() * 2 - 1) * 2,
        })),
      );
      ctx.fillStyle = "#140a28";
      ctx.fillRect(0, 0, W, H);

      return (params) => {
        const style = mystifyStyle(params, { reducedMotion: reduced });

        // Fade the previous frame instead of clearing → afterimage trails.
        ctx.fillStyle = `rgba(20,10,40,${style.trailFade})`;
        ctx.fillRect(0, 0, W, H);

        shapes.forEach((verts, i) => {
          for (const v of verts) {
            v.vx += (Math.random() * 2 - 1) * style.jitter * 0.6;
            v.vy += (Math.random() * 2 - 1) * style.jitter * 0.6;
            v.vx = Math.max(-3, Math.min(3, v.vx));
            v.vy = Math.max(-3, Math.min(3, v.vy));
            v.x += v.vx * style.speed;
            v.y += v.vy * style.speed;
            if (v.x < 0 || v.x > W) {
              v.vx *= -1;
              v.x = Math.max(0, Math.min(W, v.x));
            }
            if (v.y < 0 || v.y > H) {
              v.vy *= -1;
              v.y = Math.max(0, Math.min(H, v.y));
            }
          }

          ctx.beginPath();
          ctx.moveTo(verts[0].x, verts[0].y);
          for (let k = 1; k < verts.length; k++) ctx.lineTo(verts[k].x, verts[k].y);
          ctx.closePath();
          ctx.strokeStyle = style.colors[i % style.colors.length];
          ctx.lineWidth = style.lineWidth;
          ctx.stroke();
        });
      };
    },
    { width: W, height: H },
  );

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}
