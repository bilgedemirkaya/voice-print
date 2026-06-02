"use client";

/**
 * Subtle CRT treatment over the whole desktop: scanlines + vignette. Tasteful and static
 * (no flicker), pointer-events-none. The caller passes `enabled = crtEnabled && !reducedMotion`.
 */
export function CrtOverlay({ enabled }: { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
      <div
        className="absolute inset-0"
        style={{
          background:
            "repeating-linear-gradient(0deg, rgba(0,0,0,0.16) 0px, rgba(0,0,0,0.16) 1px, transparent 1px, transparent 3px)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,0.38) 100%)",
        }}
      />
    </div>
  );
}
