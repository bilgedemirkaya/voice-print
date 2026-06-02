import { describe, expect, it } from "vitest";
import { mystifyStyle } from "./mystifyStyle";
import { silentParams } from "@/lib/audio/params";
import type { AnimationParams } from "@/lib/audio/types";

function params(overrides: Partial<AnimationParams> = {}): AnimationParams {
  return { ...silentParams(), ...overrides };
}

describe("mystifyStyle", () => {
  it("speed increases with energy", () => {
    expect(mystifyStyle(params({ energy: 1 })).speed).toBeGreaterThan(
      mystifyStyle(params({ energy: 0 })).speed,
    );
  });

  it("jitter tracks roughness", () => {
    expect(mystifyStyle(params({ roughness: 0.9 })).jitter).toBeGreaterThan(
      mystifyStyle(params({ roughness: 0.1 })).jitter,
    );
  });

  it("lineWidth grows with bass", () => {
    expect(mystifyStyle(params({ bass: 1 })).lineWidth).toBeGreaterThan(
      mystifyStyle(params({ bass: 0 })).lineWidth,
    );
  });

  it("passes the palette through", () => {
    expect(mystifyStyle(params({ palette: ["#111111", "#222222", "#333333"] })).colors).toEqual([
      "#111111",
      "#222222",
      "#333333",
    ]);
  });

  it("damps under reduced motion (slower, less jitter, faster trail fade)", () => {
    const normal = mystifyStyle(params({ energy: 1, roughness: 1 }), { reducedMotion: false });
    const reduced = mystifyStyle(params({ energy: 1, roughness: 1 }), { reducedMotion: true });
    expect(reduced.speed).toBeLessThan(normal.speed);
    expect(reduced.jitter).toBeLessThan(normal.jitter);
    expect(reduced.trailFade).toBeGreaterThan(normal.trailFade);
  });

  it("clamps inputs and stays finite", () => {
    const style = mystifyStyle(params({ energy: 9, bass: -1, roughness: Number.NaN }));
    for (const v of [style.speed, style.jitter, style.lineWidth, style.trailFade]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(style.jitter).toBe(0); // NaN guarded
  });
});
