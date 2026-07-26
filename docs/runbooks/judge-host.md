# The judge's host

The judge runs on its own instance with **no IAM role, no egress and no route to
the internet**, reachable only from the application's security group on one port
(ADR-0005). Every awkward thing in this document follows from that, and none of
it is accidental.

Two consequences are worth stating before anything else, because they are the
ones people try to "fix":

- **There is no way onto this box.** No SSH, and no Session Manager either — the
  agent dials out to reach Systems Manager, and there is nothing to dial out
  through. Adding a rule to get in would give an escaped container a way out.
- **The host cannot install anything, ever.** Not a package, not a container
  image, not its own binary. Everything it will ever run has to be on the disk
  before it boots, which is why there is a machine image to build at all.

So this host is cattle in the strictest sense. When something is wrong with it,
you replace it, and the only thing that survives is what is declared in
`infra/terraform/judge.tf` and `infra/judge-ami/provision.sh`.

## One rule that is not negotiable

**Local development may mount the container socket for convenience. Production
must never do so.**

The judge starts sandbox containers, so it needs to talk to the container
daemon. Containerising the judge itself would mean mounting that socket into the
service that executes submitted source — and a mounted container socket is the
most direct escape path there is: anyone who can reach the daemon can start a
privileged container with the host filesystem attached. That is why the judge
runs as a plain systemd unit here, and why `apps/judge/Dockerfile` says in its
first line that it is for local use only.

The local stack is in fact stricter than the ADR requires:
`compose.e2e.yaml` declines the socket too, and the judge detects it has no
runtime, reports `DEGRADED` with `"judging": false`, and refuses Solve Runs. Real
Judging is exercised by running the binary on a host — `./scripts/dev.sh`, or
`cd apps/judge && go run ./cmd/judge` — which is also how it is deployed.

## Building the machine image

The image is built on a throwaway instance that still has egress, in the public
subnet, and is then thrown away. `infra/judge-ami/provision.sh` is what goes on
the disk; read it before running it, because it is the complete answer to "what
is on that host".

You need credentials for the account the stack is applied to.

```bash
export AWS_REGION=ap-south-1
JUDGE_REF=$(git rev-parse HEAD)   # the commit to build the judge from
```

### 1. Launch a builder

Amazon Linux 2023 on arm64, matching the instance family the judge runs on. In
the **public** subnet, because this is the one and only moment this host is
allowed to reach the network.

```bash
AMI=$(aws ssm get-parameter \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64 \
  --query 'Parameter.Value' --output text)

SUBNET=$(aws ec2 describe-subnets \
  --filters "Name=tag:Name,Values=gmc-prod-public" \
  --query 'Subnets[0].SubnetId' --output text)

# The script reads JUDGE_REF from its environment, so it is exported into a copy
# rather than edited in place.
sed "1a export JUDGE_REF=$JUDGE_REF" infra/judge-ami/provision.sh >/tmp/judge-user-data.sh

BUILDER=$(aws ec2 run-instances \
  --image-id "$AMI" \
  --instance-type t4g.small \
  --subnet-id "$SUBNET" \
  --associate-public-ip-address \
  --user-data file:///tmp/judge-user-data.sh \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=gmc-judge-image-builder}]' \
  --query 'Instances[0].InstanceId' --output text)
```

The builder needs no instance profile unless you want Session Manager on it to
watch `/var/log/cloud-init-output.log`, which is the easiest way to see the build
fail. It does need a security group with egress — the default VPC security group
will do, since nothing needs to reach the builder.

### 2. Wait for it to finish, then stop it

The script ends with `Bootstrap complete` in the cloud-init output. Stopping the
instance — rather than snapshotting it running — is what makes the image
consistent.

```bash
aws ec2 stop-instances --instance-ids "$BUILDER"
aws ec2 wait instance-stopped --instance-ids "$BUILDER"
```

### 3. Take the image

```bash
JUDGE_AMI=$(aws ec2 create-image \
  --instance-id "$BUILDER" \
  --name "gmc-judge-$JUDGE_REF" \
  --description "GOD_MODE_CODE judge, built from $JUDGE_REF" \
  --query 'ImageId' --output text)

aws ec2 wait image-available --image-ids "$JUDGE_AMI"
aws ec2 terminate-instances --instance-ids "$BUILDER"
echo "$JUDGE_AMI"
```

### 4. Point the stack at it

```hcl
# infra/terraform/terraform.tfvars
judge_ami_id = "ami-..."
```

```bash
terraform -chdir=infra/terraform apply
```

Changing the image replaces the instance. That is expected and costs nothing
worth protecting: the judge holds no state, its Pattern catalogue is compiled
into the binary, and Terraform pins its private address — so the backend keeps
calling the same place and does not need redeploying.

## Deploying a new judge

There is no in-place deploy, deliberately. Shipping a new judge is building a new
image and applying, which is steps 1–4 above with a newer `JUDGE_REF`. An
immutable host is the only kind that stays consistent with its own definition
when nobody can log in to check.

The site degrades for the ~60 seconds the replacement takes: `/api/health`
reports `judge: DEGRADED`, the Code Discipline is unavailable, and Quotes, Prose
and everything else carry on. The backend's poller notices the new judge within
its poll interval without being restarted.

## When the judge is unwell

Check the application's view first, because it is the only view there is:

```bash
curl -s https://godmodecode.markdsouza.dev/api/health | jq
```

- `judge: "UP"` — it is answering and it has a container runtime.
- `judge: "DEGRADED"` — either it is not answering, or it is answering and
  cannot judge. The backend's logs distinguish these; look for
  `The judge cannot judge` and its `reachable=` field.

The judge's own metrics are mirrored into the backend's registry and are
visible at `/actuator/prometheus` under `judge_*` — including `judge_reachable`,
which is the backend's own view and the only way to tell "the judge is down"
from "nothing is scraping". `NaN` on a mirrored series means the last scrape
failed.

The judge's structured logs stay on the box, in the journal, and there is no way
to read them remotely. That is the trade ADR-0005 makes: no egress means no
route to any log sink, and interface endpoints or a NAT gateway would cost more
per month than the instance. If judge logs are ever missing from Grafana, this
is why, and it is deliberate.

## When the judge is compromised

Assume it is, eventually. A container escape is a question of when.

The good news is the shape of the blast radius, and it is the entire point of
this design: there is nothing on that host to steal and nowhere for it to go. No
IAM role, so the metadata service returns no credentials. No egress, so nothing
can be exfiltrated and no second host can be reached. `standard` CPU credits, so
a miner throttles to the baseline rather than generating surplus charges. And
the $50 budget action stops both instances outright if any of that is wrong.

The response is to replace the instance:

```bash
aws ec2 terminate-instances --instance-ids "$(terraform -chdir=infra/terraform output -raw judge_instance_id)"
terraform -chdir=infra/terraform apply
```

Rebuild the image first if the judge itself was the way in. An escape costs one
`terraform apply`, which is the price this design was chosen to pay.

## Drill log

| Date | Who | What was done | Result |
| ---- | --- | ------------- | ------ |
|      |     |               |        |
