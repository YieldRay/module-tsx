import React from "react";
import { createRoot } from "react-dom/client";

import styles from "./index.module.css";
import App from "./App.tsx";

const root = document.getElementById("root")!;
createRoot(root).render(
  <React.StrictMode>
    <App className={styles.app} />
  </React.StrictMode>,
);
