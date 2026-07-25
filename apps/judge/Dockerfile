# syntax=docker/dockerfile:1

# LOCAL USE ONLY.
#
# In production the judge runs as a bare host process on its own instance and is
# deliberately not containerised: giving it a container would mean mounting the
# container socket so it could start sandboxes, and a mounted container socket
# is the most direct escape path available to the hostile code this service
# exists to contain (ADR-0005, issue #13).
#
# This image exists so `compose.e2e.yaml` can bring the whole stack up from a
# clean clone without a Go toolchain installed. Do not deploy it.
#
# It cannot judge, and that is the point. The judge needs a container runtime to
# start sandboxes, and this image is given none: no socket is mounted, here or
# anywhere. It detects that at startup and serves DEGRADED, refusing Solve Runs
# rather than accepting work it cannot do. For real Judging, run the binary on a
# host — which is how it is deployed.

FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/judge ./cmd/judge

# Nothing but the binary. There is no shell to find and no package manager to
# use on a host whose whole job is containing hostile code.
FROM gcr.io/distroless/static-debian12:nonroot AS runtime
COPY --from=build /out/judge /judge
USER nonroot:nonroot
EXPOSE 9090
ENTRYPOINT ["/judge"]
