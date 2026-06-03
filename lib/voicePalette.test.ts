import { describe, expect, it } from "vitest";
import { voicePaletteForLabels } from "./voicePalette";

const HEX = /^#[0-9a-f]{6}$/;

describe("voicePaletteForLabels", () => {
  it("returns three valid hex swatches", () => {
    const palette = voicePaletteForLabels({ gender: "female", descriptive: "calm" });
    expect(palette).toHaveLength(3);
    palette.forEach((color) => expect(color).toMatch(HEX));
  });

  it("differs by gender", () => {
    expect(voicePaletteForLabels({ gender: "male" })).not.toEqual(
      voicePaletteForLabels({ gender: "female" }),
    );
  });

  it("shifts with vibe and stays deterministic", () => {
    const calm = voicePaletteForLabels({ gender: "female", descriptive: "calm" });
    const bright = voicePaletteForLabels({ gender: "female", descriptive: "bright" });
    expect(calm).not.toEqual(bright);
    expect(calm).toEqual(voicePaletteForLabels({ gender: "female", descriptive: "calm" }));
  });
});
