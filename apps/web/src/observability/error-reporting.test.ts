import * as Sentry from "@sentry/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { startErrorReporting } from "./error-reporting.ts";

vi.mock("@sentry/react", () => ({ init: vi.fn(), captureException: vi.fn() }));

const init = vi.mocked(Sentry.init);

describe("startErrorReporting", () => {
  beforeEach(() => {
    init.mockClear();
  });

  it("stays out of the way when there is no destination configured", () => {
    // Local development and the test suite have no DSN, and a reporter that
    // initialised anyway would spend every run trying to post to nowhere.
    expect(startErrorReporting({ dsn: undefined, environment: "local", release: undefined })).toBe(
      false,
    );
    expect(init).not.toHaveBeenCalled();
  });

  it("ignores a DSN that is present but blank", () => {
    // An unset build argument arrives as an empty string rather than as
    // undefined, which is the shape this actually fails in.
    expect(startErrorReporting({ dsn: "", environment: "production", release: "abc" })).toBe(false);
    expect(init).not.toHaveBeenCalled();
  });

  it("reports to the configured project once a DSN is given", () => {
    const started = startErrorReporting({
      dsn: "https://examplekey@o0.ingest.sentry.io/1",
      environment: "production",
      release: "1234567890abcdef",
    });

    expect(started).toBe(true);
    expect(init).toHaveBeenCalledTimes(1);
    expect(init.mock.calls[0]?.[0]).toMatchObject({
      dsn: "https://examplekey@o0.ingest.sentry.io/1",
      environment: "production",
      // The release has to be the commit the bundle was built from. Source maps
      // are uploaded under this name, and a mismatch means Sentry holds
      // readable maps it will never apply to the stack traces they belong to.
      release: "1234567890abcdef",
    });
  });

  it("sends no personal data and buys no performance quota", () => {
    startErrorReporting({
      dsn: "https://examplekey@o0.ingest.sentry.io/1",
      environment: "production",
      release: "1234567890abcdef",
    });

    const options = init.mock.calls[0]?.[0];
    // Players are recognised by a cookie rather than an account (ADR-0007).
    // Attaching addresses and headers to every error would turn an error
    // tracker into a store of personal data, for no diagnostic gain.
    expect(options).toMatchObject({ sendDefaultPii: false, tracesSampleRate: 0 });
  });
});
