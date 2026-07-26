# The dashboard and the rules, declared rather than clicked.
#
# A dashboard assembled in a browser exists only in that browser's account. This
# one is a file in the repository, applied from it, and can be rebuilt into a
# fresh Grafana stack by an `apply` — which is the same argument ADR-0001 makes
# for the cloud account, applied to the thing watching it.

resource "grafana_folder" "gmc" {
  title = "god-mode-code"
}

resource "grafana_dashboard" "gmc" {
  folder = grafana_folder.gmc.uid

  # Read from a file rather than assembled in HCL. It is a large JSON document
  # that Grafana itself can export and re-import, and expressing it as
  # interpolated Terraform would make it unreadable in both places.
  config_json = file("${path.module}/../../observability/grafana/dashboards/god-mode-code.json")

  # The dashboard names its datasource through a variable, and this fills it in
  # so nobody has to pick one from a dropdown on every visit.
  overwrite = true
}

# ---------------------------------------------------------------------------
# Alerting
# ---------------------------------------------------------------------------

resource "grafana_contact_point" "operator" {
  name = "god-mode-code operator"

  email {
    addresses = [var.alert_email]
  }
}

# The two conditions that precede an outage and that CloudWatch cannot see.
# Instance CPU, database connections and database storage are alarmed on in the
# main stack, where they are free; these two are here because the data only
# exists in Grafana.
resource "grafana_rule_group" "preceding_an_outage" {
  name             = "preceding an outage"
  folder_uid       = grafana_folder.gmc.uid
  interval_seconds = 300

  rule {
    name      = "Judge failure rate"
    condition = "C"
    # Ten minutes of sustained failure, not one bad Judging. Untrusted code
    # times out as a matter of course — that is the judge working — so the
    # signal is the *rate*, and a short window would alert on one player
    # writing an infinite loop.
    for = "10m"

    annotations = {
      summary     = "More than ${var.judge_failure_rate_threshold * 100}% of Judgings are ending in error or timeout."
      description = "Solve Runs are being judged but failing. Check the judge's own logs on its instance; they never leave it (ADR-0005)."
    }

    labels = {
      environment = var.environment
      severity    = "warning"
    }

    data {
      ref_id         = "A"
      datasource_uid = var.prometheus_datasource_uid

      relative_time_range {
        from = 600
        to   = 0
      }

      model = jsonencode({
        refId = "A"
        # `clamp_min` on the denominator, so a period with no Judgings at all
        # divides by a small number rather than producing NaN — which Grafana
        # would treat as "no data" and, depending on the state below, as an
        # alert. A quiet judge is not a broken one.
        expr    = "sum(rate(judge_judgings_total{verdict=~\"error|timeout\"}[10m])) / clamp_min(sum(rate(judge_judgings_total[10m])), 0.0001)"
        instant = true
      })
    }

    data {
      ref_id         = "B"
      datasource_uid = "__expr__"

      relative_time_range {
        from = 600
        to   = 0
      }

      model = jsonencode({
        refId      = "B"
        type       = "reduce"
        expression = "A"
        reducer    = "last"
      })
    }

    data {
      ref_id         = "C"
      datasource_uid = "__expr__"

      relative_time_range {
        from = 600
        to   = 0
      }

      model = jsonencode({
        refId      = "C"
        type       = "threshold"
        expression = "B"
        conditions = [{
          evaluator = {
            type   = "gt"
            params = [var.judge_failure_rate_threshold]
          }
        }]
      })
    }

    # No judge yet means no series (issue #13). That is not an alert — it is
    # the documented state of the project until the judge's instance lands.
    no_data_state  = "OK"
    exec_err_state = "Error"
  }

  rule {
    name      = "Application instance disk"
    condition = "C"
    for       = "15m"

    annotations = {
      summary     = "The application instance's root volume is more than ${100 - var.disk_free_threshold * 100}% full."
      description = "Images accumulate on this host. `docker image prune` runs at the end of every successful deploy, so a full disk usually means deploys have been failing."
    }

    labels = {
      environment = var.environment
      severity    = "warning"
    }

    data {
      ref_id         = "A"
      datasource_uid = var.prometheus_datasource_uid

      relative_time_range {
        from = 600
        to   = 0
      }

      # The reason this rule is here rather than in CloudWatch: EC2 publishes
      # CPU, network and status checks for free but not filesystem usage. The
      # CloudWatch agent would report it as a *custom* metric, which is the
      # charge ADR-0008 exists to avoid. The collector already reads it.
      model = jsonencode({
        refId   = "A"
        expr    = "min(node_filesystem_avail_bytes{mountpoint=\"/\"} / node_filesystem_size_bytes{mountpoint=\"/\"})"
        instant = true
      })
    }

    data {
      ref_id         = "B"
      datasource_uid = "__expr__"

      relative_time_range {
        from = 600
        to   = 0
      }

      model = jsonencode({
        refId      = "B"
        type       = "reduce"
        expression = "A"
        reducer    = "last"
      })
    }

    data {
      ref_id         = "C"
      datasource_uid = "__expr__"

      relative_time_range {
        from = 600
        to   = 0
      }

      model = jsonencode({
        refId      = "C"
        type       = "threshold"
        expression = "B"
        conditions = [{
          evaluator = {
            type   = "lt"
            params = [var.disk_free_threshold]
          }
        }]
      })
    }

    # Missing data here means the collector has stopped reporting, which is
    # itself worth knowing — unlike the judge rule above, this series exists as
    # soon as anything is running at all.
    no_data_state  = "Alerting"
    exec_err_state = "Error"
  }
}
