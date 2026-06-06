import {
  bandEnergies,
  clamp01,
  normalizeFrequencyBytes,
  rms,
  spectralCentroid,
  zeroCrossingRate,
} from "./features";
import type { AnimationParams, AudioFeatures } from "./types";

export { clamp01 } from "./features";

const ENERGY_GAIN = 1.4; // lifts perceptual loudness so normal speech reads as mid energy
const ROUGHNESS_GAIN = 3; // ZCR of voiced speech is small; lift it into a usable range
export const WAVEFORM_SIZE = 128; // downsampled points stored for scenes

/** HSL (h 0..360, s/l 0..100) → #rrggbb. Pure, deterministic. */
export function hslToHex(h: number, s: number, l: number): string {
  const sat = clamp01(s / 100);
  const lig = clamp01(l / 100);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const hp = ((((h % 360) + 360) % 360) / 60);
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const m = lig - c / 2;
  const channel = (v: number): string =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/**
 * Derive a three-swatch palette from brightness (CLAUDE.md §5):
 * darker voices → cooler violet/blue, brighter → warmer magenta/pink. Energy boosts saturation.
 */
export function paletteFromBrightness(brightness: number, energy = 0.5): [string, string, string] {
  const b = clamp01(brightness);
  const baseHue = 260 + b * 90; // 260 (cool violet) → 350 (hot pink)
  const sat = 60 + clamp01(energy) * 30;
  return [
    hslToHex(baseHue - 24, sat, 68),
    hslToHex(baseHue, sat, 58),
    hslToHex(baseHue + 24, sat - 8, 46),
  ];
}

/** Decimate a buffer down to `target` points by nearest-sample picking. */
export function downsample(input: Float32Array, target: number): Float32Array {
  if (input.length <= target) return Float32Array.from(input);
  const out = new Float32Array(target);
  const block = input.length / target;
  for (let i = 0; i < target; i++) {
    out[i] = input[Math.floor(i * block)];
  }
  return out;
}

/** Extract raw features from one analysis frame. Pure; no Web Audio, React or Three.js. */
export function extractFeatures(
  timeDomain: Float32Array,
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
): AudioFeatures {
  const bands = bandEnergies(magnitudes, sampleRate, fftSize);
  return {
    rms: rms(timeDomain),
    bass: bands.low,
    mid: bands.mid,
    treble: bands.high,
    brightness: spectralCentroid(magnitudes, sampleRate, fftSize),
    roughness: zeroCrossingRate(timeDomain),
  };
}

/** Map raw features + a waveform into the AnimationParams scenes consume. All fields clamped to 0..1. */
export function featuresToParams(features: AudioFeatures, waveform: Float32Array): AnimationParams {
  const energy = clamp01(Math.sqrt(Math.max(0, features.rms)) * ENERGY_GAIN);
  const brightness = clamp01(features.brightness);
  const roughness = clamp01(features.roughness * ROUGHNESS_GAIN);
  return {
    energy,
    bass: clamp01(features.bass),
    mid: clamp01(features.mid),
    treble: clamp01(features.treble),
    brightness,
    roughness,
    palette: paletteFromBrightness(brightness, energy),
    waveform,
  };
}

/** Full per-frame pipeline from raw AnalyserNode buffers to AnimationParams. */
export function analyzeFrame(
  timeDomain: Float32Array,
  frequencyBytes: Uint8Array,
  sampleRate: number,
  fftSize: number,
): AnimationParams {
  const magnitudes = normalizeFrequencyBytes(frequencyBytes);
  const features = extractFeatures(timeDomain, magnitudes, sampleRate, fftSize);
  return featuresToParams(features, downsample(timeDomain, WAVEFORM_SIZE));
}

/** Calm zeroed state — used as the store default and when nothing is playing. */
export function silentParams(): AnimationParams {
  return {
    energy: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    brightness: 0,
    roughness: 0,
    palette: paletteFromBrightness(0, 0),
    waveform: new Float32Array(WAVEFORM_SIZE),
  };
}
