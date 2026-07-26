import * as Sentry from "@sentry/react";

/**
 * Where errors are sent, and under what name.
 *
 * A browser is the one place no server-side sink can observe (ADR-0008): a
 * failure in the bundle leaves no trace in any log the application host keeps,
 * so if it is not reported from the page it is not reported at all.
 */
export interface ErrorReportingConfig {
  /** Absent everywhere except a production build. */
  dsn: string | undefined;
  environment: string;
  /** The commit the bundle was built from. */
  release: string | undefined;
}

/**
 * Reads the configuration the bundle was built with.
 *
 * Vite inlines these at build time, so what ships is a literal — there is no
 * runtime lookup to fail and nothing to configure on the host.
 */
export function errorReportingConfig(): ErrorReportingConfig {
  return {
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT ?? "production",
    release: import.meta.env.VITE_COMMIT_SHA,
  };
}

/**
 * Starts reporting, and says whether it did.
 *
 * Without a destination this is deliberately a no-op rather than an error:
 * local development, the test suite and anyone's fork all build without one,
 * and none of them should be posting a stranger's stack traces anywhere.
 */
export function startErrorReporting(config: ErrorReportingConfig): boolean {
  if (!config.dsn) {
    return false;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    // Source maps are uploaded under this name at build time. If the two ever
    // disagree, Sentry holds readable maps it will never apply to the stack
    // traces they belong to — which looks exactly like not uploading them.
    release: config.release,
    // No addresses, no headers, no cookies. Players are recognised by a cookie
    // rather than an account (ADR-0007), and there is nothing an IP address
    // would tell us about a rendering failure that the stack trace does not.
    sendDefaultPii: false,
    // Errors only. Performance traces are the fastest way through a free tier's
    // quota, and the numbers that matter here are collected server-side already.
    tracesSampleRate: 0,
  });

  return true;
}
