import { type User, createApiClient } from "@gmc/api-client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { currentUserQueryKey } from "../api/user.ts";

const api = createApiClient();

/** The chosen Handle is already somebody else's — the one refusal Claiming can report. */
export class HandleTakenError extends Error {}

/**
 * Attaches credentials to the current User, or — if signing in belongs to an
 * account that already exists — merges into it (ADR-0007, ADR-0011).
 *
 * The response is written straight into the current-User query rather than
 * invalidated: the backend already returned the merged or Claimed User, and
 * refetching would be a second request for an answer this one just gave.
 */
export function useClaim() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ idToken, handle }: { idToken: string; handle: string }): Promise<User> => {
      const response = await api.POST("/api/users/claim", {
        headers: { Authorization: `Bearer ${idToken}` },
        body: { handle },
      });
      if (response.response.status === 409) {
        throw new HandleTakenError("That Handle is already taken");
      }
      if (!response.data) {
        throw new Error(`Could not Claim (status ${response.response.status})`);
      }
      return response.data;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(currentUserQueryKey, user);
    },
  });
}
