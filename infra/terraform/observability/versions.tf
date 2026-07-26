terraform {
  required_version = ">= 1.9"

  # A separate state file from the main stack, and deliberately a separate
  # stack. The two have no resource in common, they are applied with different
  # credentials, and neither should be blocked by the other's provider being
  # unreachable. Sharing state would also mean every `apply` of the cloud
  # account needed a Grafana token to plan.
  backend "s3" {}

  required_providers {
    grafana = {
      source  = "grafana/grafana"
      version = "~> 3.25"
    }

    # A community provider, and the only maintained one for this service. It is
    # pinned to an exact minor line rather than floated: it moves rarely, and
    # the blast radius of it moving unexpectedly is the check that tells us the
    # site is down.
    uptimerobot = {
      source  = "louy/uptimerobot"
      version = "~> 0.5"
    }
  }
}

provider "grafana" {
  url  = var.grafana_url
  auth = var.grafana_auth
}

provider "uptimerobot" {
  api_key = var.uptimerobot_api_key
}
