/** Deterministic synthetic audio buffers for unit tests — no Web Audio, no mic. */

export function silence(length: number): Float32Array {
  return new Float32Array(length);
}

export function sine(
  freqHz: number,
  sampleRate: number,
  length: number,
  amplitude = 1,
): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  }
  return out;
}

/** Mulberry32 — tiny deterministic PRNG so noise tests are stable across runs. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function whiteNoise(length: number, seed = 1): Float32Array {
  const rand = mulberry32(seed);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = rand() * 2 - 1;
  return out;
}

function hzToBin(freqHz: number, sampleRate: number, fftSize: number): number {
  return Math.round((freqHz * fftSize) / sampleRate);
}

/** Normalized magnitude spectrum (length fftSize/2) with a single unit spike at `freqHz`. */
export function magnitudesForTone(
  freqHz: number,
  sampleRate: number,
  fftSize: number,
  value = 1,
): Float32Array {
  const out = new Float32Array(fftSize / 2);
  const bin = hzToBin(freqHz, sampleRate, fftSize);
  if (bin >= 0 && bin < out.length) out[bin] = value;
  return out;
}

/** The same spike as getByteFrequencyData-style bytes (0..255). */
export function byteFrequencyForTone(
  freqHz: number,
  sampleRate: number,
  fftSize: number,
  value = 255,
): Uint8Array {
  const out = new Uint8Array(fftSize / 2);
  const bin = hzToBin(freqHz, sampleRate, fftSize);
  if (bin >= 0 && bin < out.length) out[bin] = value;
  return out;
}
