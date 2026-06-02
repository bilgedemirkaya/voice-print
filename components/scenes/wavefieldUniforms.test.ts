import { describe, expect, it } from "vitest";
import { wavefieldUniforms } from "./wavefieldUniforms";
import { silentParams } from "@/lib/audio/params";
import type { AnimationParams } from "@/lib/audio/types";

function params(overrides: Partial<AnimationParams> = {}): AnimationParams {
  return { ...silentParams(), ...overrides };
}

describe("wavefieldUniforms", () => {
  it("amplitude increases with energy", () => {
    const quiet = wavefieldUniforms(params({ energy: 0 })).amplitude;
    const loud = wavefieldUniforms(params({ energy: 1 })).amplitude;
    expect(loud).toBeGreaterThan(quiet);
  });

  it("speed increases with energy", () => {
    expect(wavefieldUniforms(params({ energy: 1 })).speed).toBeGreaterThan(
      wavefieldUniforms(params({ energy: 0 })).speed,
    );
  });

  it("jitter tracks roughness", () => {
    expect(wavefieldUniforms(params({ roughness: 0.9 })).jitter).toBeGreaterThan(
      wavefieldUniforms(params({ roughness: 0.1 })).jitter,
    );
  });

  it("passes the palette through and forwards band energies", () => {
    const u = wavefieldUniforms(
      params({
        palette: ["#111111", "#222222", "#333333"],
        bass: 0.4,
        mid: 0.5,
        treble: 0.6,
        brightness: 0.7,
      }),
    );
    expect(u.palette).toEqual(["#111111", "#222222", "#333333"]);
    expect(u.bass).toBeCloseTo(0.4);
    expect(u.mid).toBeCloseTo(0.5);
    expect(u.treble).toBeCloseTo(0.6);
    expect(u.brightness).toBeCloseTo(0.7);
  });

  it("damps under reduced motion (no scroll, smaller amplitude + jitter)", () => {
    const normal = wavefieldUniforms(params({ energy: 1, roughness: 1 }), { reducedMotion: false });
    const reduced = wavefieldUniforms(params({ energy: 1, roughness: 1 }), { reducedMotion: true });
    expect(reduced.speed).toBe(0);
    expect(reduced.amplitude).toBeLessThan(normal.amplitude);
    expect(reduced.jitter).toBeLessThan(normal.jitter);
  });

  it("clamps out-of-range inputs and stays finite", () => {
    const u = wavefieldUniforms(
      params({
        energy: 9,
        bass: -1,
        mid: 5,
        treble: Number.NaN,
        roughness: 3,
        brightness: -2,
      }),
    );
    for (const v of [u.amplitude, u.speed, u.jitter, u.bass, u.mid, u.treble, u.brightness]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(u.amplitude).toBeLessThanOrEqual(1);
    expect(u.bass).toBe(0); // -1 clamped
    expect(u.treble).toBe(0); // NaN guarded
    expect(u.brightness).toBe(0); // -2 clamped
  });
});
