import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "../ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        className="surface-elevated p-8 mx-auto max-w-xl my-12 text-center"
        style={{ borderLeft: "4px solid var(--color-danger)" }}
      >
        <div className="w-12 h-12 mx-auto bg-danger-light flex items-center justify-center mb-4">
          <AlertTriangle className="text-danger" size={24} />
        </div>
        <h2 className="text-[16px] font-semibold text-text mb-2">Something went wrong</h2>
        <p className="text-[13px] text-text-secondary mb-1 break-words">
          {this.state.error.message}
        </p>
        <p className="text-[11px] text-text-muted font-mono mb-6">
          {this.state.error.name}
        </p>
        <Button onClick={this.reset} className="inline-flex items-center gap-2">
          <RotateCw size={14} />
          Reset
        </Button>
      </div>
    );
  }
}
