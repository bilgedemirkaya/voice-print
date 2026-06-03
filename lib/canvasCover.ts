/**
 * Size a 2D canvas's backing store to its displayed size, then apply a uniform "cover" transform so
 * a fixed refW×refH scene fills the element (cropping overflow), centered — no distortion, no blur.
 * Call once per frame before drawing in reference (refW×refH) coordinates.
 */
export function fitCanvasCover(
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
  const scale = Math.max(dw / refW, dh / refH);
  ctx.setTransform(scale, 0, 0, scale, (dw - refW * scale) / 2, (dh - refH * scale) / 2);
}
