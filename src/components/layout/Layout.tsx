import { Outlet, useLocation } from "react-router-dom";
import { Titlebar } from "./Titlebar";
import { StatusBar } from "./StatusBar";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { ToastContainer } from "../common/ToastContainer";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useLaunchAction } from "../../hooks/useLaunchAction";
import { JobTray } from "./JobTray";

export function Layout() {
  useKeyboardShortcuts();
  useLaunchAction();
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="app-shell">
      <Titlebar />
      <div className="app-content-shell">
        <main className={isHome ? "workbench-main" : "page-main"}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
        <JobTray />
      </div>
      <StatusBar />
      <ToastContainer />
    </div>
  );
}
