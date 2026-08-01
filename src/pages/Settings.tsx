import { SettingsCog } from "pixelarticons/react";
import { useAppStore } from "../stores/appStore";
import { OutputPath } from "../components/common/OutputPath";
import { ToolPage } from "../components/common/ToolPage";
import { DiagnosticsPanel } from "../components/common/DiagnosticsPanel";
import { ShellIntegrationPanel } from "../components/common/ShellIntegrationPanel";
import { UpdatePanel } from "../components/common/UpdatePanel";

export function Settings() {
  const { accentColor, setAccentColor, uiScale, setUiScale, outputDir, setOutputDir } = useAppStore();

  const accents = ["#1597ff", "#b7ff35", "#ffb21a", "#ff4f91", "#a78bfa"];

  return (
    <ToolPage
      title="Settings"
      description="Configure OpenExpress preferences"
      icon={<SettingsCog width={22} height={22} />}
    >
      <div className="surface-elevated p-6">
        <div className="swiss-label mb-3">Appearance</div>
        <div className="accent-setting">
          <label>
            <span>Accent color</span>
            <input
              type="color"
              aria-label="Accent color"
              value={accentColor}
              onChange={(event) => setAccentColor(event.target.value)}
            />
          </label>
          <div className="accent-presets" aria-label="Accent color presets">
            {accents.map((color) => (
              <button
                type="button"
                key={color}
                aria-label={`Use ${color} accent`}
                aria-pressed={accentColor.toLowerCase() === color}
                onClick={() => setAccentColor(color)}
                style={{ background: color }}
              />
            ))}
          </div>
          <output>{accentColor.toUpperCase()}</output>
        </div>
        <div className="ui-scale-setting">
          <label htmlFor="ui-scale">UI scale</label>
          <input
            id="ui-scale"
            type="range"
            min="80"
            max="140"
            step="10"
            value={uiScale}
            onChange={(event) => setUiScale(Number(event.target.value))}
          />
          <output htmlFor="ui-scale">{uiScale}%</output>
          <button type="button" disabled={uiScale === 100} onClick={() => setUiScale(100)}>
            Reset
          </button>
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
