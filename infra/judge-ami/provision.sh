#!/usr/bin/env bash
#
# What is on the judge's disk.
#
# This runs once, on a throwaway builder instance that still has egress, and
# the machine image taken from that builder is what the judge boots from
# forever after. It is the *only* place the judge's host may reach the network,
# and that is the whole reason it exists: the running judge sits in a routeless
# subnet with no credentials and no egress rules, so it cannot install a
# package, pull an image or fetch its own binary (ADR-0005). Everything it will
# ever run has to already be here.
#
# The rule that follows, and it is worth stating plainly: anything that needs
# the network belongs in this file. Nothing that needs the network may go in
# `infra/terraform/templates/judge_user_data.sh.tftpl`, which runs on the real
# host, where there is no network to need.
#
# Run by docs/runbooks/judge-host.md. Not idempotent and not meant to be — it
# runs once, on a machine that is destroyed immediately afterwards.
set -euo pipefail

# The commit the judge is built from. Passed in by the runbook; there is no
# default, because "whatever main was that afternoon" is not a thing anyone can
# later identify from a running instance.
JUDGE_REF="${JUDGE_REF:?set JUDGE_REF to the commit SHA to build the judge from}"
REPOSITORY="${JUDGE_REPOSITORY:-Mark-DSouza/god-mode-code}"

# Matches the builder stage of apps/judge/Dockerfile. The judge is built by the
# same toolchain locally, in CI and here, so a binary that passes the test suite
# is the binary this image gets.
GO_IMAGE="golang:1.26-alpine"

# The execution image every sandbox container is started from. Pulled here
# because the judge cannot pull it later: the first Solve Run on a host that
# reached production without this would fail with an image-not-found error that
# looks nothing like the missing egress that caused it.
EXECUTION_IMAGE="python:3.13-alpine"

log() { echo "[judge-image] $*"; }

log "Installing the container runtime"
dnf install -y docker tar gzip
systemctl enable --now docker

log "Fetching the judge at $JUDGE_REF"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT
curl --fail --silent --show-error --location \
  "https://codeload.github.com/$REPOSITORY/tar.gz/$JUDGE_REF" |
  tar -xz -C "$workdir" --strip-components=1

log "Building the judge"
# Built inside a container rather than against a Go toolchain installed on the
# host, so this image carries no compiler. A machine whose job is containing
# hostile code should not also be a machine that can build software.
install -d -m 0755 /usr/local/bin
docker run --rm \
  --volume "$workdir/apps/judge:/src" \
  --volume /usr/local/bin:/out \
  --workdir /src \
  --env CGO_ENABLED=0 \
  "$GO_IMAGE" \
  go build -trimpath -ldflags="-s -w" -o /out/judge ./cmd/judge
chown root:root /usr/local/bin/judge
chmod 0755 /usr/local/bin/judge

log "Pulling the execution image"
docker pull "$EXECUTION_IMAGE"

log "Reclaiming the toolchain"
# The Go image is a few hundred megabytes and has no business on a host that
# only ever runs one static binary.
docker image rm "$GO_IMAGE" >/dev/null
docker image prune --force >/dev/null

log "Creating the service account"
# Runs as its own user rather than as root. Membership of the `docker` group is
# root-equivalent in practice — anyone who can talk to the daemon can start a
# privileged container — so this is depth rather than a boundary, and it is
# worth being honest about which. What it does buy is that a bug in the judge's
# own file handling is not automatically a bug with root's filesystem.
useradd --system --no-create-home --shell /usr/sbin/nologin judge || true
usermod --append --groups docker judge

log "Recording the build"
install -d -m 0755 /etc/gmc
# The version lives with the binary, not in the instance's configuration. A
# host cannot then report a version that is not the one it is running — which
# is the failure that makes "is the fix deployed?" unanswerable.
cat >/etc/gmc/judge-build.env <<BUILD
JUDGE_VERSION=$JUDGE_REF
BUILD
chmod 0644 /etc/gmc/judge-build.env

log "Installing the service"
cat >/etc/systemd/system/gmc-judge.service <<'UNIT'
[Unit]
Description=GOD_MODE_CODE judge
Documentation=https://github.com/Mark-DSouza/god-mode-code/blob/main/docs/adr/0005-judging-runs-on-an-isolated-credential-free-host.md
# The judge starts sandbox containers, so it is useless without the daemon and
# should not be up reporting itself healthy before the daemon is.
Requires=docker.service
After=docker.service network-online.target

[Service]
User=judge
Group=judge
# Runs as a host process, deliberately not containerised: containerising it
# would mean mounting the container socket into a service that executes hostile
# code, which is the most direct escape path available (ADR-0005).
ExecStart=/usr/local/bin/judge
# Two files, in this order: the build, baked into the image beside the binary,
# and the instance's configuration, written by cloud-init. The leading dash
# makes the second optional, so a judge whose bootstrap failed still starts on
# its defaults and can be seen to be wrong rather than silently absent.
EnvironmentFile=/etc/gmc/judge-build.env
EnvironmentFile=-/etc/gmc/judge.env

Restart=always
RestartSec=2s

# Structured JSON on stdout, captured by the journal. This is the judge's only
# log sink: it has no egress, so it cannot ship anything anywhere, and the
# journal is what an operator reads if they ever get onto the box — which,
# given there is no way in, is mostly a matter of the console (ADR-0005,
# ADR-0008).
StandardOutput=journal
StandardError=journal

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictSUIDSGID=true

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
# Deliberately not enabled here. cloud-init enables it after writing the
# configuration, so a host whose bootstrap failed comes up with nothing
# listening — visibly broken, rather than quietly serving with whatever
# defaults the image happened to carry.
systemctl disable gmc-judge >/dev/null 2>&1 || true

log "Cleaning up"
dnf clean all
rm -rf /var/cache/dnf
# Without this the image carries the builder's cloud-init state, and the
# instance launched from it treats its own user data as already applied — so it
# would come up unconfigured, with no judge running and nothing saying why.
cloud-init clean --logs --seed

log "Done. Stop this instance and take an image of it."
