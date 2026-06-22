import { useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";

interface BeforeAfterProps {
  beforePath: string;
  afterPath: string;
  /** Optional ?v=cache-buster appended to the after image src so the new file isn't read from the WebView cache. */
  cacheBuster?: number | string;
}

/**
 * Side-by-side preview with a draggable vertical splitter. Mouse / touch drag
 * exposes more or less of the "after" image over the "before".
 */
export function BeforeAfter({ beforePath, afterPath, cacheBuster }: BeforeAfterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const draggingRef = useRef(false);

  const updateFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.max(0, Math.min(100, pct)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const onHandleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const delta = e.key === "ArrowLeft" ? -5 : 5;
    setPosition((p) => Math.max(0, Math.min(100, p + delta)));
  };

  const buster = cacheBuster != null ? `?v=${cacheBuster}` : "";
  const transparencyBackdrop = {
    backgroundColor: "var(--color-checker-bg)",
    backgroundImage:
      "linear-gradient(45deg, var(--color-checker-fg) 25%, transparent 25%), linear-gradient(-45deg, var(--color-checker-fg) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--color-checker-fg) 75%), linear-gradient(-45deg, transparent 75%, var(--color-checker-fg) 75%)",
    backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0",
    backgroundSize: "12px 12px",
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="relative overflow-hidden bg-bg-secondary border border-border-subtle select-none animate-fade-in-up touch-none"
      style={{ aspectRatio: "16 / 9", maxHeight: 400, cursor: "ew-resize" }}
    >
      {/* Before (full width) */}
      <img
        src={convertFileSrc(beforePath)}
        alt="Before"
        className="absolute inset-0 w-full h-full object-contain"
        draggable={false}
      />

      {/* After (right side, clipped to splitter position) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          ...transparencyBackdrop,
          clipPath: `inset(0 0 0 ${position}%)`,
        }}
      >
        <img
          src={convertFileSrc(afterPath) + buster}
          alt="After"
          className="absolute inset-0 w-full h-full object-contain"
          draggable={false}
        />
      </div>

      {/* Splitter line + handle */}
      <div
        className="absolute top-0 bottom-0 w-px bg-white pointer-events-none"
        style={{ left: `${position}%` }}
      />
      <div
        role="slider"
        tabIndex={0}
        aria-label="Comparison splitter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        onKeyDown={onHandleKeyDown}
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 bg-white border-2 border-primary flex items-center justify-center pointer-events-none"
        style={{ left: `${position}%` }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" className="text-primary">
          <path d="M5 2L2 7l3 5M9 2l3 5-3 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/60 text-white text-[10px] font-medium tracking-wide uppercase pointer-events-none">
        Before
      </div>
      <div className="absolute top-3 right-3 px-2 py-0.5 bg-black/60 text-white text-[10px] font-medium tracking-wide uppercase pointer-events-none">
        After
      </div>
    </div>
  );
}
