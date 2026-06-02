"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "./Button";

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Win95 taskbar: Start button (with the four-color flag) on the left, a live clock on the right. */
export function TaskBar({
  onStartClick,
  children,
}: {
  onStartClick?: () => void;
  children?: ReactNode;
}) {
  // Start empty so the server render and the first client render match; fill in the
  // time only after mount to avoid a Date-based hydration mismatch.
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setTime(formatTime(new Date()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 flex h-9 items-center gap-1 bevel-raised bg-w95-silver px-1">
      <Button onClick={onStartClick} className="flex items-center gap-1.5 font-bold">
        <span aria-hidden="true" className="grid h-4 w-4 grid-cols-2 grid-rows-2 gap-[1px]">
          <span className="bg-[#ff6fb5]" />
          <span className="bg-[#b06bff]" />
          <span className="bg-[#5fd0ff]" />
          <span className="bg-[#ffe066]" />
        </span>
        Start
      </Button>
      <div className="flex flex-1 items-center gap-1 overflow-hidden px-1">{children}</div>
      <div className="bevel-inset px-3 py-1 text-xs tabular-nums" role="status" aria-label="Clock">
        <time suppressHydrationWarning>{time ?? " "}</time>
      </div>
    </footer>
  );
}
