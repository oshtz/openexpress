import { useRef, useCallback, useEffect, useState } from "react";

interface TrimTimelineProps {
  duration: number;
  start: number;
  end: number;
  currentTime?: number;
  onChange: (start: number, end: number) => void;
  onSeek?: (time: number) => void;
}

function formatTime(secs: number): string {
  if (!isFinite(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 10);
  return `${m}:${s.toString().padStart(2, "0")}.${ms}`;
}

export function TrimTimeline({
  duration,
  start,
  end,
  currentTime = 0,
  onChange,
  onSeek,
}: TrimTimelineProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  const getTimeFromX = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track || duration <= 0) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(ratio * duration * 10) / 10;
    },
    [duration],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, handle: "start" | "end") => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(handle);
    },
    [],
  );

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) return;
      const time = getTimeFromX(e.clientX);
      onSeek?.(time);
    },
    [dragging, getTimeFromX, onSeek],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, handle: "start" | "end") => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      const pct = e.shiftKey ? 0.05 : 0.01;
      const step = Math.max(0.1, duration * pct);
      const delta = e.key === "ArrowLeft" ? -step : step;
      if (handle === "start") {
        onChange(Math.max(0, Math.min(start + delta, end - 0.5)), end);
      } else {
        onChange(start, Math.min(duration, Math.max(end + delta, start + 0.5)));
      }
    },
    [duration, start, end, onChange],
  );

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: globalThis.MouseEvent) => {
      const time = getTimeFromX(e.clientX);
      if (dragging === "start") {
        onChange(Math.min(time, end - 0.5), end);
      } else {
        onChange(start, Math.max(time, start + 0.5));
      }
    };

    const handleMouseUp = () => setDragging(null);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, start, end, getTimeFromX, onChange]);

  if (duration <= 0) return null;

  const startPct = (start / duration) * 100;
  const endPct = (end / duration) * 100;
  const playheadPct = (currentTime / duration) * 100;

  return (
    <div className="surface-elevated p-4 space-y-2 animate-fade-in-up">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-text-muted uppercase tracking-wide">
          Timeline
        </span>
        <span className="text-[12px] font-semibold text-primary tabular-nums">
          {formatTime(end - start)} selected
        </span>
      </div>

      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative h-12 bg-bg-tertiary cursor-pointer select-none overflow-visible"
      >
        {/* Inactive regions */}
        <div
          className="absolute inset-y-0 left-0 bg-black/15 dark:bg-black/30 z-[1]"
          style={{ width: `${startPct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-black/15 dark:bg-black/30 z-[1]"
          style={{ width: `${100 - endPct}%` }}
        />

        {/* Active region */}
        <div
          className="absolute inset-y-0 bg-primary/15 border-y-2 border-primary/30"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-text z-[5] pointer-events-none"
          style={{ left: `${playheadPct}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-text" />
        </div>

        {/* Start handle */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Trim start"
          aria-valuemin={0}
          aria-valuemax={Math.round((end - 0.5) * 100) / 100}
          aria-valuenow={Math.round(start * 100) / 100}
          aria-valuetext={formatTime(start)}
          className={`absolute top-0 bottom-0 w-3.5 cursor-ew-resize z-[6] flex items-center justify-center transition-colors ${
            dragging === "start" ? "bg-primary-hover" : "bg-primary hover:bg-primary-hover"
          }`}
          style={{ left: `calc(${startPct}% - 7px)` }}
          onMouseDown={(e) => handleMouseDown(e, "start")}
          onKeyDown={(e) => handleKeyDown(e, "start")}
        >
          <div className="w-[3px] h-5 bg-white/70 pointer-events-none" />
        </div>

        {/* End handle */}
        <div
          role="slider"
          tabIndex={0}
          aria-label="Trim end"
          aria-valuemin={Math.round((start + 0.5) * 100) / 100}
          aria-valuemax={Math.round(duration * 100) / 100}
          aria-valuenow={Math.round(end * 100) / 100}
          aria-valuetext={formatTime(end)}
          className={`absolute top-0 bottom-0 w-3.5 cursor-ew-resize z-[6] flex items-center justify-center transition-colors ${
            dragging === "end" ? "bg-primary-hover" : "bg-primary hover:bg-primary-hover"
          }`}
          style={{ left: `calc(${endPct}% - 7px)` }}
          onMouseDown={(e) => handleMouseDown(e, "end")}
          onKeyDown={(e) => handleKeyDown(e, "end")}
        >
          <div className="w-[3px] h-5 bg-white/70 pointer-events-none" />
        </div>
      </div>

      {/* Time labels */}
      <div className="flex justify-between text-[12px] tabular-nums">
        <span className="text-primary font-medium">{formatTime(start)}</span>
        <span className="text-text-muted">{formatTime(duration)}</span>
        <span className="text-primary font-medium">{formatTime(end)}</span>
      </div>
    </div>
  );
}
