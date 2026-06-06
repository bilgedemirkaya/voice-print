"use client";

import { useCanvas2DScene } from "./useCanvas2DScene";
import { axolotlStyle, type AxolotlStyle } from "./axolotlStyle";

const W = 640;
const H = 360;
const CELL = 18; // marching-stripe size on the rainbow
const STRIPE_W = 6; // width of each vertical slice of the wavy ribbon
const BUBBLE_COUNT = 22;
// Rainbow trail, top → bottom.
const RAINBOW = ["#ff0f4b", "#ff8c00", "#ffe600", "#36e000", "#00a8ff", "#7a3cff"];
const BAND_H = 7;
// Extra reference-px to draw the rainbow just past the right edge so it flows off screen rather
// than ending in a hard vertical terminus (the canvas clips the overflow).
const RAINBOW_OVERSCAN = 80;

// Flat pixel palette (no gradients/gloss — 2008-retro, but two-tone for a bit of depth).
const PINK = "#f7a3d0";
const PINK_LT = "#ffc8e6";
const PINK_SH = "#df80b6";
const BELLY = "#ffd6ec";
const GILL = "#ff5f9e";
const GILL_SH = "#e8488a";
const EYE = "#3a2a4d";
const CHEEK = "#ff7eb0";
const MOUTH = "#7a2a4a";
const TONGUE = "#ff9ec6";
const LILAC = "#b9a0ff";

const U = 3; // pixel size — fine grid for crisp, higher-detail sprite art
const AXO_X = 150;
const AXO_SCALE = 1;
const MOUTH_SY = 4; // smile row on the sprite grid (shared with drawAxolotl so the wave starts *at* the mouth)

/** Half-width of the open smile, in grid cells, for a given 0..1 openness — shared so the wave's
 *  emission point tracks the exact right corner of the mouth as it grins wider. */
function grinCells(mouth: number): number {
  return 3 + Math.round(mouth * 2);
}

type Bubble = { x: number; y: number; r: number; speed: number; phase: number };

/** A rising underwater bubble, drawn as a little pixel square. */
function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  const s = Math.max(2, Math.round(r));
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#bfe9ff";
  ctx.fillRect(Math.round(x), Math.round(y), s, s);
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = "#eafaff";
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  ctx.globalAlpha = 1;
}

/**
 * Pixel-sprite axolotl (no copied art): rounded pink head, frilly gills out both sides, big sparkly
 * eyes, a curved smile that grins wider with your voice, little arms + tail. Built from pixel-grid
 * ellipses (U-sized cells) so it's crisp retro art with smoothly rounded shapes.
 */
function drawAxolotl(
  ctx: CanvasRenderingContext2D,
  t: number,
  wiggle: number,
  mouth: number,
): void {
  // Filled ellipse on the U-pixel grid.
  const ell = (cx: number, cy: number, rx: number, ry: number, c: string): void => {
    ctx.fillStyle = c;
    const ryC = Math.max(0.5, ry);
    for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
      const hw = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ryC * ryC))));
      ctx.fillRect((cx - hw) * U, (cy + y) * U, (hw * 2 + 1) * U, U);
    }
  };
  const cell = (gx: number, gy: number, gw: number, gh: number, c: string): void => {
    ctx.fillStyle = c;
    ctx.fillRect(gx * U, gy * U, gw * U, gh * U);
  };

  // Tail (lower-left), flowy + wiggling.
  const tw = Math.round(Math.sin(t * 2) * (0.6 + wiggle * 1.4));
  ell(-15, 15 + tw, 4, 3, PINK);
  ell(-19, 16 + tw, 3, 2, BELLY);

  // Gills — 3 leaf fronds each side, sticking out and swaying.
  const cols = [3, 3, 2, 1];
  for (const gy of [-5, 0, 5]) {
    const s = Math.round(Math.sin(t * 2.5 + gy) * (0.4 + wiggle));
    for (let k = 0; k < cols.length; k++) {
      const h = cols[k];
      const ly = gy - (h >> 1) + (k >= 2 ? s : 0);
      cell(-12 - k, ly, 1, h, k >= 2 ? GILL_SH : GILL); // left
      cell(12 + k, ly, 1, h, k >= 2 ? GILL_SH : GILL); // right
    }
  }

  // Body + belly + bottom shade.
  ell(0, 15, 8, 8, PINK);
  ell(0, 17, 5, 6, BELLY);
  ell(0, 21, 6, 2, PINK_SH);

  // Little arms.
  ell(-11, 15, 2.5, 3, PINK);
  ell(11, 15, 2.5, 3, PINK);

  // Head + soft top highlight (flat two-tone, not a gloss gradient).
  ell(0, 0, 12, 11, PINK);
  ell(-4, -5, 5, 3, PINK_LT);

  // Lilac freckles (the second colour).
  cell(-7, 2, 1, 1, LILAC);
  cell(7, 2, 1, 1, LILAC);
  cell(0, -9, 1, 1, LILAC);

  // Big eyes with sparkles.
  ell(-5, 0, 2.5, 3.5, EYE);
  ell(5, 0, 2.5, 3.5, EYE);
  cell(-6, -2, 2, 2, "#ffffff");
  cell(4, -2, 2, 2, "#ffffff");
  cell(-4, 1, 1, 1, "#ffffff");
  cell(6, 1, 1, 1, "#ffffff");

  // Rosy cheeks.
  ell(-8, 4, 2.5, 1.5, CHEEK);
  ell(8, 4, 2.5, 1.5, CHEEK);

  // Curved open smile (◡) that grins wider with energy, with a tongue.
  const grin = grinCells(mouth);
  const depth = 2 + Math.round(mouth * 4);
  const sy = MOUTH_SY;
  ctx.fillStyle = MOUTH;
  for (let x = -grin; x <= grin; x++) {
    const d = Math.round((1 - (x / grin) ** 2) * depth);
    ctx.fillRect(x * U, sy * U, U, (d + 1) * U);
  }
  ctx.fillStyle = TONGUE;
  for (let x = -(grin - 2); x <= grin - 2; x++) {
    const d = Math.round((1 - (x / grin) ** 2) * depth);
    if (d >= 1) ctx.fillRect(x * U, (sy + d) * U, U, U);
  }
}

/** AXOLOTL — a pixel axolotl that sings a waving rainbow from its mouth, underwater (CLAUDE.md §5). */
export function Axolotl() {
  const canvasRef = useCanvas2DScene(
    (ctx, reduced) => {
      // Ocean depth gradient (sunlit top → deep blue), built once.
      const ocean = ctx.createLinearGradient(0, 0, 0, H);
      ocean.addColorStop(0, "#1b6fa6");
      ocean.addColorStop(0.5, "#0e4d79");
      ocean.addColorStop(1, "#072a45");

      const bubbles: Bubble[] = Array.from({ length: BUBBLE_COUNT }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 2 + Math.random() * 4,
        speed: 0.25 + Math.random() * 0.55,
        phase: Math.random() * Math.PI * 2,
      }));

      let t = 0; // gills / tail / idle motion
      let waveT = 0; // rainbow phase — advances slowly (ocean swell, not a sprint)
      let scrollOffset = 0;
      let voiceScroll = 0; // how far the voice waveform has streamed out of the mouth (in samples)

      return (params) => {
        const style: AxolotlStyle = axolotlStyle(params, { reducedMotion: reduced });
        const energy = Math.min(1, Math.max(0, params.energy));
        t += 0.016 * style.bobSpeed;
        waveT += 0.016 * (reduced ? 0.5 : 0.7 + energy * 1.1); // slow rolling ocean swell
        scrollOffset += style.scroll * 0.35;
        voiceScroll += reduced ? 0.6 : 1.2 + energy * 2.6; // the sung waveform flows outward

        // Bob, then derive the *exact* mouth pixel from the same geometry drawAxolotl draws with: the
        // right corner of the open smile (cells → screen px), so the wave truly leaves the mouth.
        const axoY = H / 2 + Math.sin(t * 1.5) * (reduced ? 3 : 4 + energy * 9);
        const grin = grinCells(style.mouth);
        const mouthX = AXO_X + grin * U * AXO_SCALE;
        const mouthY = axoY + (MOUTH_SY + 1) * U * AXO_SCALE;

        // The ribbon *is* the voice: its vertical path traces the live time-domain waveform pouring
        // from the mouth (a thin sliver at the lips, swelling outward), over a gentle ocean sway so
        // it still breathes in silence. Amplitude grows with energy.
        const wave = params.waveform;
        const waveLen = wave.length || 1;
        const voiceAmp = reduced ? 0 : 10 + energy * 46;
        const swayAmp = reduced ? 3 : 5;
        const sampleAt = (dist: number): number => {
          const i = Math.floor(dist * 0.22 - voiceScroll);
          return wave[((i % waveLen) + waveLen) % waveLen] ?? 0;
        };
        const waveAt = (x: number): number => {
          const dist = x - mouthX;
          const swell = Math.min(1, dist / 170);
          const sway = Math.sin(dist * 0.02 - waveT) * swayAmp;
          return mouthY + (sway + sampleAt(dist) * voiceAmp) * swell;
        };

        // Ocean background.
        ctx.fillStyle = ocean;
        ctx.fillRect(0, 0, W, H);

        // Rising bubbles.
        for (const bub of bubbles) {
          bub.y -= bub.speed;
          bub.x += Math.sin(t + bub.phase) * 0.3;
          if (bub.y < -8) {
            bub.y = H + 8;
            bub.x = Math.random() * W;
          }
          drawBubble(ctx, bub.x, bub.y, bub.r);
        }

        // Wavy rainbow ribbon — thin at the mouth, widening out; darker squares march outward.
        // Draw past the right edge (RAINBOW_OVERSCAN) so the ribbon flows *off* screen instead of
        // ending in a hard vertical bar at the edge; the canvas clips the overflow. The overscan
        // also covers any contain-fit letterbox on wide windows.
        ctx.globalAlpha = style.trail;
        for (let x = mouthX; x <= W + RAINBOW_OVERSCAN; x += STRIPE_W) {
          const grow = Math.min(1, (x - mouthX) / 200);
          const bandH = BAND_H * (0.28 + 0.72 * grow);
          const stackH = bandH * RAINBOW.length;
          const top = waveAt(x) - stackH / 2;
          for (let b = 0; b < RAINBOW.length; b++) {
            ctx.fillStyle = RAINBOW[b];
            ctx.fillRect(x, top + b * bandH, STRIPE_W + 1, bandH + 0.6);
          }
          if (Math.floor((x - scrollOffset) / CELL) % 2 === 0) {
            ctx.fillStyle = "rgba(0,0,0,0.16)";
            ctx.fillRect(x, top, STRIPE_W + 1, stackH);
          }
        }
        ctx.globalAlpha = 1;

        // Draw the axolotl last so its head covers the seam — the rainbow looks sung from its mouth.
        ctx.save();
        ctx.translate(AXO_X, axoY);
        ctx.scale(AXO_SCALE, AXO_SCALE);
        drawAxolotl(ctx, t, style.wiggle, style.mouth);
        ctx.restore();
      };
    },
    // Anchor the cover-crop to the left so the axolotl always stays in frame; the rainbow tail on
    // the right is what gets cropped (it flows off screen anyway).
    { width: W, height: H, pixelated: true, anchorX: 0 },
  );

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}
