import { describe, expect, it } from "vitest";
import { silentParams } from "@/lib/audio/params";
import { axolotlStyle } from "./axolotlStyle";

const base = silentParams();

describe("axolotlStyle", () => {
  it("surfs, scrolls, and brightens more with energy", () => {
    const quiet = axolotlStyle({ ...base, energy: 0 });
    const loud = axolotlStyle({ ...base, energy: 1 });
    expect(loud.bob).toBeGreaterThan(quiet.bob);
    expect(loud.scroll).toBeGreaterThan(quiet.scroll);
    expect(loud.trail).toBeGreaterThan(quiet.trail);
  });

  it("makes the bob jauntier with treble", () => {
    const dull = axolotlStyle({ ...base, treble: 0 });
    const bright = axolotlStyle({ ...base, treble: 1 });
    expect(bright.bobSpeed).toBeGreaterThan(dull.bobSpeed);
  });

  it("widens the smile as energy rises", () => {
    expect(axolotlStyle({ ...base, energy: 1 }).mouth).toBeGreaterThan(
      axolotlStyle({ ...base, energy: 0 }).mouth,
    );
  });

  it("uses the first palette swatch for the star accent", () => {
    const palette: [string, string, string] = ["#112233", "#445566", "#778899"];
    expect(axolotlStyle({ ...base, palette }).starColor).toBe("#112233");
  });

  it("damps motion under reduced motion (no wiggle)", () => {
    const full = axolotlStyle({ ...base, energy: 1 });
    const reduced = axolotlStyle({ ...base, energy: 1 }, { reducedMotion: true });
    expect(reduced.bob).toBeLessThan(full.bob);
    expect(reduced.wiggle).toBe(0);
  });
});
