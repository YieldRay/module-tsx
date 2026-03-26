import React, { useState } from "react";
import { TopAppBar, IconButton } from "soda-material";
import { useWindowSizeType } from "soda-material/dist/hooks/use-media-query";
import { mdiMenu, mdiGithub } from "@mdi/js";
import type { NavSection } from "../App.tsx";

interface LayoutProps {
  navSections: NavSection[];
  currentHash: string;
  onNavigate: (hash: string) => void;
  children: React.ReactNode;
}

function Sidebar({
  navSections,
  currentHash,
  onNavigate,
}: Pick<LayoutProps, "navSections" | "currentHash" | "onNavigate">) {
  return (
    <nav
      style={{
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem 0 2rem",
        gap: 0,
      }}
    >
      {navSections.map((section) => (
        <div key={section.title} style={{ marginBottom: "1.25rem" }}>
          {/* Section label */}
          <div
            style={{
              padding: "0 1.5rem 0.4rem",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--md-sys-color-on-surface-variant)",
              opacity: 0.6,
            }}
          >
            {section.title}
          </div>

          {/* Nav items */}
          {section.items.map((item) => {
            const active = currentHash === item.hash;
            return (
              <a
                key={item.hash}
                href={item.hash}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(item.hash);
                }}
                style={{
                  display: "block",
                  padding: "0.45rem 1.5rem",
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active
                    ? "var(--md-sys-color-primary)"
                    : "var(--md-sys-color-on-surface-variant)",
                  textDecoration: "none",
                  borderLeft: `2px solid ${active ? "var(--md-sys-color-primary)" : "transparent"}`,
                  background: active ? "var(--md-sys-color-primary-container)" : "transparent",
                  transition: "color 150ms, background 150ms, border-color 150ms",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.color =
                      "var(--md-sys-color-on-surface)";
                    (e.currentTarget as HTMLAnchorElement).style.background =
                      "var(--md-sys-color-surface-container)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.color =
                      "var(--md-sys-color-on-surface-variant)";
                    (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  }
                }}
              >
                {item.label}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function Layout({ navSections, currentHash, onNavigate, children }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const sizeType = useWindowSizeType();
  const isExpanded = sizeType === "expanded";

  const handleNavClick = (hash: string) => {
    location.hash = hash;
    onNavigate(hash);
    setDrawerOpen(false);
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        overflow: "hidden",
        background: "var(--md-sys-color-surface)",
      }}
    >
      {/* Desktop sidebar */}
      {isExpanded && (
        <aside
          style={{
            width: 240,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            borderRight: "1px solid var(--md-sys-color-outline-variant)",
            overflowY: "auto",
          }}
        >
          {/* Logo */}
          <div
            style={{
              padding: "1.25rem 1.5rem 0.75rem",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--md-sys-color-on-surface)",
              borderBottom: "1px solid var(--md-sys-color-outline-variant)",
            }}
          >
            module-tsx
          </div>
          <Sidebar
            navSections={navSections}
            currentHash={currentHash}
            onNavigate={handleNavClick}
          />
        </aside>
      )}

      {/* Mobile drawer overlay */}
      {!isExpanded && drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.32)",
              zIndex: 100,
            }}
          />
          <aside
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              bottom: 0,
              width: 280,
              background: "var(--md-sys-color-surface)",
              borderRight: "1px solid var(--md-sys-color-outline-variant)",
              overflowY: "auto",
              zIndex: 101,
            }}
          >
            <div
              style={{
                padding: "1.25rem 1.5rem 0.75rem",
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--md-sys-color-on-surface)",
                borderBottom: "1px solid var(--md-sys-color-outline-variant)",
              }}
            >
              module-tsx
            </div>
            <Sidebar
              navSections={navSections}
              currentHash={currentHash}
              onNavigate={handleNavClick}
            />
          </aside>
        </>
      )}

      {/* Main column */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopAppBar
          leadingNavigationIcon={
            !isExpanded ? (
              <IconButton path={mdiMenu} onClick={() => setDrawerOpen((v) => !v)} />
            ) : undefined
          }
          trailingIcon={
            <IconButton
              path={mdiGithub}
              onClick={() => window.open("https://github.com/YieldRay/module-tsx", "_blank")}
            />
          }
        >
          module-tsx
        </TopAppBar>
        <main className="sd-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
          <div style={{ maxWidth: 860, margin: "0 auto", padding: "2rem 1.5rem 4rem" }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
