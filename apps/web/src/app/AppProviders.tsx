import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";

/**
 * Server state lives in a query cache. The run engine deliberately does not —
 * it is synchronous, per-keystroke local component state, and routing it
 * through a cache would put a scheduler between a key press and the glyph
 * lighting up.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Leaderboards are cached briefly at the edge anyway, and a player
        // mid-run should not have the page refetch under them.
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

export function AppProviders({
  children,
  client,
}: {
  children: ReactNode;
  /** Tests pass a per-test client so cached data cannot leak between them. */
  client?: QueryClient;
}) {
  // Created in state rather than at module scope: a module-level client is
  // shared by every test in a file and survives between them.
  const [fallback] = useState(createQueryClient);
  return <QueryClientProvider client={client ?? fallback}>{children}</QueryClientProvider>;
}
