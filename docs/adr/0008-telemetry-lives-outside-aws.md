# Telemetry lives outside AWS

Logs and metrics go to **Grafana Cloud** (free tier), frontend errors to
**Sentry** (free tier), and uptime checks run from **UptimeRobot** — not
CloudWatch. This is a deliberate exception to the consolidation rationale in
ADR-0001, and it needs recording precisely because it looks like a contradiction.

Two reasons. The first is economic: CloudWatch's free tier allows **ten** custom
metrics and charges $0.30 each thereafter. Spring Boot Actuator with Micrometer
emits dozens before you write any instrumentation of your own — JVM pools, GC
pauses, HTTP timers per endpoint per status, connection pool stats — so a normal
setup lands around $30/month, roughly doubling the infrastructure bill. Grafana
Cloud's free tier covers 10,000 active series and 50GB of logs.

The second reason is topological, and it is the more important one: **monitoring
should not live inside the system it monitors.** CloudWatch is adequate right up
until the failure you are debugging is in the AWS account you are reading from.
Uptime checks in particular _must_ be external — a host that is down cannot
report that it is down — and frontend errors happen in a browser, where no
server-side sink can observe them at all.

## Consequences

Retention on the Grafana free tier is 14 days, which is sufficient for this
project and would not be for one with compliance obligations. Alarms on built-in
EC2 and RDS metrics (CPU, disk, database connections) still use CloudWatch, since
those are free and already collected.

**Correction, made while implementing this (issue #19): EC2 disk is not one of
those metrics.** EC2 publishes CPU, network, credit balance and status checks
for free, but nothing about the filesystem — the hypervisor cannot see inside
the volume. Filesystem usage requires the CloudWatch agent, which reports it as
a _custom_ metric, which is the charge this decision exists to avoid. So the
disk alarm is a Grafana rule over the collector's node metrics, and everything
else in that sentence is unchanged. The split now runs: CPU, CPU credits,
instance status, database CPU, storage and connections in CloudWatch; instance
disk and judge failure rate in Grafana; reachability in UptimeRobot, outside
both.
