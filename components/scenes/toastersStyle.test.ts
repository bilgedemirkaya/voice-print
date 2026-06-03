import { describe, expect, it } from "vitest";
import { silentParams } from "@/lib/audio/params";
import { toastersStyle } from "./toastersStyle";

const base = silentParams();

describe("toastersStyle", () => {
  it("drifts faster with energy", () => {
    const quiet = toastersStyle({ ...base, energy: 0 });
    const loud = toastersStyle({ ...base, energy: 1 });
    expect(loud.speed).toBeGreaterThan(quiet.speed);
  });

  it("flaps faster with treble", () => {
    const dull = toastersStyle({ ...base, treble: 0 });
    const bright = toastersStyle({ ...base, treble: 1 });
    expect(bright.flap).toBeGreaterThan(dull.flap);
  });

  it("takes its edge tint from the palette", () => {
    const palette: [string, string, string] = ["#111111", "#abcdef", "#333333"];
    expect(toastersStyle({ ...base, palette }).tint).toBe("#abcdef");
  });

  it("damps speed + flap under reduced motion", () => {
    const full = toastersStyle({ ...base, energy: 1, treble: 1 });
    const reduced = toastersStyle({ ...base, energy: 1, treble: 1 }, { reducedMotion: true });
    expect(reduced.speed).toBeLessThan(full.speed);
    expect(reduced.flap).toBeLessThan(full.flap);
  });
});
