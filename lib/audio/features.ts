import type { BandEnergies } from "./types";

/** Band edges in Hz. Roughly: rumble/voiced fundamentals, vowels/voice body, sibilance/sparkle. */
const BANDS = {
  low: [20, 250],
  mid: [250, 2000],
  high: [2000, 16000],
} as const;

export function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Root-mean-square of a time-domain buffer in [-1, 1]. ~0.707 for a unit sine, 0 for silence. */
export function rms(timeDomain: Float32Array): number {
  if (timeDomain.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < timeDomain.length; i++) {
    sum += timeDomain[i] * timeDomain[i];
  }
  return Math.sqrt(sum / timeDomain.length);
}

/** Fraction of adjacent samples that change sign (0..1). High for noise/fricatives, low for low tones. */
export function zeroCrossingRate(timeDomain: Float32Array): number {
  if (timeDomain.length < 2) return 0;
  let crossings = 0;
  let prev = timeDomain[0];
  for (let i = 1; i < timeDomain.length; i++) {
    const cur = timeDomain[i];
    if ((cur >= 0 && prev < 0) || (cur < 0 && prev >= 0)) crossings++;
    prev = cur;
  }
  return crossings / (timeDomain.length - 1);
}

/** Convert getByteFrequencyData (0..255) into normalized magnitudes (0..1). */
export function normalizeFrequencyBytes(bytes: Uint8Array): Float32Array {
  const out = new Float32Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] / 255;
  return out;
}

/** Centre frequency (Hz) of an FFT bin. */
export function binToHz(bin: number, sampleRate: number, fftSize: number): number {
  return (bin * sampleRate) / fftSize;
}

/** Average normalized magnitude within each band (each 0..1). */
export function bandEnergies(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
): BandEnergies {
  const sum = { low: 0, mid: 0, high: 0 };
  const count = { low: 0, mid: 0, high: 0 };

  for (let i = 0; i < magnitudes.length; i++) {
    const hz = binToHz(i, sampleRate, fftSize);
    if (hz >= BANDS.low[0] && hz < BANDS.low[1]) {
      sum.low += magnitudes[i];
      count.low++;
    } else if (hz >= BANDS.mid[0] && hz < BANDS.mid[1]) {
      sum.mid += magnitudes[i];
      count.mid++;
    } else if (hz >= BANDS.high[0] && hz < BANDS.high[1]) {
      sum.high += magnitudes[i];
      count.high++;
    }
  }

  return {
    low: count.low ? clamp01(sum.low / count.low) : 0,
    mid: count.mid ? clamp01(sum.mid / count.mid) : 0,
    high: count.high ? clamp01(sum.high / count.high) : 0,
  };
}

/**
 * Spectral centroid ("brightness") normalized to 0..1 against the Nyquist frequency.
 * Darker voices → lower value; brighter/sharper voices → higher.
 */
export function spectralCentroid(
  magnitudes: Float32Array,
  sampleRate: number,
  fftSize: number,
): number {
  let weighted = 0;
  let total = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    weighted += binToHz(i, sampleRate, fftSize) * magnitudes[i];
    total += magnitudes[i];
  }
  if (total === 0) return 0;
  const centroidHz = weighted / total;
  const nyquist = sampleRate / 2;
  return clamp01(centroidHz / nyquist);
}
