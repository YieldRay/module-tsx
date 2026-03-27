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
    <nav className="flex flex-col py-6 pb-8">
      {navSections.map((section) => (
        <div key={section.title} className="mb-5">
          <div className="px-6 pb-1.5 text-[11px] font-bold tracking-widest uppercase text-[var(--md-sys-color-on-surface-variant)] opacity-60">
            {section.title}
          </div>
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
                className={[
                  "block px-6 py-1.5 text-sm no-underline transition-colors duration-150 border-l-2",
                  active
                    ? "font-semibold text-[var(--md-sys-color-primary)] border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-primary-container)]"
                    : "font-normal text-[var(--md-sys-color-on-surface-variant)] border-transparent bg-transparent hover:text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container)]",
                ].join(" ")}
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
    <div className="flex h-screen overflow-hidden bg-[var(--md-sys-color-surface)]">
      {/* Desktop sidebar */}
      {isExpanded && (
        <aside className="w-60 shrink-0 flex flex-col border-r border-[var(--md-sys-color-outline-variant)] overflow-y-auto">
          <div className="px-6 pt-5 pb-3 text-sm font-bold tracking-tight text-[var(--md-sys-color-on-surface)] border-b border-[var(--md-sys-color-outline-variant)]">
            module-tsx
          </div>
          <Sidebar navSections={navSections} currentHash={currentHash} onNavigate={handleNavClick} />
        </aside>
      )}

      {/* Mobile drawer overlay */}
      {!isExpanded && drawerOpen && (
        <>
          <div
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 bg-black/30 z-[100]"
          />
          <aside className="fixed inset-y-0 left-0 w-70 bg-[var(--md-sys-color-surface)] border-r border-[var(--md-sys-color-outline-variant)] overflow-y-auto z-[101]">
            <div className="px-6 pt-5 pb-3 text-sm font-bold tracking-tight text-[var(--md-sys-color-on-surface)] border-b border-[var(--md-sys-color-outline-variant)]">
              module-tsx
            </div>
            <Sidebar navSections={navSections} currentHash={currentHash} onNavigate={handleNavClick} />
          </aside>
        </>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col overflow-hidden">
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
        <main className="sd-scrollbar flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 pt-8 pb-16">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
