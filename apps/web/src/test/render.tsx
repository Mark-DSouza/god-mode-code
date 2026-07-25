import { QueryClient } from "@tanstack/react-query";
import { type RenderOptions, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { AppProviders } from "../app/AppProviders.tsx";

/**
 * Renders inside the providers the real entry point uses, with a fresh query
 * client per call so no cached response survives into the next test.
 *
 * Retries are off here only: a test asserting the unreachable state should fail
 * in milliseconds, not wait out a retry schedule that exists for real networks.
 */
export function renderApp(ui: ReactElement, options?: Omit<RenderOptions, "wrapper">) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });

  return {
    client,
    ...render(ui, {
      wrapper: ({ children }) => <AppProviders client={client}>{children}</AppProviders>,
      ...options,
    }),
  };
}
