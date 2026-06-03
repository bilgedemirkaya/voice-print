// Minimal ambient types for gifenc (ships untyped). Covers only what we use.
declare module "gifenc" {
  type Palette = number[][];
  type PixelData = Uint8Array | Uint8ClampedArray;

  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array | number[],
      width: number,
      height: number,
      opts?: { palette?: Palette; delay?: number; transparent?: boolean; first?: boolean },
    ): void;
    finish(): void;
    bytes(): Uint8Array<ArrayBuffer>;
    reset(): void;
  };

  export function quantize(rgba: PixelData, maxColors: number): Palette;

  export function applyPalette(rgba: PixelData, palette: Palette): Uint8Array;
}
