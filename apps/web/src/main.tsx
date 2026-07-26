import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import { AppProviders } from "./app/AppProviders.tsx";
import { ErrorBoundary } from "./observability/ErrorBoundary.tsx";
import { errorReportingConfig, startErrorReporting } from "./observability/error-reporting.ts";
import "./styles/app.css";

// Before anything renders, so a failure during the first render is reported
// rather than being the one class of failure the reporter cannot see.
startErrorReporting(errorReportingConfig());

const container = document.getElementById("root");
if (!container) {
  throw new Error("No #root element — index.html and this entry point disagree.");
}

createRoot(container).render(
  <StrictMode>
    {/* Outside the providers: a query client that fails to construct should
        still land on the fallback rather than on a blank page. */}
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
);
