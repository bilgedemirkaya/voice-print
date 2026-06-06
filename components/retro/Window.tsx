"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { TitleBarButton } from "./Button";

export type WindowProps = {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  maximized?: boolean;
  width?: number;
  height?: number;
  /** Show a bottom-right grip to resize the window. */
  resizable?: boolean;
  minWidth?: number;
  minHeight?: number;
  /** Fill the parent container (maximized): no drag/resize, no fixed size. */
  fill?: boolean;
  className?: string;
};

/**
 * Draggable (and optionally resizable) Win95 window. Position/size are held in Framer motion
 * values so interaction never triggers React re-renders. Open/close fades + scales, damped under
 * reduced-motion. With `fill` it maximizes to its parent instead.
 */
export function Window({
  title,
  children,
  onClose,
  onMinimize,
  onMaximize,
  maximized = false,
  width = 480,
  height = 420,
  resizable = false,
  minWidth = 320,
  minHeight = 240,
  fill = false,
  className,
}: WindowProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const w = useMotionValue(width);
  const h = useMotionValue(height);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const resize = useRef<{ px: number; py: number; ow: number; oh: number } | null>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    w.set(width);
  }, [w, width]);

  useEffect(() => {
    h.set(height);
  }, [h, height]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    drag.current = { px: event.clientX, py: event.clientY, ox: x.get(), oy: y.get() };
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = drag.current;
    if (!state) return;
    x.set(state.ox + event.clientX - state.px);
    y.set(state.oy + event.clientY - state.py);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    drag.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function handleResizeDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    resize.current = { px: event.clientX, py: event.clientY, ow: w.get(), oh: h.get() };
  }

  function handleResizeMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = resize.current;
    if (!state) return;
    w.set(Math.max(minWidth, state.ow + event.clientX - state.px));
    h.set(Math.max(minHeight, state.oh + event.clientY - state.py));
  }

  function handleResizeUp(event: ReactPointerEvent<HTMLDivElement>) {
    resize.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  // When maximized, set explicit 100% size + reset position. Using `undefined` here would leave
  // Framer's previously-applied inline width/height/transform in place (window wouldn't grow).
  const motionStyle = fill
    ? { x: 0, y: 0, width: "100%", height: "100%" }
    : resizable
      ? { x, y, width: w, height: h }
      : { x, y, width, height };

  return (
    <motion.section
      aria-label={title}
      style={motionStyle}
      initial={reduce ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      className={cn(
        "relative flex flex-col bevel-raised select-none bg-w95-silver text-black drop-shadow-[0_12px_24px_rgba(120,70,180,0.35)]",
        fill && "h-full w-full",
        className,
      )}
    >
      <div
        data-testid="window-titlebar"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="titlebar flex shrink-0 cursor-default items-center gap-1 px-1 py-0.5"
      >
        <span className="flex-1 truncate px-1 text-sm font-bold text-white [text-shadow:0_1px_1px_rgba(74,28,110,0.55)]">
          {title}
        </span>
        {onMinimize && <TitleBarButton label="Minimize" glyph="_" onClick={onMinimize} />}
        {onMaximize && (
          <TitleBarButton
            label={maximized ? "Restore" : "Maximize"}
            glyph={maximized ? "❐" : "□"}
            onClick={onMaximize}
          />
        )}
        {onClose && <TitleBarButton label="Close" glyph="✕" onClick={onClose} />}
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-1">
        <div className="flex min-h-0 flex-1 flex-col bevel-inset bg-w95-silver p-3">{children}</div>
      </div>
      {resizable && !fill && (
        <div
          aria-hidden
          title="Drag to resize"
          onPointerDown={handleResizeDown}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeUp}
          className="absolute bottom-0.5 right-0.5 h-[18px] w-[18px] cursor-nwse-resize"
          style={{
            background:
              "repeating-linear-gradient(135deg, transparent 0 2px, #ffffff 2px 3px, transparent 3px 4px, #5b4a7a 4px 5px)",
          }}
        />
      )}
    </motion.section>
  );
}
