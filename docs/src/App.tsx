import React, { useState, useEffect } from "react";
import {
  mdiRocketLaunch,
  mdiFlash,
  mdiLanguageTypescript,
  mdiFileCode,
  mdiPalette,
  mdiApi,
  mdiPlayCircleOutline,
} from "@mdi/js";
import Layout from "./components/Layout.tsx";
import GettingStarted from "./pages/GettingStarted.tsx";
import BasicUsage from "./pages/BasicUsage.tsx";
import TypeScriptSupport from "./pages/TypeScriptSupport.tsx";
import LoadingFiles from "./pages/LoadingFiles.tsx";
import CssModules from "./pages/CssModules.tsx";
import ApiReference from "./pages/ApiReference.tsx";
import Examples from "./pages/Examples.tsx";

export interface NavItem {
  label: string;
  hash: string;
  icon: string;
  component: React.ComponentType;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Introduction",
    items: [
      { label: "Getting Started", hash: "#getting-started", icon: mdiRocketLaunch, component: GettingStarted },
      { label: "Basic Usage", hash: "#basic-usage", icon: mdiFlash, component: BasicUsage },
    ],
  },
  {
    title: "Features",
    items: [
      { label: "TypeScript Support", hash: "#typescript", icon: mdiLanguageTypescript, component: TypeScriptSupport },
      { label: "Loading Files", hash: "#loading-files", icon: mdiFileCode, component: LoadingFiles },
      { label: "CSS & CSS Modules", hash: "#css-modules", icon: mdiPalette, component: CssModules },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "API Reference", hash: "#api-reference", icon: mdiApi, component: ApiReference },
      { label: "Examples", hash: "#examples", icon: mdiPlayCircleOutline, component: Examples },
    ],
  },
];

function getInitialHash() {
  return location.hash || "#getting-started";
}

export default function App() {
  const [currentHash, setCurrentHash] = useState(getInitialHash);

  useEffect(() => {
    const handler = () => setCurrentHash(location.hash || "#getting-started");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const allItems = NAV_SECTIONS.flatMap((s) => s.items);
  const activeItem = allItems.find((i) => i.hash === currentHash) ?? allItems[0];
  const PageComponent = activeItem.component;

  return (
    <Layout navSections={NAV_SECTIONS} currentHash={currentHash} onNavigate={setCurrentHash}>
      <PageComponent />
    </Layout>
  );
}
