import { useNavigate } from "react-router-dom";
import { useAppStore } from "../../stores/appStore";

export function StatusBar() {
  const navigate = useNavigate();
  const jobs = useAppStore((state) => state.jobs);
  const outputDir = useAppStore((state) => state.outputDir);
  const activeJobs = jobs.filter((job) => job.status === "running").length;
  const completedJobs = jobs.filter((job) => job.status === "succeeded").length;

  return (
    <footer className="app-statusbar">
      <div className="status-path" aria-label="Current workspace">
        <span>OPENEXPRESS&gt;</span>
        <span title={outputDir || "Local workspace"}>{outputDir || "Local workspace"}</span>
        <span className="terminal-cursor" aria-hidden />
      </div>

      <div className="status-shortcuts">
        <button type="button" onClick={() => navigate("/")}>
          <kbd>F1</kbd> Home
        </button>
        <button type="button" onClick={() => navigate("/settings")}>
          <kbd>F2</kbd> Settings
        </button>
        <button type="button" onClick={() => navigate("/?view=queue")}>
          <kbd>F3</kbd> Queue
        </button>
      </div>

      <div className="status-metrics" aria-label="Application status">
        <span>Status: <strong>{activeJobs > 0 ? "Working" : "Idle"}</strong></span>
        <span>{activeJobs} Active</span>
        <span>{completedJobs} Done</span>
      </div>
    </footer>
  );
}
