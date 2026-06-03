import { hslToHex } from "@/lib/audio/params";

/**
 * A consistent 3-swatch palette for a voice, from its gender + vibe (ElevenLabs labels).
 * Gender sets the base hue family; vibe shifts it warmer/cooler. Pure + deterministic, so a
 * given voice always paints the screensaver the same way (motion still comes from the audio).
 */
export function voicePaletteForLabels(labels: Record<string, string>): [string, string, string] {
  const gender = (labels.gender ?? "").toLowerCase();
  const vibe = (labels.descriptive ?? "").toLowerCase();

  let hue = gender === "male" ? 215 : gender === "female" ? 330 : 270;
  if (/calm|soft|sooth|gentle|mellow/.test(vibe)) hue -= 25;
  else if (/deep|intense|dramatic|serious/.test(vibe)) hue -= 10;
  else if (/bright|cheer|upbeat|energetic|excit/.test(vibe)) hue += 20;
  else if (/sass|quirk|play|expressive/.test(vibe)) hue += 35;

  const sat = 72;
  return [
    hslToHex(hue - 22, sat, 66),
    hslToHex(hue, sat, 56),
    hslToHex(hue + 22, sat - 8, 46),
  ];
}
