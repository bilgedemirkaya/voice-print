import { describe, expect, it } from "vitest";
import {
  bandEnergies,
  binToHz,
  clamp01,
  normalizeFrequencyBytes,
  rms,
  spectralCentroid,
  zeroCrossingRate,
} from "./features";
import { magnitudesForTone, silence, sine, whiteNoise } from "../../tests/synthetic";

const SR = 48000;
const FFT = 2048;

describe("clamp01", () => {
  it("clamps to [0,1] and guards NaN", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(Number.NaN)).toBe(0);
  });
});

describe("rms", () => {
  it("is ~0.707 for a unit sine", () => {
    expect(rms(sine(440, SR, 4096, 1))).toBeGreaterThan(0.69);
    expect(rms(sine(440, SR, 4096, 1))).toBeLessThan(0.72);
  });

  it("is 0 for silence and for an empty buffer", () => {
    expect(rms(silence(1024))).toBe(0);
    expect(rms(new Float32Array(0))).toBe(0);
  });

  it("grows with amplitude (louder → larger)", () => {
    expect(rms(sine(440, SR, 4096, 0.25))).toBeLessThan(rms(sine(440, SR, 4096, 0.9)));
  });
});

describe("zeroCrossingRate", () => {
  it("is 0 for silence (no sign changes)", () => {
    expect(zeroCrossingRate(silence(1024))).toBe(0);
  });

  it("is higher for noise than for a low tone", () => {
    expect(zeroCrossingRate(whiteNoise(4096))).toBeGreaterThan(zeroCrossingRate(sine(80, SR, 4096)));
  });

  it("is higher for a high tone than a low tone", () => {
    expect(zeroCrossingRate(sine(4000, SR, 4096))).toBeGreaterThan(
      zeroCrossingRate(sine(200, SR, 4096)),
    );
  });
});

describe("binToHz / normalizeFrequencyBytes", () => {
  it("maps bin 0 → 0 Hz and the last bin → Nyquist", () => {
    expect(binToHz(0, SR, FFT)).toBe(0);
    expect(binToHz(FFT / 2, SR, FFT)).toBeCloseTo(SR / 2);
  });

  it("scales bytes 0..255 to 0..1", () => {
    const out = normalizeFrequencyBytes(Uint8Array.from([0, 255, 128]));
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(1);
    expect(out[2]).toBeCloseTo(128 / 255);
  });
});

describe("bandEnergies", () => {
  it("puts a low tone's energy in the bass band", () => {
    const b = bandEnergies(magnitudesForTone(100, SR, FFT), SR, FFT);
    expect(b.low).toBeGreaterThan(b.mid);
    expect(b.low).toBeGreaterThan(b.high);
  });

  it("puts a high tone's energy in the treble band", () => {
    const b = bandEnergies(magnitudesForTone(8000, SR, FFT), SR, FFT);
    expect(b.high).toBeGreaterThan(b.mid);
    expect(b.high).toBeGreaterThan(b.low);
  });

  it("returns zeros for an empty spectrum", () => {
    expect(bandEnergies(new Float32Array(FFT / 2), SR, FFT)).toEqual({ low: 0, mid: 0, high: 0 });
  });
});

describe("spectralCentroid", () => {
  it("is higher for a high tone than a low tone", () => {
    const low = spectralCentroid(magnitudesForTone(200, SR, FFT), SR, FFT);
    const high = spectralCentroid(magnitudesForTone(8000, SR, FFT), SR, FFT);
    expect(high).toBeGreaterThan(low);
  });

  it("is 0 for an empty spectrum", () => {
    expect(spectralCentroid(new Float32Array(FFT / 2), SR, FFT)).toBe(0);
  });

  it("normalizes to ~freq / Nyquist", () => {
    expect(spectralCentroid(magnitudesForTone(12000, SR, FFT), SR, FFT)).toBeCloseTo(
      12000 / (SR / 2),
      1,
    );
  });
});
