import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/app.css";
import { Gallery, specimenFrom } from "./Gallery.tsx";

/**
 * The specimen gallery's entry point.
 *
 * Deliberately not the application's: no error reporting, no query client, no
 * providers. Everything here is a pure render of design system components
 * against the real token layer, and anything else in the tree would be
 * something else the baseline could be a photograph of.
 *
 * This entry is only built when `VISUAL=1` (see `vite.config.ts`), so no
 * deployed bundle carries it.
 */
const container = document.getElementById("root");
if (!container) {
  throw new Error("No #root element — specimens.html and this entry point disagree.");
}

createRoot(container).render(
  <StrictMode>
    <Gallery name={specimenFrom(window.location.search)} />
  </StrictMode>,
);
