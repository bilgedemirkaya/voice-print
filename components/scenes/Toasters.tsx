"use client";

import { useCanvas2DScene } from "./useCanvas2DScene";
import { toastersStyle } from "./toastersStyle";

const W = 640;
const H = 360;
const COUNT = 9;

type Flyer = { x: number; y: number; spd: number; phase: number; kind: "toaster" | "toast" };

function spawn(fromEdge: boolean): Flyer {
  // Classic After Dark drift: in from the upper-right, out the lower-left.
  return {
    x: fromEdge ? W + 20 + Math.random() * W * 0.5 : Math.random() * W,
    y: fromEdge ? -20 - Math.random() * H * 0.5 : Math.random() * H,
    spd: 0.7 + Math.random() * 0.6,
    phase: Math.random() * Math.PI * 2,
    kind: Math.random() < 0.7 ? "toaster" : "toast",
  };
}

/** A winged toaster, wings flapping by `wing` (-1..1). It flies left, so the wings sit on its left. */
function drawToaster(ctx: CanvasRenderingContext2D, x: number, y: number, wing: number, tint: string): void {
  const bw = 42;
  const bh = 28;
  const lift = wing * 10;

  ctx.fillStyle = "#f1f3f8"; // feathered wings
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 5);
  ctx.lineTo(x - 18, y - 6 + lift);
  ctx.lineTo(x - 2, y + 11);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 6, y + bh - 5);
  ctx.lineTo(x - 18, y + bh + 6 - lift);
  ctx.lineTo(x - 2, y + bh - 11);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#c3ccd6"; // chrome body
  ctx.fillRect(x, y, bw, bh);
  ctx.fillStyle = "#e6ebf0"; // top highlight
  ctx.fillRect(x, y, bw, 5);
  ctx.fillStyle = "#2b2f38"; // toast slot
  ctx.fillRect(x + 8, y + 7, bw - 16, 5);
  ctx.fillStyle = "#8a929c"; // lever
  ctx.fillRect(x + bw - 3, y + 11, 4, 8);
  ctx.fillStyle = "#9aa3ad"; // feet
  ctx.fillRect(x + 6, y + bh, 5, 3);
  ctx.fillRect(x + bw - 13, y + bh, 5, 3);
  ctx.strokeStyle = tint; // voice-palette edge
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, bw - 1.5, bh - 1.5);
}

/** A drifting slice of toast. */
function drawToast(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#e0a45f"; // crust
  ctx.fillRect(x, y, 24, 22);
  ctx.fillStyle = "#f4d6a3"; // bread
  ctx.fillRect(x + 3, y + 4, 18, 15);
  ctx.fillStyle = "#c8884a"; // toasty spots
  ctx.fillRect(x + 7, y + 9, 3, 3);
  ctx.fillRect(x + 13, y + 12, 3, 3);
}

/** TOASTERS — an After Dark homage: winged toasters + toast drift by, wings flapping to your voice. */
export function Toasters() {
  const canvasRef = useCanvas2DScene(
    (ctx, reduced) => {
      const flyers: Flyer[] = Array.from({ length: COUNT }, () => spawn(false));
      let t = 0;

      return (params) => {
        const style = toastersStyle(params, { reducedMotion: reduced });
        t += 0.016;

        ctx.fillStyle = "#05030f";
        ctx.fillRect(0, 0, W, H);

        for (const f of flyers) {
          f.x += -1.1 * style.speed * f.spd;
          f.y += 0.75 * style.speed * f.spd;
          if (f.x < -50 || f.y > H + 50) Object.assign(f, spawn(true));

          if (f.kind === "toaster") {
            const wing = Math.sin(t * style.flap + f.phase);
            drawToaster(ctx, f.x, f.y, wing, style.tint);
          } else {
            drawToast(ctx, f.x, f.y);
          }
        }
      };
    },
    { width: W, height: H, pixelated: true },
  );

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}
