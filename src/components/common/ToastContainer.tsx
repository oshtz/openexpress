import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useAppStore, type Toast } from "../../stores/appStore";

const ICONS = {
  info: <Info size={16} className="text-accent" />,
  success: <CheckCircle2 size={16} className="text-success-ink" />,
  error: <AlertTriangle size={16} className="text-danger" />,
};

const ACCENT_BY_KIND = {
  info: "var(--color-accent)",
  success: "var(--color-success)",
  error: "var(--color-danger)",
} as const;

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}

const TOAST_DURATION_MS = 5000;

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useAppStore((s) => s.dismissToast);

  useEffect(() => {
    const timeout = setTimeout(() => dismiss(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [toast.id, dismiss]);

  return (
    <div
      className="pointer-events-auto relative bg-bg-secondary border border-border flex items-start gap-3 px-4 py-3 max-w-sm animate-slide-in"
      style={{ borderLeft: `4px solid ${ACCENT_BY_KIND[toast.kind]}` }}
    >
      <div className="mt-0.5 shrink-0">{ICONS[toast.kind]}</div>
      <div className="text-[13px] text-text leading-snug flex-1 break-words">
        {toast.message}
      </div>
      <button
        onClick={() => dismiss(toast.id)}
        className="text-text-muted hover:text-text shrink-0 mt-0.5"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
      {/* Hairline countdown — drains in sync with the auto-dismiss timer. */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: 2,
          background: ACCENT_BY_KIND[toast.kind],
          transformOrigin: "left",
          animation: `toast-countdown ${TOAST_DURATION_MS}ms linear forwards`,
        }}
      />
    </div>
  );
}
