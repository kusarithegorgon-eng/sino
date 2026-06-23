import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Create a #root element automatically if it's missing (helps server-side templates)
let rootEl = document.getElementById("root");
if (!rootEl) {
  rootEl = document.createElement("div");
  rootEl.id = "root";
  document.body.appendChild(rootEl);
}

if (rootEl) {
  const root = createRoot(rootEl);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.warn("Failed to create root element for app mount.");
}
