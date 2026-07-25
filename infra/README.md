# Infrastructure

Everything the application runs on is declared here as code. That is what keeps
the hosting decision reversible — the whole stack should be rebuildable
elsewhere from these definitions rather than from somebody's memory of which
console checkboxes were ticked (ADR-0001).

## What is here

| Path               | What it is                                                                    |
| ------------------ | ----------------------------------------------------------------------------- |
| `caddy/`           | The reverse proxy: serves the built SPA and proxies `/api/*` to the backend   |
| `terraform/`       | The cloud account: network, database, instance, tunnel, secrets, cost control |
| `terraform/tests/` | Plan-time assertions on the security and cost properties, run in CI           |

`caddy/Caddyfile` is used unchanged by the local end-to-end stack and by
production. The only difference between the two is the address it binds and the
upstream it proxies to, both of which come from the environment. A proxy config
that differs between local and production is a proxy config whose bugs are only
ever found in production.

## The shape of it

```
                     ┌──────────────────────────┐
   the internet ────▶│    Cloudflare edge       │   TLS terminates here
                     └───────────┬──────────────┘
                                 │  tunnel, dialled OUTBOUND from the instance
                                 ▼
    ┌───────────────────────────────────────────────────┐
    │  api instance           public subnet             │
    │  NO inbound rules       t4g.small, standard credits│
    │                                                    │
    │   cloudflared ──▶ Caddy :80 ──┬─▶ /srv  (the SPA)  │
    │                               └─▶ api:8080         │
    └────────────────────────────┬──────────────────────┘
                                 │  5432, security-group referenced
                                 ▼
    ┌───────────────────────────────────────────────────┐
    │  PostgreSQL       private subnets, NO route out    │
    │  7-day backups + point-in-time recovery            │
    └───────────────────────────────────────────────────┘
```

The private subnets have no route to the internet at all. That is deliberate,
and it is where the judge's instance goes when it lands (ADR-0005, issue #13).

Two properties are worth stating plainly, because most of the rest follows from
them:

- **Nothing listens on a public address.** The application instance has no
  inbound security group rules — not 443, not 22. Traffic arrives down the
  tunnel ADR-0002 chose to serve the single hostname, dialled outbound by
  `cloudflared`, so with nothing listening the origin is undiscoverable rather
  than merely firewalled. Administrative access is Session Manager, which is
  also outbound-initiated.
- **Deploying needs no standing credential.** Continuous integration exchanges a
  GitHub OIDC token for a short-lived role and sends one Systems Manager
  command. There is no SSH key and no access key anywhere.

## Standing it up from nothing

Once, per account:

```bash
# 1. The state bucket. Local state, and the only thing outside the main stack.
terraform -chdir=infra/terraform/bootstrap init
terraform -chdir=infra/terraform/bootstrap apply -var bucket_name=gmc-terraform-state-<unique>

# 2. Point the main stack at it, using the two lines that command printed.
cp infra/terraform/backend.hcl.example infra/terraform/backend.hcl
$EDITOR infra/terraform/backend.hcl

# 3. Account-specific values.
cp infra/terraform/terraform.tfvars.example infra/terraform/terraform.tfvars
$EDITOR infra/terraform/terraform.tfvars

# 4. The stack.
terraform -chdir=infra/terraform init -backend-config=backend.hcl
terraform -chdir=infra/terraform apply
```

Then three things Terraform deliberately does not do:

1. **Write the registry pull token.** It is a GitHub personal access token with
   `read:packages`, and GitHub is not a provider configured here. The parameter
   exists with a placeholder; give it a real value once:

   ```bash
   aws ssm put-parameter --overwrite --type SecureString \
     --name /gmc/prod/registry/token --value "$GHCR_READ_TOKEN"
   ```

   Terraform ignores changes to that value afterwards, so applying again will
   not revert it and break every subsequent image pull.

2. **Record the deploy role.** Set the `AWS_DEPLOY_ROLE_ARN` repository variable
   to `terraform output -raw deploy_role_arn`. The deploy workflow skips itself
   while that is unset, which is what stops every merge failing before the
   infrastructure exists.

3. **Run the restore drill.** See
   [`docs/runbooks/database-restore.md`](../docs/runbooks/database-restore.md).
   An untested backup is not a backup, and the drill log in that document is the
   evidence that it is one.

## Deploying

Push to `main`. Continuous integration builds both images for arm64, tags them
with the commit SHA, and sends the deploy command.

The deploy pulls both images **before** stopping anything, then replaces the
backend and waits for `/api/health` through the proxy. Caddy is left alone
unless its own image changed, so a backend deploy degrades the API for the
10–15 seconds Spring Boot takes to restart rather than taking the site down
(ADR-0009). If the new backend does not come up, the script puts the previous
image back and exits non-zero, so the workflow fails rather than showing a green
tick over a broken site.

## Checking it without an AWS account

`terraform test` runs the whole configuration through a plan with mocked
providers and asserts the properties that are easy to break silently: no inbound
rules, no route out of the private subnets, IMDSv2 with a hop limit containers
cannot cross, encrypted secrets, seven-day retention, `standard` CPU credits,
and a budget halt that fires without waiting for anyone's approval.

```bash
terraform -chdir=infra/terraform init -backend=false
terraform -chdir=infra/terraform test
```

No credentials and no money, so it runs on every pull request that touches
`infra/terraform/`.

## One rule worth stating before anything else is built

**Local development may mount the container socket for convenience; production
must never do so.** A mounted container socket is the most direct escape path
available to the untrusted code the judge exists to contain.
