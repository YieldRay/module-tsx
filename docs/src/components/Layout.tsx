import React, { useState } from "react";
import { TopAppBar, IconButton, NavigationDrawer, NavigationDrawerItem, Divider } from "soda-material";
import { useWindowSizeType } from "soda-material/dist/hooks/use-media-query";
import { mdiMenu, mdiGithub } from "@mdi/js";
import Icon from "./Icon.tsx";
import type { NavSection } from "../App.tsx";

interface LayoutProps {
  navSections: NavSection[];
  currentHash: string;
  onNavigate: (hash: string) => void;
  children: React.ReactNode;
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
      <NavigationDrawer
        open={isExpanded || drawerOpen}
        headline="module-tsx"
        modal={!isExpanded}
        onScrimClick={() => setDrawerOpen(false)}
      >
        {navSections.map((section, i) => (
          <React.Fragment key={section.title}>
            {i > 0 && <Divider />}
            {section.items.map((item) => (
              <NavigationDrawerItem
                key={item.hash}
                active={currentHash === item.hash}
                icon={<Icon path={item.icon} size={1} />}
                onClick={() => handleNavClick(item.hash)}
              >
                {item.label}
              </NavigationDrawerItem>
            ))}
          </React.Fragment>
        ))}
      </NavigationDrawer>

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
