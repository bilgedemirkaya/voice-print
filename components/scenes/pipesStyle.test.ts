import { describe, expect, it } from "vitest";
import { pipesStyle } from "./pipesStyle";
import { silentParams } from "@/lib/audio/params";
import type { AnimationParams } from "@/lib/audio/types";

function params(overrides: Partial<AnimationParams> = {}): AnimationParams {
  return { ...silentParams(), ...overrides };
}

describe("pipesStyle", () => {
  it("growth rate increases with bass", () => {
    expect(pipesStyle(params({ bass: 1 })).growthRate).toBeGreaterThan(
      pipesStyle(params({ bass: 0 })).growthRate,
    );
  });

  it("thickness grows with mid; turnChance grows with roughness", () => {
    expect(pipesStyle(params({ mid: 1 })).thickness).toBeGreaterThan(
      pipesStyle(params({ mid: 0 })).thickness,
    );
    expect(pipesStyle(params({ roughness: 1 })).turnChance).toBeGreaterThan(
      pipesStyle(params({ roughness: 0 })).turnChance,
    );
  });

  it("passes the palette through", () => {
    expect(pipesStyle(params({ palette: ["#111111", "#222222", "#333333"] })).colors).toEqual([
      "#111111",
      "#222222",
      "#333333",
    ]);
  });

  it("damps growth under reduced motion", () => {
    const normal = pipesStyle(params({ bass: 1 }), { reducedMotion: false });
    const reduced = pipesStyle(params({ bass: 1 }), { reducedMotion: true });
    expect(reduced.growthRate).toBeLessThan(normal.growthRate);
  });

  it("clamps inputs and stays finite", () => {
    const style = pipesStyle(params({ bass: 9, mid: -1, roughness: Number.NaN }));
    for (const v of [style.growthRate, style.thickness, style.turnChance]) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });
});
