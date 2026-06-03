import { applyPalette, GIFEncoder, quantize } from "gifenc";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Capture the live canvas to a downloadable looping GIF (silent — GIFs carry no audio).
 * Frames are grabbed in real time (cheap), then quantized/encoded afterwards so capture timing
 * stays accurate. Needs the source canvas to preserve its drawing buffer (set on the r3f Canvas).
 */
export async function exportSceneGif(
  canvas: HTMLCanvasElement,
  options: { durationMs?: number; fps?: number; maxWidth?: number } = {},
): Promise<void> {
  const { durationMs = 5000, fps = 14, maxWidth = 460 } = options;
  const srcW = canvas.width || canvas.clientWidth;
  const srcH = canvas.height || canvas.clientHeight;
  if (!srcW || !srcH) return;

  // Downscale to keep the GIF a sane size; even dimensions encode more cleanly.
  const scale = Math.min(1, maxWidth / srcW);
  const w = Math.max(2, Math.round((srcW * scale) / 2) * 2);
  const h = Math.max(2, Math.round((srcH * scale) / 2) * 2);

  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;

  const frameDelay = Math.round(1000 / fps);

  const frames: Uint8ClampedArray[] = [];
  const start = performance.now();
  while (performance.now() - start < durationMs) {
    ctx.drawImage(canvas, 0, 0, w, h);
    frames.push(ctx.getImageData(0, 0, w, h).data);
    await sleep(frameDelay);
  }

  const gif = GIFEncoder();
  for (let i = 0; i < frames.length; i++) {
    const data = frames[i]!;
    const palette = quantize(data, 256);
    const index = applyPalette(data, palette);
    gif.writeFrame(index, w, h, { palette, delay: frameDelay });
    if (i % 8 === 0) await sleep(0); // yield so the UI stays responsive while encoding
  }
  gif.finish();
  triggerDownload(new Blob([gif.bytes()], { type: "image/gif" }), "voiceprint.gif");
}
