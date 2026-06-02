"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const BLOCKS = 22;
const FILL_MS = 1600;

/** Retro boot splash shown once per session, then wipes away to the desktop. */
export function BootSplash() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("vs-booted")) {
      setVisible(false);
      return;
    }
    sessionStorage.setItem("vs-booted", "1");

    if (reduce) {
      const timer = setTimeout(() => setVisible(false), 500);
      return () => clearTimeout(timer);
    }

    const start = performance.now();
    let raf = 0;
    const tick = (now: number): void => {
      const p = Math.min(1, (now - start) / FILL_MS);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else raf = requestAnimationFrame(() => setVisible(false));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const filled = Math.round(progress * BLOCKS);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-label="Loading VOICESCREEN.SCR"
          onClick={() => setVisible(false)}
          className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center bg-[#0a0618] text-white"
          initial={false}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-9 w-9 grid-cols-2 grid-rows-2 gap-0.5">
              <span className="bg-[#ff6fb5]" />
              <span className="bg-[#b06bff]" />
              <span className="bg-[#5fd0ff]" />
              <span className="bg-[#ffe066]" />
            </span>
            <h1 className="text-2xl font-bold tracking-[0.3em]">
              VOICESCREEN<span className="opacity-60">.SCR</span>
            </h1>
          </div>
          <p className="mt-2 text-xs tracking-[0.35em] text-w95-silver opacity-75">A VOICE YOU CAN SEE</p>
          <div className="bevel-inset mt-7 flex gap-0.5 bg-[#140a28] p-1">
            {Array.from({ length: BLOCKS }, (_, i) => (
              <span
                key={i}
                className="h-3.5 w-2"
                style={{ backgroundColor: i < filled ? "#5cb8ff" : "#241640" }}
              />
            ))}
          </div>
          <p className="mt-4 text-[10px] tracking-[0.3em] text-w95-silver opacity-40">CLICK TO CONTINUE</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
