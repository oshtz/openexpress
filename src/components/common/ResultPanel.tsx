import { useState } from "react";
import { Check, Clipboard, FolderOpen } from "lucide-react";
import { copyImageToClipboard, isClipboardCopyableImage } from "../../lib/clipboard";
import { useAppStore } from "../../stores/appStore";

interface ResultPanelProps {
  outputPath: string;
  stats?: { label: string; value: string }[];
  onOpenFolder?: () => void;
}

export function ResultPanel({ outputPath, stats, onOpenFolder }: ResultPanelProps) {
  const pushToast = useAppStore((s) => s.pushToast);
  const [copied, setCopied] = useState(false);
  const canCopy = isClipboardCopyableImage(outputPath);

  const handleCopy = async () => {
    try {
      await copyImageToClipboard(outputPath);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      pushToast("error", "Couldn't copy image to clipboard");
    }
  };

  return (
    <div
      className="animate-fade-in-up"
      style={{
        border: "1px solid var(--color-border)",
        borderLeft: "4px solid var(--color-accent-gold)",
        background: "var(--color-bg-secondary)",
        padding: "20px 24px",
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <Check
          size={16}
          strokeWidth={2}
          style={{ color: "var(--color-accent-gold)" }}
        />
        <span
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "var(--color-text)",
          }}
        >
          Done
        </span>
      </div>

      <p
        className="break-all"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          lineHeight: 1.6,
          color: "var(--color-text-secondary)",
        }}
      >
        {outputPath}
      </p>

      {stats && stats.length > 0 && (
        <div className="grid grid-cols-12 gap-4 mt-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="col-span-6 md:col-span-3 border-l border-border pl-3"
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--color-text-muted)",
                }}
              >
                {s.label}
              </div>
              <div
                className="mt-1 tabular-nums"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 16,
                  color: "var(--color-text)",
                }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {(onOpenFolder || canCopy) && (
        <div className="mt-5 flex items-center gap-5">
          {onOpenFolder && (
            <button onClick={onOpenFolder} className="swiss-link">
              <FolderOpen size={12} strokeWidth={1.5} />
              Open folder
            </button>
          )}
          {canCopy && (
            <button
              onClick={handleCopy}
              className="swiss-link"
              aria-label="Copy image to clipboard"
            >
              {copied ? (
                <>
                  <Check size={12} strokeWidth={1.5} />
                  Copied
                </>
              ) : (
                <>
                  <Clipboard size={12} strokeWidth={1.5} />
                  Copy to clipboard
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
