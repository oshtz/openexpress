import { Settings as SettingsIcon, Moon, Sun, Monitor } from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { OutputPath } from "../components/common/OutputPath";
import { ToolPage } from "../components/common/ToolPage";
import { DiagnosticsPanel } from "../components/common/DiagnosticsPanel";
import { ShellIntegrationPanel } from "../components/common/ShellIntegrationPanel";
import { UpdatePanel } from "../components/common/UpdatePanel";

export function Settings() {
  const { theme, setTheme, outputDir, setOutputDir } = useAppStore();

  return (
    <ToolPage
      title="Settings"
      description="Configure OpenExpress preferences"
      icon={<SettingsIcon size={22} />}
    >
      {/* Theme */}
      <div className="surface-elevated p-6">
        <div className="swiss-label mb-3">Appearance</div>
        <div className="inline-flex border border-border" role="radiogroup" aria-label="Theme">
          {([
            { value: "light" as const, icon: <Sun size={13} />, label: "Light" },
            { value: "dark" as const, icon: <Moon size={13} />, label: "Dark" },
            { value: "system" as const, icon: <Monitor size={13} />, label: "System" },
          ]).map((opt) => {
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(opt.value)}
                className="flex items-center gap-2 px-4 py-2.5 border-l border-border first:border-l-0 transition-colors"
                style={{
                  background: active ? "var(--color-text)" : "transparent",
                  color: active ? "var(--color-bg-secondary)" : "var(--color-text-secondary)",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {opt.icon}
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Output */}
      <div className="surface-elevated p-6">
        <OutputPath
          value={outputDir}
          onChange={setOutputDir}
          label="Default Output Folder"
        />
      </div>

      {/* Shell integration */}
      <ShellIntegrationPanel />

      {/* Updates */}
      <UpdatePanel />

      {/* About */}
      <div className="surface-elevated p-6">
        <div className="swiss-label mb-2">About</div>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          OpenExpress - a free, open-source media toolkit. Built with Tauri, React, and Rust.
        </p>
      </div>

      {/* Diagnostics */}
      <DiagnosticsPanel />
    </ToolPage>
  );
}
