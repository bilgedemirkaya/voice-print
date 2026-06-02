"use client";

import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { motion, useMotionValue, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { TitleBarButton } from "./Button";

export type WindowProps = {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  onMinimize?: () => void;
  initialPosition?: { x: number; y: number };
  width?: number;
  className?: string;
};

/**
 * Draggable Win95 window. Drag is initiated only from the title bar; position is
 * held in Framer motion values so dragging never triggers a React re-render.
 * Open/close uses a subtle scale/opacity transition, damped under reduced-motion.
 */
export function Window({
  title,
  children,
  onClose,
  onMinimize,
  initialPosition = { x: 0, y: 0 },
  width = 480,
  className,
}: WindowProps) {
  const x = useMotionValue(initialPosition.x);
  const y = useMotionValue(initialPosition.y);
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const reduce = useReducedMotion();

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

  return (
    <motion.section
      aria-label={title}
      style={{ x, y, width }}
      initial={reduce ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.12, ease: "easeOut" }}
      className={cn(
        "bevel-raised select-none bg-w95-silver text-black drop-shadow-[0_12px_24px_rgba(120,70,180,0.35)]",
        className,
      )}
    >
      <div
        data-testid="window-titlebar"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="titlebar flex cursor-default items-center gap-1 px-1 py-0.5"
      >
        <span className="flex-1 truncate px-1 text-sm font-bold text-white [text-shadow:0_1px_1px_rgba(74,28,110,0.55)]">
          {title}
        </span>
        {onMinimize && <TitleBarButton label="Minimize" glyph="_" onClick={onMinimize} />}
        {onClose && <TitleBarButton label="Close" glyph="✕" onClick={onClose} />}
      </div>
      <div className="p-1">
        <div className="bevel-inset bg-w95-silver p-3">{children}</div>
      </div>
    </motion.section>
  );
}
