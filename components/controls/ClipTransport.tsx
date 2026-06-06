"use client";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Play/pause + scrubber + time readout for the selected clip. Presentational — the parent's
 * {@link useClipPlayback} hook owns the transport state and handlers.
 */
export function ClipTransport({
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onSeekDown,
  onSeekMove,
  onSeekUp,
}: {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onSeekDown: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSeekMove: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onSeekUp: (event: React.PointerEvent<HTMLButtonElement>) => void;
}) {
  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="bevel-raised active:bevel-pressed flex h-6 w-8 items-center justify-center bg-w95-silver text-black focus-visible:outline focus-visible:outline-1 focus-visible:outline-dotted focus-visible:outline-black focus-visible:-outline-offset-2"
      >
        {isPlaying ? "❚❚" : "▶"}
      </button>
      <button
        type="button"
        aria-label="Seek"
        onPointerDown={onSeekDown}
        onPointerMove={onSeekMove}
        onPointerUp={onSeekUp}
        className="bevel-inset relative h-3 flex-1 cursor-pointer touch-none bg-white"
      >
        <div
          className="absolute inset-y-0 left-0 bg-w95-navy"
          style={{ width: `${progress * 100}%` }}
        />
      </button>
      <span className="w-20 shrink-0 text-right tabular-nums">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
}
