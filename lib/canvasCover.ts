/**
 * Size a 2D canvas's backing store to its displayed size, then apply a uniform "contain" transform
 * so a fixed refW×refH scene fits *entirely* inside the element, centered (letterboxed when the
 * aspect ratios differ — e.g. a portrait phone). Letterboxed areas are cleared to prevent the
 * container background from showing through.
 * Call once per frame before drawing in reference (refW×refH) coordinates.
 */
export function fitCanvasContain(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  refW: number,
  refH: number,
): void {
  const dw = canvas.clientWidth || refW;
  const dh = canvas.clientHeight || refH;
  if (canvas.width !== dw || canvas.height !== dh) {
    canvas.width = dw;
    canvas.height = dh;
  }
  const scale = Math.min(dw / refW, dh / refH);
  ctx.setTransform(scale, 0, 0, scale, (dw - refW * scale) / 2, (dh - refH * scale) / 2);
}
