import { describe, expect, it } from "vitest";
import {
  analyzeFrame,
  downsample,
  featuresToParams,
  hslToHex,
  paletteFromBrightness,
  silentParams,
} from "./params";
import type { AudioFeatures } from "./types";
import { byteFrequencyForTone, sine } from "../../tests/synthetic";

const HEX = /^#[0-9a-f]{6}$/;

function features(overrides: Partial<AudioFeatures> = {}): AudioFeatures {
  return { rms: 0, bass: 0, mid: 0, treble: 0, brightness: 0, roughness: 0, ...overrides };
}

function rgb(hex: string): { r: number; g: number; b: number } {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

describe("hslToHex", () => {
  it("produces valid 6-digit hex", () => {
    expect(hslToHex(0, 100, 50)).toMatch(HEX);
    expect(hslToHex(300, 70, 60)).toMatch(HEX);
  });

  it("maps known colors", () => {
    expect(hslToHex(0, 100, 50)).toBe("#ff0000");
    expect(hslToHex(120, 100, 50)).toBe("#00ff00");
    expect(hslToHex(240, 100, 50)).toBe("#0000ff");
    expect(hslToHex(0, 0, 100)).toBe("#ffffff");
    expect(hslToHex(0, 0, 0)).toBe("#000000");
  });
});

describe("paletteFromBrightness", () => {
  it("returns three valid hex swatches", () => {
    const palette = paletteFromBrightness(0.5, 0.5);
    expect(palette).toHaveLength(3);
    palette.forEach((color) => expect(color).toMatch(HEX));
  });

  it("shifts warmer (more red, less blue) as brightness increases", () => {
    const cool = rgb(paletteFromBrightness(0, 0.6)[1]);
    const warm = rgb(paletteFromBrightness(1, 0.6)[1]);
    expect(warm.r).toBeGreaterThan(cool.r);
    expect(cool.b).toBeGreaterThan(warm.b);
  });
});

describe("featuresToParams", () => {
  it("clamps every numeric field to 0..1", () => {
    const p = featuresToParams(
      features({ rms: 5, bass: 2, mid: -1, treble: 9, brightness: 3, roughness: 4 }),
      new Float32Array(8),
    );
    for (const v of [p.energy, p.bass, p.mid, p.treble, p.brightness, p.roughness]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("energy increases with rms (monotonic)", () => {
    const quiet = featuresToParams(features({ rms: 0.05 }), new Float32Array(8)).energy;
    const loud = featuresToParams(features({ rms: 0.5 }), new Float32Array(8)).energy;
    expect(loud).toBeGreaterThan(quiet);
  });

  it("passes the waveform through and emits a 3-hex palette", () => {
    const wave = sine(440, 48000, 16);
    const p = featuresToParams(features({ brightness: 0.5 }), wave);
    expect(p.waveform).toBe(wave);
    expect(p.palette).toHaveLength(3);
    p.palette.forEach((color) => expect(color).toMatch(HEX));
  });
});

describe("analyzeFrame", () => {
  it("turns raw buffers into clamped params with a 128-sample waveform", () => {
    const sr = 48000;
    const fft = 2048;
    const time = sine(120, sr, fft, 0.8);
    const freq = byteFrequencyForTone(120, sr, fft);

    const p = analyzeFrame(time, freq, sr, fft);

    expect(p.energy).toBeGreaterThan(0);
    expect(p.bass).toBeGreaterThan(p.treble); // 120 Hz is bass, not treble
    expect(p.waveform).toHaveLength(128);
    for (const v of [p.energy, p.bass, p.mid, p.treble, p.brightness, p.roughness]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe("downsample", () => {
  it("reduces a long buffer to the target length", () => {
    expect(downsample(new Float32Array(1000), 128)).toHaveLength(128);
  });

  it("returns a copy (not the same ref) when input is already short", () => {
    const input = Float32Array.from([1, 2, 3]);
    const out = downsample(input, 128);
    expect(out).not.toBe(input);
    expect(Array.from(out)).toEqual([1, 2, 3]);
  });
});

describe("silentParams", () => {
  it("is all-zero with a valid palette and 128-sample waveform", () => {
    const p = silentParams();
    expect([p.energy, p.bass, p.mid, p.treble, p.brightness, p.roughness]).toEqual([
      0, 0, 0, 0, 0, 0,
    ]);
    expect(p.waveform).toHaveLength(128);
    p.palette.forEach((color) => expect(color).toMatch(HEX));
  });
});
