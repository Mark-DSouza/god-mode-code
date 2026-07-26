# Observability invariants.
#
# The properties here are the ones that fail silently. An alarm with no action,
# a collector that never starts, a backend still writing lines nothing can
# parse — all of them look exactly like a working setup right up until the
# morning you need them, which is the worst possible moment to find out.
#
# Like the other suites these run against a plan with mocked providers: no AWS
# account, no credentials, no money.

mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = {
      names = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
    }
  }

  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

mock_provider "cloudflare" {}

variables {
  cloudflare_zone_id        = "0123456789abcdef0123456789abcdef"
  cloudflare_account_id     = "fedcba9876543210fedcba9876543210"
  cloudflare_api_token      = "test-token"
  budget_notification_email = "billing@example.com"
}

run "every_alarm_actually_tells_somebody" {
  command = plan

  assert {
    # An alarm with no action is a coloured square on a page nobody has open.
    condition = alltrue([
      for alarm in [
        aws_cloudwatch_metric_alarm.app_cpu,
        aws_cloudwatch_metric_alarm.app_cpu_credits,
        aws_cloudwatch_metric_alarm.app_status_check,
        aws_cloudwatch_metric_alarm.database_connections,
        aws_cloudwatch_metric_alarm.database_storage,
        aws_cloudwatch_metric_alarm.database_cpu,
      ] : length(alarm.alarm_actions) > 0
    ])
    error_message = "An alarm has no action. It will change colour and tell nobody."
  }

  assert {
    condition     = aws_sns_topic_subscription.alarms_email.endpoint == "billing@example.com"
    error_message = "Alarms must fall back to the billing address when no separate one is given."
  }
}

run "a_missing_instance_is_treated_as_a_failing_one" {
  command = plan

  assert {
    # A stopped instance publishes no status checks at all. Treating that as
    # "no data" makes the alarm silent in the one case it exists for.
    condition     = aws_cloudwatch_metric_alarm.app_status_check.treat_missing_data == "breaching"
    error_message = "The status check alarm must treat missing data as breaching; a host that is gone publishes nothing."
  }
}

run "the_backend_ships_logs_a_machine_can_read" {
  command = plan

  assert {
    condition     = strcontains(aws_ssm_document.deploy.content, "GMC_LOG_FORMAT=ecs")
    error_message = "The deploy must start the backend in structured logging mode, or the collector ships lines Loki can only regex."
  }

  assert {
    condition     = strcontains(aws_ssm_document.deploy.content, "--log-driver journald")
    error_message = "Containers must log to the journal; it is the only source the collector reads."
  }

  assert {
    # The deploy makes the journal persistent, not the bootstrap. Amazon Linux
    # keeps it in memory, so without this the collector mounts an empty
    # directory the container runtime invented and reads nothing.
    condition     = strcontains(aws_ssm_document.deploy.content, "install -d -m 2755 /var/log/journal")
    error_message = "Nothing creates /var/log/journal, so the collector would read an empty directory."
  }

  assert {
    # It has to stay out of `user_data`: that is the instance's own definition,
    # and `user_data_replace_on_change` turns any edit to it into a rebuild of
    # the host — an outage, to create one directory.
    condition     = !strcontains(aws_instance.app.user_data, "/var/log/journal")
    error_message = "Journal setup has moved back into the bootstrap, where editing it replaces the instance."
  }

  assert {
    # Guards the guard. The assertion above is a negative, and an empty or
    # unknown `user_data` would satisfy it while proving nothing.
    condition     = strcontains(aws_instance.app.user_data, "Installing cloudflared")
    error_message = "user_data is not readable at plan time, so the assertion above proves nothing."
  }
}

run "the_collector_is_delivered_by_the_deploy" {
  command = plan

  assert {
    condition     = strcontains(aws_ssm_document.deploy.content, "gmc-alloy")
    error_message = "The deploy must start the collector; nothing else on the host will."
  }

  assert {
    # Pinned, because this is the one container on the host that is not built
    # here. `latest` would change the collector's behaviour on a deploy that
    # changed nothing about it.
    condition     = !strcontains(local.collector_image, ":latest")
    error_message = "The collector image must be pinned to a version."
  }

  assert {
    condition     = strcontains(aws_ssm_document.deploy.content, "/actuator/prometheus")
    error_message = "The collector configuration must reach the backend's scrape endpoint."
  }
}

run "the_collector_never_gets_a_container_socket" {
  command = plan

  assert {
    # The usual way to collect container logs mounts the container socket,
    # which is root on this host for whoever reaches it. The containers log to
    # the journal and the collector reads that instead. This is the same rule
    # ADR-0005 states for the judge, applied to the one other component that
    # would plausibly want one.
    condition     = !strcontains(aws_ssm_document.deploy.content, "docker.sock")
    error_message = "Something in the deploy mounts the container socket. Nothing on this host may."
  }
}

run "telemetry_credentials_are_encrypted_and_not_in_the_repository" {
  command = plan

  assert {
    condition     = aws_ssm_parameter.grafana_token.type == "SecureString"
    error_message = "The Grafana Cloud token must be stored encrypted."
  }

  assert {
    # Written out of band, exactly like the registry token. A real value here
    # would mean a credential had been committed.
    condition     = aws_ssm_parameter.grafana_token.value == "placeholder-set-out-of-band"
    error_message = "The Grafana Cloud token must not be set by Terraform; it is written out of band."
  }
}
