import React, { Component, type ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: "1rem", color: "red", fontFamily: "monospace", fontSize: 12 }}>
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
    <div
      style={{
        border: "1px solid var(--md-sys-color-outline-variant)",
        borderRadius: 8,
        overflow: "hidden",
        margin: "1rem 0",
      }}
    >
      {title && (
        <div
          style={{
            padding: "8px 16px",
            fontSize: 12,
            fontWeight: 600,
            background: "var(--md-sys-color-surface-container)",
            borderBottom: "1px solid var(--md-sys-color-outline-variant)",
            color: "var(--md-sys-color-on-surface-variant)",
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          padding: "1.5rem",
          background: "var(--md-sys-color-surface)",
        }}
      >
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </div>
  );
}
