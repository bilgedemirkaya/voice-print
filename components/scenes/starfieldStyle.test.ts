import { describe, expect, it } from "vitest";
import { starfieldStyle } from "./starfieldStyle";
import { silentParams } from "@/lib/audio/params";
import type { AnimationParams } from "@/lib/audio/types";

function params(overrides: Partial<AnimationParams> = {}): AnimationParams {
  return { ...silentParams(), ...overrides };
}

describe("starfieldStyle", () => {
  it("speed and streak increase with energy", () => {
    const calm = starfieldStyle(params({ energy: 0 }));
    const loud = starfieldStyle(params({ energy: 1 }));
    expect(loud.speed).toBeGreaterThan(calm.speed);
    expect(loud.streak).toBeGreaterThan(calm.streak);
  });

  it("passes the palette through and forwards band energies", () => {
    const style = starfieldStyle(
      params({ palette: ["#111111", "#222222", "#333333"], bass: 0.4, mid: 0.5, treble: 0.6 }),
    );
    expect(style.colors).toEqual(["#111111", "#222222", "#333333"]);
    expect(style.bass).toBeCloseTo(0.4);
    expect(style.treble).toBeCloseTo(0.6);
  });

  it("damps under reduced motion", () => {
    const normal = starfieldStyle(params({ energy: 1 }), { reducedMotion: false });
    const reduced = starfieldStyle(params({ energy: 1 }), { reducedMotion: true });
    expect(reduced.speed).toBeLessThan(normal.speed);
    expect(reduced.streak).toBeLessThan(normal.streak);
  });

  it("clamps inputs and stays finite", () => {
    const style = starfieldStyle(params({ energy: 9, treble: Number.NaN }));
    for (const v of [style.speed, style.streak, style.bass, style.mid, style.treble]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(style.treble).toBe(0); // NaN guarded
  });
});
