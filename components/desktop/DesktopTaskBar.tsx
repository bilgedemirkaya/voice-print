"use client";

import { TaskBar } from "@/components/retro/TaskBar";
import { cn } from "@/lib/cn";

/** The taskbar with the single VOICEPRINT.SCR window tab (pressed while the window is open). */
export function DesktopTaskBar({
  windowOpen,
  onToggleWindow,
  onStartClick,
}: {
  windowOpen: boolean;
  onToggleWindow: () => void;
  onStartClick: () => void;
}) {
  return (
    <TaskBar onStartClick={onStartClick}>
      <button
        type="button"
        onClick={onToggleWindow}
        className={cn(
          "flex h-7 min-w-[170px] items-center gap-2 bg-w95-silver px-2 text-left text-sm",
          windowOpen ? "bevel-pressed" : "bevel-raised",
        )}
      >
        <span aria-hidden className="grid h-3.5 w-3.5 grid-cols-2 grid-rows-2 gap-px">
          <span className="bg-[#ff6fb5]" />
          <span className="bg-[#b06bff]" />
          <span className="bg-[#5fd0ff]" />
          <span className="bg-[#ffe066]" />
        </span>
        <span className="truncate">VOICEPRINT.SCR</span>
      </button>
    </TaskBar>
  );
}
