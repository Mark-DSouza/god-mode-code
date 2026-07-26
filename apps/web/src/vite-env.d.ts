/// <reference types="vite/client" />

/**
 * The build-time configuration this bundle is allowed to read.
 *
 * Declared rather than inferred so a typo in a variable name is a compile
 * error. Everything here is inlined by Vite at build time and is therefore
 * public — a DSN is an ingestion address, not a credential, and nothing secret
 * may be added to this list.
 */
interface ImportMetaEnv {
  /** Sentry ingestion address. Absent in development, so reporting stays off. */
  readonly VITE_SENTRY_DSN?: string;
  /** Which deployment an error came from. */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  /** The commit this bundle was built from; the release uploaded maps hang off. */
  readonly VITE_COMMIT_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
