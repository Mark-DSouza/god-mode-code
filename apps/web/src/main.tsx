import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import { AppProviders } from "./app/AppProviders.tsx";
import "./styles/app.css";

const container = document.getElementById("root");
if (!container) {
  throw new Error("No #root element — index.html and this entry point disagree.");
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
