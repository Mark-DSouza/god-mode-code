# Verifying that you would find out

Monitoring is the one part of a system that is never exercised by normal use. A
backup that has never been restored is not a backup, and an alert that has never
fired is not an alert — it is a configuration file somebody believes in.

This runbook is the exercise. Three deliberate failures, one per sink, and a
drill log at the bottom recording when each was last actually performed.

## What is watching what

| Signal                          | Collected by                           | Lands in         |
| ------------------------------- | -------------------------------------- | ---------------- |
| Backend logs                    | journald → Alloy                       | Grafana Loki     |
| Backend metrics                 | Alloy scrapes `/actuator`              | Grafana Mimir    |
| Judge metrics                   | the api mirrors, Alloy scrapes the api | Grafana Mimir    |
| Judge logs                      | nobody, on purpose                     | the judge's disk |
| Host CPU, disk                  | Alloy                                  | Grafana Mimir    |
| Frontend errors                 | the browser                            | Sentry           |
| Instance CPU, credits, status   | AWS                                    | CloudWatch alarm |
| Database CPU, storage, sessions | AWS                                    | CloudWatch alarm |
| The site being reachable at all | UptimeRobot                            | your inbox       |

Two absences are deliberate. The judge ships nothing itself — no egress, so no
route to any sink (ADR-0005) — and its metrics leave only because the backend
scrapes them across the private link and re-publishes them into its own
registry, from where the collector picks them up along with everything else. And nothing inside AWS checks whether the site is
up, because a host that is down cannot report that it is down (ADR-0008).

## Before you start

The three external accounts, and the values from them:

```bash
# Grafana Cloud → the stack's page. The token is an access policy token with
# metrics:write and logs:write.
export GRAFANA_PROMETHEUS_URL=https://prometheus-<region>.grafana.net/api/prom/push
export GRAFANA_PROMETHEUS_USERNAME=<numeric instance id>
export GRAFANA_LOKI_URL=https://logs-<region>.grafana.net/loki/api/v1/push
export GRAFANA_LOKI_USERNAME=<numeric instance id>
export GRAFANA_TOKEN=glc_...
```

The first four are not secrets and belong in `infra/terraform/terraform.tfvars`.
The token is, and is written to Parameter Store out of band exactly once — the
same treatment the registry token gets, and for the same reason:

```bash
aws ssm put-parameter --overwrite --type SecureString \
  --name /gmc/prod/observability/token --value "$GRAFANA_TOKEN"
```

Then the stack that lives outside AWS:

```bash
cp infra/terraform/observability/terraform.tfvars.example \
   infra/terraform/observability/terraform.tfvars
$EDITOR infra/terraform/observability/terraform.tfvars

terraform -chdir=infra/terraform/observability init -backend-config=backend.hcl
terraform -chdir=infra/terraform/observability apply
```

And two things nobody can automate:

1. **Confirm the SNS subscription.** Terraform creates it pending; AWS emails a
   link. Until somebody clicks it, every CloudWatch alarm fires into a topic
   with no subscriber. Check with:

   ```bash
   aws sns list-subscriptions-by-topic --topic-arn "$(
     aws sns list-topics --query "Topics[?contains(TopicArn, 'gmc-prod-alarms')].TopicArn" --output text
   )" --query 'Subscriptions[].SubscriptionArn'
   ```

   An output of `PendingConfirmation` means the alarms are decorative.

2. **Confirm the UptimeRobot contact** the same way, from its own email.

---

## 1. A backend error reaches the logs

The point is not that an exception can be thrown. It is that the line comes out
as JSON, carries the identifier the caller was given, and arrives somewhere you
can search.

There is deliberately no endpoint whose purpose is to fail — shipping one would
hand anyone on the internet a way to fill the log stream the alerts are built
on. So the failure used here is a real one: take the database away.

Locally, against the containerised stack:

```bash
pnpm stack:up
curl -si -H 'Cf-Ray: drill0000000001-BOM' http://localhost:8000/api/health | head -1
docker compose -f compose.e2e.yaml stop db
curl -si -H 'Cf-Ray: drill0000000002-BOM' http://localhost:8000/api/health | head -1
docker compose -f compose.e2e.yaml logs api --no-log-prefix --tail 5
```

The second `curl` must answer `503`, and the log must contain a JSON document —
not a line of prose — carrying `drill0000000002-BOM`. Trimmed, it looks like
this:

```json
{
  "@timestamp": "2026-07-26T03:53:02.404824255Z",
  "log": { "level": "WARN", "logger": "…health.HealthService" },
  "message": "Health check could not reach the database",
  "correlationId": "drill0000000002-BOM",
  "error": {
    "type": "java.sql.SQLTransientConnectionException",
    "message": "HikariPool-1 - Connection is not available…",
    "stack_trace": "…Caused by: java.net.UnknownHostException: db"
  },
  "ecs": { "version": "8.11" }
}
```

Note that the level is nested under `log`, not a flat `log.level` key. The
collector's `stage.json` reads it with the JMESPath expression `log.level`,
which traverses the object — a detail worth knowing before rewriting that
pipeline.

The 503 matters as much as the log line: it is the same answer the external
uptime check would receive, from the same endpoint, which is what makes step 3
below a check of the alerting rather than of the application.

Then put it back:

```bash
docker compose -f compose.e2e.yaml start db
```

In production the same line is in Loki within a few seconds. Search for it by
the field rather than by substring, which is the whole reason for the format:

```logql
{container="gmc-api"} | json | correlationId = `drill0000000002-BOM`
```

If nothing arrives, work outward: is the collector running (`docker ps` on the
host), is it authenticating (`docker logs gmc-alloy`), is the journal persistent
(`journalctl --disk-usage` — a volatile journal reports megabytes and lives in
`/run`).

## 2. A frontend error reaches Sentry

A browser is the one place no server-side sink can see. The check is not only
that the error arrives, but that it arrives **readable** — an unminified stack
trace pointing at a real file and line, which is what the source map upload is
for.

On the deployed site, open the console and throw:

```js
setTimeout(() => {
  throw new Error("drill: deliberate frontend failure");
}, 0);
```

`setTimeout` rather than a bare `throw`, so it leaves the console's own
try/catch and reaches the global handler the way a real bug would.

Within a minute the issue is in Sentry. What to check, in order of what usually
goes wrong:

- The stack trace names `App.tsx` or similar, **not** `index-a1b2c3.js`. If it
  is minified, the upload did not happen: confirm `SENTRY_AUTH_TOKEN` is set as
  a repository secret and that `@sentry/cli` is in `allowBuilds` in
  `pnpm-workspace.yaml` — without it the build succeeds and uploads nothing.
- The release matches the deployed commit. A mismatch means Sentry holds maps it
  will never apply.
- No `.map` file is served: `curl -sI https://<host>/assets/<bundle>.js.map`
  must answer 404. The upload deletes them, and the image build deletes any it
  missed.

## 3. Stopping the application produces an alert

The one that matters. Everything above tells you why something is broken; this
is the only check that tells you **that** it is.

From Session Manager on the application host:

```bash
sudo docker stop gmc-api
```

Caddy keeps serving the page — it is static content — but `/api/health` stops
answering, which is exactly why the monitor watches that URL and not the home
page. Then wait one interval.

- UptimeRobot emails within five minutes (the free plan's floor; the interval is
  a variable if that ever needs to be money).
- Bring it back with `sudo docker start gmc-api`, and confirm the recovery email
  arrives too. A monitor that only ever tells you about failure trains you to
  assume silence means health, and silence also means broken.

While it is down, the dashboard's request rate panel should fall to zero and the
5xx series should be visibly empty rather than absent — that difference is worth
seeing once, because it is the difference between "nothing is failing" and
"nothing is reporting".

---

## Drill log

An entry is only worth writing after the whole thing has been performed against
the real accounts. "It should work" is not an entry.

| Date | Performed by | Backend log | Frontend error | Uptime alert | Notes |
| ---- | ------------ | ----------- | -------------- | ------------ | ----- |
|      |              |             |                |              |       |

Nothing has been recorded yet. The local half of step 1 — the 503, the JSON
line, the correlation id — was verified against the containerised stack when
this was written; the three external accounts did not exist at that point, so
steps 2 and 3 and the shipping half of step 1 remain unperformed.
