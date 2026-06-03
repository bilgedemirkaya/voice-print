import { describe, expect, it } from "vitest";
import { silentParams } from "@/lib/audio/params";
import { nyanStyle } from "./nyanStyle";

const base = silentParams();

describe("nyanStyle", () => {
  it("bobs, scrolls, and brightens more with energy", () => {
    const quiet = nyanStyle({ ...base, energy: 0 });
    const loud = nyanStyle({ ...base, energy: 1 });
    expect(loud.bob).toBeGreaterThan(quiet.bob);
    expect(loud.scroll).toBeGreaterThan(quiet.scroll);
    expect(loud.trail).toBeGreaterThan(quiet.trail);
  });

  it("makes the bob jauntier with treble", () => {
    const dull = nyanStyle({ ...base, treble: 0 });
    const bright = nyanStyle({ ...base, treble: 1 });
    expect(bright.bobSpeed).toBeGreaterThan(dull.bobSpeed);
  });

  it("uses the first palette swatch for the star accent", () => {
    const palette: [string, string, string] = ["#112233", "#445566", "#778899"];
    expect(nyanStyle({ ...base, palette }).starColor).toBe("#112233");
  });

  it("damps motion under reduced motion (no wiggle)", () => {
    const full = nyanStyle({ ...base, energy: 1 });
    const reduced = nyanStyle({ ...base, energy: 1 }, { reducedMotion: true });
    expect(reduced.bob).toBeLessThan(full.bob);
    expect(reduced.wiggle).toBe(0);
  });
});
