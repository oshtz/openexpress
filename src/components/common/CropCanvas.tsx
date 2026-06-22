import { useState, useRef, useCallback, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CropCanvasProps {
  path: string;
  aspectRatio: number | null;
  onChange: (crop: CropRect) => void;
}

type Handle = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

const CURSORS: Record<Handle, string> = {
  move: "cursor-move",
  n: "cursor-n-resize",
  s: "cursor-s-resize",
  e: "cursor-e-resize",
  w: "cursor-w-resize",
  nw: "cursor-nw-resize",
  ne: "cursor-ne-resize",
  sw: "cursor-sw-resize",
  se: "cursor-se-resize",
};

export function CropCanvas({ path, aspectRatio, onChange }: CropCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const dragRef = useRef<{
    handle: Handle;
    startMouse: { x: number; y: number };
    startCrop: CropRect;
  } | null>(null);

  const scale = naturalSize.w > 0 ? displaySize.w / naturalSize.w : 1;

  const toImageCoords = useCallback(
    (c: CropRect): CropRect => ({
      x: Math.round(c.x / scale),
      y: Math.round(c.y / scale),
      width: Math.round(c.width / scale),
      height: Math.round(c.height / scale),
    }),
    [scale],
  );

  const clamp = useCallback(
    (c: CropRect): CropRect => {
      const minSize = 16;
      let { x, y, width, height } = c;
      width = Math.max(minSize, Math.min(width, displaySize.w));
      height = Math.max(minSize, Math.min(height, displaySize.h));
      x = Math.max(0, Math.min(x, displaySize.w - width));
      y = Math.max(0, Math.min(y, displaySize.h - height));
      return { x, y, width, height };
    },
    [displaySize],
  );

  // Initialize crop when image loads
  const handleImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget;
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      setNaturalSize({ w: natW, h: natH });

      const container = containerRef.current;
      if (!container) return;
      const maxW = container.clientWidth;
      const maxH = 400;
      const s = Math.min(maxW / natW, maxH / natH, 1);
      const dw = Math.round(natW * s);
      const dh = Math.round(natH * s);
      setDisplaySize({ w: dw, h: dh });

      const margin = 0.1;
      let cw = Math.round(dw * (1 - 2 * margin));
      let ch = Math.round(dh * (1 - 2 * margin));
      if (aspectRatio) {
        ch = Math.round(cw / aspectRatio);
        if (ch > dh * 0.8) {
          ch = Math.round(dh * 0.8);
          cw = Math.round(ch * aspectRatio);
        }
      }
      const initCrop = {
        x: Math.round((dw - cw) / 2),
        y: Math.round((dh - ch) / 2),
        width: cw,
        height: ch,
      };
      setCrop(initCrop);
      onChange(toImageCoords(initCrop));
    },
    [aspectRatio, onChange, toImageCoords],
  );

  // Reset crop when aspect ratio prop changes. This is the documented
  // "derived state on prop change" pattern; the cascading-render rule does
  // not apply because the effect is guarded by an aspectRatio change.
  useEffect(() => {
    if (displaySize.w === 0) return;
    const dw = displaySize.w;
    const dh = displaySize.h;
    let cw = Math.round(dw * 0.8);
    let ch = Math.round(dh * 0.8);
    if (aspectRatio) {
      ch = Math.round(cw / aspectRatio);
      if (ch > dh * 0.8) {
        ch = Math.round(dh * 0.8);
        cw = Math.round(ch * aspectRatio);
      }
    }
    const newCrop = clamp({
      x: Math.round((dw - cw) / 2),
      y: Math.round((dh - ch) / 2),
      width: cw,
      height: ch,
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset on aspect change
    setCrop(newCrop);
    onChange(toImageCoords(newCrop));
  }, [aspectRatio, displaySize, clamp, onChange, toImageCoords]);

  // Drag start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, handle: Handle) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = {
        handle,
        startMouse: { x: e.clientX, y: e.clientY },
        startCrop: { ...crop },
      };
    },
    [crop],
  );

  // Drag move / up
  useEffect(() => {
    const handleMouseMove = (e: globalThis.MouseEvent) => {
      if (!dragRef.current) return;
      const { handle, startMouse, startCrop } = dragRef.current;
      const dx = e.clientX - startMouse.x;
      const dy = e.clientY - startMouse.y;

      let next = { ...startCrop };

      if (handle === "move") {
        next.x = startCrop.x + dx;
        next.y = startCrop.y + dy;
      } else {
        if (handle.includes("w")) {
          next.x = startCrop.x + dx;
          next.width = startCrop.width - dx;
        }
        if (handle.includes("e")) {
          next.width = startCrop.width + dx;
        }
        if (handle.includes("n")) {
          next.y = startCrop.y + dy;
          next.height = startCrop.height - dy;
        }
        if (handle.includes("s")) {
          next.height = startCrop.height + dy;
        }
        if (aspectRatio) {
          if (handle === "n" || handle === "s") {
            next.width = Math.round(next.height * aspectRatio);
          } else {
            next.height = Math.round(next.width / aspectRatio);
          }
        }
      }

      next = clamp(next);
      setCrop(next);
      onChange(toImageCoords(next));
    };

    const handleMouseUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [aspectRatio, clamp, onChange, toImageCoords]);

  const handles: { handle: Handle; top: number; left: number }[] =
    displaySize.w > 0
      ? [
          { handle: "nw", top: crop.y, left: crop.x },
          { handle: "ne", top: crop.y, left: crop.x + crop.width },
          { handle: "sw", top: crop.y + crop.height, left: crop.x },
          { handle: "se", top: crop.y + crop.height, left: crop.x + crop.width },
          { handle: "n", top: crop.y, left: crop.x + crop.width / 2 },
          { handle: "s", top: crop.y + crop.height, left: crop.x + crop.width / 2 },
          { handle: "w", top: crop.y + crop.height / 2, left: crop.x },
          { handle: "e", top: crop.y + crop.height / 2, left: crop.x + crop.width },
        ]
      : [];

  return (
    <div
      ref={containerRef}
      className="overflow-hidden bg-bg-secondary border border-border-subtle animate-fade-in-up"
    >
      <div
        className="relative mx-auto"
        style={{ width: displaySize.w || "100%", height: displaySize.h || "auto" }}
      >
        <img
          src={convertFileSrc(path)}
          alt="Crop preview"
          className="block"
          style={{ width: displaySize.w || "100%", height: displaySize.h || "auto" }}
          onLoad={handleImageLoad}
          draggable={false}
        />

        {displaySize.w > 0 && (
          <>
            {/* Dark overlay strips */}
            <div
              className="absolute bg-black/50 left-0 right-0 top-0"
              style={{ height: crop.y }}
            />
            <div
              className="absolute bg-black/50 left-0 right-0 bottom-0"
              style={{ height: displaySize.h - crop.y - crop.height }}
            />
            <div
              className="absolute bg-black/50"
              style={{
                top: crop.y,
                left: 0,
                width: crop.x,
                height: crop.height,
              }}
            />
            <div
              className="absolute bg-black/50"
              style={{
                top: crop.y,
                right: 0,
                width: displaySize.w - crop.x - crop.width,
                height: crop.height,
              }}
            />

            {/* Crop border + move area */}
            <div
              role="group"
              aria-label="Crop region"
              className="absolute border-2 border-white/80 cursor-move"
              style={{
                top: crop.y,
                left: crop.x,
                width: crop.width,
                height: crop.height,
              }}
              onMouseDown={(e) => handleMouseDown(e, "move")}
            >
              {/* Rule of thirds */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/20" />
                <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/20" />
                <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
                <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
              </div>
            </div>

            {/* Resize handles (pointer-only; hidden from the a11y tree) */}
            {handles.map(({ handle, top, left }) => (
              <div
                key={handle}
                aria-hidden="true"
                className={`absolute w-3 h-3 bg-white border-2 border-primary z-10 ${CURSORS[handle]}`}
                style={{
                  top: top - 6,
                  left: left - 6,
                }}
                onMouseDown={(e) => handleMouseDown(e, handle)}
              />
            ))}

            {/* Dimension label */}
            <div
              className="absolute left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/70 text-[11px] text-white tabular-nums pointer-events-none whitespace-nowrap"
              style={{ top: crop.y + crop.height + 8 }}
            >
              {Math.round(crop.width / scale)} &times; {Math.round(crop.height / scale)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
