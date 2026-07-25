import { type Health, createApiClient } from "@gmc/api-client";
import { useQuery } from "@tanstack/react-query";

const api = createApiClient();

const healthQueryKey = ["health"] as const;

/**
 * The backend's status, read through the same-origin proxy.
 *
 * A 503 from this endpoint is a real answer, not a transport failure — the
 * backend is telling us a dependency is down — so the body is used rather than
 * thrown away.
 */
export function useHealth() {
  return useQuery({
    queryKey: healthQueryKey,
    queryFn: async (): Promise<Health> => {
      const result = await api.GET("/api/health");

      // openapi-fetch routes a non-2xx body to `error`, but a 503 here carries
      // the same HealthStatus payload — the backend telling us which dependency
      // is down. Both statuses are documented in the contract with the same
      // schema, so either way there is a body to render, and discarding the 503
      // would leave the UI unable to tell "degraded" from "unreachable".
      const payload = result.data ?? result.error;
      if (!payload) {
        // Unreachable given the contract, but a transport failure surfaces here
        // as a rejected promise rather than a silent undefined.
        throw new Error(`Health check returned no body (status ${result.response.status})`);
      }
      return payload;
    },
  });
}
