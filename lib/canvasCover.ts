/**
 * Size a 2D canvas's backing store to its displayed size, then apply a uniform "cover" transform so
 * a fixed refW×refH scene *fills* the element entirely, cropping whatever overflows (the opposite of
 * letterboxing). This guarantees the scene paints every pixel of the canvas — no unpainted strips at
 * the edges when the element's aspect ratio differs from the scene's (which otherwise show through
 * as hard bars). `anchorX`/`anchorY` (0..1) choose which part survives the crop: e.g. anchorX = 0
 * keeps the left edge (and crops the right). Call once per frame before drawing in reference coords.
 */
export function fitCanvasCover(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  refW: number,
  refH: number,
  anchorX = 0.5,
  anchorY = 0.5,
): void {
  const dw = canvas.clientWidth || refW;
  const dh = canvas.clientHeight || refH;
  if (canvas.width !== dw || canvas.height !== dh) {
    canvas.width = dw;
    canvas.height = dh;
  }
  const scale = Math.max(dw / refW, dh / refH);
  ctx.setTransform(scale, 0, 0, scale, (dw - refW * scale) * anchorX, (dh - refH * scale) * anchorY);
}
