"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** Beveled Win95 push button. Raised by default, pressed on :active, dotted focus ring. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "bevel-raised active:bevel-pressed",
        "min-w-[75px] select-none bg-w95-silver px-3 py-1 text-sm leading-none text-black",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:-outline-offset-4",
        "disabled:cursor-default disabled:text-w95-gray",
        className,
      )}
      {...props}
    />
  );
});

/** Small square title-bar control (minimize / close). Stops pointer-down so it never starts a window drag. */
export function TitleBarButton({
  label,
  glyph,
  onClick,
}: {
  label: string;
  glyph: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onPointerDown={(event) => event.stopPropagation()}
      className={cn(
        "flex h-[18px] w-4 items-center justify-center bevel-raised active:bevel-pressed",
        "bg-w95-silver text-[10px] font-bold leading-none text-black",
        "focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:-outline-offset-2",
      )}
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}
