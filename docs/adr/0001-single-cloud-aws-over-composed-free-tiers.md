# Single-cloud AWS over composed free tiers

This project could run at genuinely zero cost on Cloudflare Pages + Oracle Always
Free + Supabase. We chose AWS `ap-south-1` (Mumbai) at roughly $34/month instead,
for one bill, one IAM model, one observability stack, an India-local region, and
because demonstrable experience on a recognised cloud is part of this project's
purpose.

## Considered Options

- **Cloudflare Workers + D1** — ruled out early: Workers cannot run a JVM.
- **Oracle Always Free** — a genuinely free 12GB always-on VM in Hyderabad, but
  subject to idle reclamation, an ARM capacity lottery, and no support recourse.
- **GCP** — its Always Free tier excludes Mumbai, and it has no free managed
  Postgres at all, so the headline "free forever" does not survive contact with a
  stateful, relational, India-hosted app.
- **Hetzner** — cheapest paid VM by a wide margin, but its nearest region is
  Singapore. Paying for worse latency than free Oracle made no sense.

## Consequences

AWS has no hard spending cap and never will. Protection is therefore structural
rather than a limit: fixed-size instances that cost the same under load, no NAT
gateway, `standard` CPU credit mode so burstable surplus cannot be billed, a
dedicated AWS account, and a Budget Action that stops both instances at $50. See
also ADR-0005, which is the other half of this defence.
