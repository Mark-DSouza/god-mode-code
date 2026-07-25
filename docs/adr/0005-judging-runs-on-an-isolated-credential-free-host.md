# Judging runs on an isolated, credential-free host

Judging runs as a Go service on its own EC2 instance with **no IAM instance
profile, no egress, no NAT gateway**, in a private subnet reachable only from the
api security group. Execution containers are additionally capped on memory, CPU,
and PIDs, run read-only as a non-root user with all capabilities dropped, and
have `--network=none`.

Containers share the host kernel — they are processes in a costume, not virtual
machines — so a container escape is a question of when, not whether. The
separation is not about resource contention, which cgroups would handle. It is
about blast radius, and specifically about **money**: a compromised host holding
an IAM role can launch GPU instances (an active campaign does exactly this,
scaling to hundreds of instances within ten minutes of compromise), and a host
with egress can generate five-figure data-transfer bills at $0.09/GB. A host with
neither credentials nor a route to the internet is financially inert. An escape
there costs a `terraform apply`.

Written in Go rather than Java because a JVM would consume roughly 40% of the
1GB instance's RAM to host a ~200-line process supervisor, leaving room for one
concurrent execution instead of four. A single static binary also means no
runtime packages on the machine whose entire job is containing hostile code.

## Consequences

The judge runs under systemd as a host process, **not** in a container —
containerising it would require mounting the Docker socket, which is the most
direct container escape there is. Local development mounts the socket for
convenience; production must never do so.

**The judge cannot ship its own telemetry.** No egress means no route to any
observability sink, and VPC interface endpoints (~$7.30/month each) or a NAT
gateway (~$32/month) would cost more than the instance. Instead the judge writes
structured JSON to stdout — retained locally for SSH debugging — and exposes
`/metrics`, which the api scrapes over the existing private link. The api also
logs every judge interaction it makes: request, verdict, duration, timeouts,
errors. That covers what matters without opening a path out of the box. If judge
logs are ever missing from Grafana, this is why, and it is deliberate.

AWS Lambda would have given microVM-grade (Firecracker) isolation for free, which
is stronger than anything achievable here — standard EC2 instances do not expose
`/dev/kvm`. We accepted weaker isolation for the control and demonstrability of
owning the sandbox, with gVisor (`--runtime=runsc`) as the intended hardening
step.
