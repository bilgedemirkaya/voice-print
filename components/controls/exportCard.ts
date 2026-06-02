import type { AnimationParams } from "@/lib/audio/types";

/** Render a retro "About this voice" card to a PNG and trigger a download. Browser-only. */
export function exportVoiceCard(opts: {
  params: AnimationParams;
  sceneName: string;
  voiceName: string;
}): void {
  const { params, sceneName, voiceName } = opts;
  const W = 600;
  const H = 380;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.fillStyle = "#140a28";
  ctx.fillRect(0, 0, W, H);

  // header
  ctx.fillStyle = params.palette[1];
  ctx.fillRect(0, 0, W, 48);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px 'MS Sans Serif', Tahoma, sans-serif";
  ctx.fillText("About this voice", 16, 31);

  // meta
  ctx.fillStyle = "#ece3fb";
  ctx.font = "14px 'MS Sans Serif', Tahoma, sans-serif";
  ctx.fillText(`Voice:  ${voiceName}`, 16, 84);
  ctx.fillText(`Scene:  ${sceneName}`, 16, 108);

  // palette
  ctx.fillText("Palette", 16, 146);
  params.palette.forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(90 + i * 60, 132, 50, 22);
  });

  // param bars
  const bars: Array<[string, number]> = [
    ["Energy", params.energy],
    ["Bass", params.bass],
    ["Mid", params.mid],
    ["Treble", params.treble],
    ["Brightness", params.brightness],
    ["Roughness", params.roughness],
  ];
  let y = 188;
  for (const [label, value] of bars) {
    ctx.fillStyle = "#ece3fb";
    ctx.font = "12px 'MS Sans Serif', Tahoma, sans-serif";
    ctx.fillText(label, 16, y + 10);
    ctx.fillStyle = "#3a2a5a";
    ctx.fillRect(110, y, 440, 12);
    ctx.fillStyle = params.palette[1];
    ctx.fillRect(110, y, 440 * Math.max(0, Math.min(1, value)), 12);
    y += 24;
  }

  ctx.fillStyle = "#9b8fb3";
  ctx.font = "10px 'MS Sans Serif', Tahoma, sans-serif";
  ctx.fillText("VOICESCREEN.SCR", 16, H - 14);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "voiceprint.png";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, "image/png");
}
