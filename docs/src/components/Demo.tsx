import React, { Component, type ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-4 text-red-500 font-mono text-xs">
          Error: {(this.state.error as Error).message}
        </div>
      );
    }
    return this.props.children;
  }
}

interface DemoProps {
  title?: string;
  children: ReactNode;
}

export default function Demo({ title, children }: DemoProps) {
  return (
    <div className="border border-[var(--md-sys-color-outline-variant)] rounded-lg overflow-hidden my-4">
      {title && (
        <div className="px-4 py-2 text-xs font-semibold bg-[var(--md-sys-color-surface-container)] border-b border-[var(--md-sys-color-outline-variant)] text-[var(--md-sys-color-on-surface-variant)]">
          {title}
        </div>
      )}
      <div className="p-6 bg-[var(--md-sys-color-surface)]">
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </div>
  );
}
