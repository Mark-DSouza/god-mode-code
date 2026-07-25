# The tunnel.
#
# ADR-0002 settled that one hostname serves the whole application and that a
# Cloudflare Tunnel is what exposes it. This is what that buys beyond the
# single origin: `cloudflared` runs on the instance and dials *out* to
# Cloudflare's edge, and requests for the hostname come back down that existing
# connection. The instance never listens on a public address, so the origin is
# not merely firewalled — there is nothing to port-scan.
#
# TLS terminates at Cloudflare's edge, which is why Caddy runs with
# `auto_https off`: a second handshake over the loopback interface would protect
# nothing.

resource "random_password" "tunnel_secret" {
  # Cloudflare requires the tunnel secret to be base64 and at least 32 bytes.
  length  = 48
  special = false
}

resource "cloudflare_zero_trust_tunnel_cloudflared" "main" {
  account_id    = var.cloudflare_account_id
  name          = "gmc-${var.environment}"
  tunnel_secret = base64encode(random_password.tunnel_secret.result)

  # The ingress rules below are the source of truth, pushed by Terraform,
  # rather than a file edited on the instance. `local` would mean the routing
  # lives in a config file nobody has read since the day it was written.
  config_src = "cloudflare"
}

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "main" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.main.id

  config = {
    ingress = [
      {
        hostname = var.hostname
        # Caddy, on the loopback interface. Everything past this point —
        # serving the SPA, proxying /api/* — is Caddy's job, and it is the same
        # Caddyfile the local end-to-end stack uses.
        service = "http://localhost:80"

        origin_request = {
          # Connecting is a loopback TCP handshake to a process on this same
          # host, so ten seconds is already far beyond anything but Caddy being
          # gone. It is a ceiling on how long a request waits to discover that,
          # not a budget the connection is expected to use.
          connect_timeout = 10
          # Size of the pool of connections held open to Caddy. Reusing them
          # avoids a handshake per request on a burstable instance whose CPU is
          # the scarce resource; sixteen is comfortably above what a single
          # small instance serves concurrently.
          keep_alive_connections = 16
        }
      },
      # Cloudflare requires a terminating catch-all. Anything not matching the
      # hostname above is not this application.
      {
        service = "http_status:404"
      },
    ]
  }
}

# The token the instance authenticates with. A data source rather than an
# attribute of the tunnel: the credential is issued by Cloudflare on request,
# not returned at creation. It is written straight into Parameter Store
# (secrets.tf) and never appears in the repository.
data "cloudflare_zero_trust_tunnel_cloudflared_token" "main" {
  account_id = var.cloudflare_account_id
  tunnel_id  = cloudflare_zero_trust_tunnel_cloudflared.main.id
}

# Points the hostname at the tunnel. `proxied` is mandatory here, not a
# preference: an unproxied record cannot resolve to a tunnel at all, and
# proxying is also what supplies the free Universal SSL certificate that
# covers this first-level subdomain (ADR-0002).
resource "cloudflare_dns_record" "app" {
  zone_id = var.cloudflare_zone_id
  name    = var.hostname
  type    = "CNAME"
  content = "${cloudflare_zero_trust_tunnel_cloudflared.main.id}.cfargotunnel.com"
  proxied = true
  # Ignored while proxied, but the API requires a value.
  ttl     = 1
  comment = "Managed by Terraform; points at the Cloudflare Tunnel"
}
