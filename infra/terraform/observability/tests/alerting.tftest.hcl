# What has to be true of the things that watch from outside.
#
# Mocked providers, so this needs no Grafana stack, no UptimeRobot account and
# no credentials — the same bargain the main stack's tests make, and the reason
# they can run on every pull request.

mock_provider "grafana" {}
mock_provider "uptimerobot" {}

variables {
  alert_email               = "operator@example.com"
  grafana_url               = "https://example.grafana.net"
  grafana_auth              = "test-token"
  uptimerobot_api_key       = "test-key"
  prometheus_datasource_uid = "test-datasource"
}

run "the_uptime_check_dials_the_real_site" {
  command = plan

  assert {
    # Not the instance, not the tunnel, not the home page. The home page is
    # static content Caddy serves happily with the backend and the database
    # both gone; only the health endpoint answers 503 in that case.
    condition     = uptimerobot_monitor.health.url == "https://godmodecode.markdsouza.dev/api/health"
    error_message = "The uptime check must dial the public hostname's health endpoint over TLS."
  }

  assert {
    condition     = uptimerobot_monitor.health.interval <= 300
    error_message = "An uptime check slower than five minutes is not a short interval."
  }

  assert {
    condition     = length(uptimerobot_monitor.health.alert_contact) > 0
    error_message = "The monitor has no alert contact. It would detect an outage and tell nobody."
  }
}

run "an_uptime_check_nobody_would_notice_is_refused" {
  command = plan

  variables {
    uptime_interval_seconds = 3600
  }

  expect_failures = [var.uptime_interval_seconds]
}

run "the_rules_cover_what_cloudwatch_cannot_see" {
  command = plan

  assert {
    condition     = length(grafana_rule_group.preceding_an_outage.rule) == 2
    error_message = "Expected the judge failure rate and the instance disk rules."
  }

  assert {
    # A quiet judge is not a broken judge. Alerting on absent series would page
    # somebody every night nobody plays, which is how an alert channel gets
    # muted.
    condition     = grafana_rule_group.preceding_an_outage.rule[0].no_data_state == "OK"
    error_message = "The judge rule must not alert when there are no Judgings at all."
  }

  assert {
    # The opposite call for the disk rule: this series exists whenever anything
    # is running, so its absence means the collector has stopped reporting —
    # which is worth being told about.
    condition     = grafana_rule_group.preceding_an_outage.rule[1].no_data_state == "Alerting"
    error_message = "A disk metric that stops arriving means the collector is gone, and must alert."
  }

  assert {
    condition = alltrue([
      for rule in grafana_rule_group.preceding_an_outage.rule : rule.condition == "C"
    ])
    error_message = "Every rule must reduce and threshold its query rather than alerting on the raw series."
  }
}

run "the_dashboard_is_the_one_in_the_repository" {
  command = plan

  assert {
    # Decoded rather than pattern-matched: the document is re-encoded on the
    # way through, so asserting on its whitespace would test the encoder.
    condition     = jsondecode(grafana_dashboard.gmc.config_json).uid == "god-mode-code"
    error_message = "The dashboard must be applied from the checked-in JSON, not assembled here."
  }

  assert {
    # Every panel points at `${datasource}`. With no selection pinned, that
    # variable resolves to whichever datasource the stack calls default, and
    # the dashboard silently reads from the wrong one — or from nothing.
    condition = one([
      for variable in jsondecode(grafana_dashboard.gmc.config_json).templating.list :
      variable.current.value if variable.name == "datasource"
    ]) == "test-datasource"
    error_message = "The dashboard must be pinned to the datasource the collector actually writes to."
  }

  assert {
    # The four readings the issue asks for, by the metric each one is built on.
    condition = alltrue([
      for expression in [
        "http_server_requests_seconds_count",
        "judge_judgings_total",
        "judge_judging_duration_seconds_sum",
        "hikaricp_connections_active",
      ] : strcontains(grafana_dashboard.gmc.config_json, expression)
    ])
    error_message = "The dashboard has lost a panel: request rates, Verdicts, judging durations and pool depth all have to be on it."
  }
}
