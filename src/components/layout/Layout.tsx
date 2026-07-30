import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Titlebar } from "./Titlebar";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { ToastContainer } from "../common/ToastContainer";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts";
import { useLaunchAction } from "../../hooks/useLaunchAction";
import { JobTray } from "./JobTray";

export function Layout() {
  useKeyboardShortcuts();
  useLaunchAction();
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg">
      <Titlebar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex-1 overflow-y-auto">
            {/* Swiss "page" wrapper — hairline left/right rules, generous gutter. */}
            <div className="max-w-[1440px] mx-auto px-8 py-10 border-l border-r border-border-subtle min-h-full">
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </div>
          </main>
          <JobTray />
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
