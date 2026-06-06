"use client";

import { ORIGINAL_TAKE_ID } from "@/lib/store/audioStore";
import type { Conversion } from "@/lib/types";
import { cn } from "@/lib/cn";

/** Short tab label from a long voice name, e.g. "Roger - Laid-Back, …" → "Roger". */
function shortVoiceName(name: string): string {
  return name.split(/\s*[-(]/)[0].trim() || name;
}

function Tab({
  active,
  onClick,
  title,
  "aria-label": ariaLabel,
  className,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title?: string;
  "aria-label"?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className={cn(
        "bg-w95-silver px-2 py-0.5",
        active ? "bevel-pressed" : "bevel-raised active:bevel-pressed",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * The A/B/C compare gallery: flip between "You" (original) and each converted voice, add a voice, or
 * start over. Presentational — the parent owns selection + the take list.
 */
export function CompareGallery({
  source,
  conversions,
  onSelect,
  onAddVoice,
  onStartOver,
}: {
  source: string;
  conversions: Conversion[];
  onSelect: (id: string) => void;
  onAddVoice?: () => void;
  onStartOver: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-w95-darkgray">Compare:</span>
      <Tab active={source === ORIGINAL_TAKE_ID} onClick={() => onSelect(ORIGINAL_TAKE_ID)}>
        You
      </Tab>
      {conversions.map((conversion) => (
        <Tab
          key={conversion.voiceId}
          active={source === conversion.voiceId}
          title={conversion.voiceName}
          onClick={() => onSelect(conversion.voiceId)}
        >
          {shortVoiceName(conversion.voiceName)}
        </Tab>
      ))}
      {onAddVoice && (
        <Tab aria-label="Add a voice" title="Add another voice" onClick={onAddVoice} className="font-bold">
          +
        </Tab>
      )}
      <Tab title="Discard the recording and all voices" onClick={onStartOver} className="ml-auto">
        ↺ Start over
      </Tab>
    </div>
  );
}
