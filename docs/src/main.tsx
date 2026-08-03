import React from "react";
import { createRoot } from "react-dom/client";
import "soda-material/dist/style.css";
import "@tailwindcss/browser";
import "./index.css";
import App from "./App.tsx";

const root = document.getElementById("root")!;
root.innerHTML = "";
createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
