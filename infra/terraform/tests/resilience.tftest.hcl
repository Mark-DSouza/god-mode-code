# Cost and durability invariants.
#
# The two ways this project can fail badly are a surprise bill on an account
# with no spending cap (ADR-0001) and a database that turns out not to have
# been backed up. Both are silent until they are catastrophic, which is exactly
# the shape of problem worth spending tests on.

mock_provider "aws" {
  mock_data "aws_availability_zones" {
    defaults = {
      names = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
    }
  }

  # `aws_iam_policy_document` normally computes its `json` attribute inside the
  # provider. Mocked, it returns an arbitrary string, which the IAM resources
  # then reject as invalid policy JSON before any assertion runs. These tests
  # are not about policy contents, so a minimal valid document is enough.
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }

  # One `run` block below applies rather than plans, because instance
  # identifiers do not exist until apply. Mocked, an ARN comes back as an
  # arbitrary string, which the budget action rejects before any assertion
  # runs. Nothing here is under test; it is the shape the API would return.
  mock_resource "aws_iam_role" {
    defaults = {
      arn = "arn:aws:iam::123456789012:role/mock"
    }
  }

  # Same reason, for the topic the alarms publish to: the alarms and the email
  # subscription both take an ARN, and an arbitrary mocked string is rejected as
  # malformed on `apply` before any assertion runs.
  mock_resource "aws_sns_topic" {
    defaults = {
      arn = "arn:aws:sns:ap-south-1:123456789012:mock"
    }
  }
}

mock_provider "cloudflare" {}

variables {
  cloudflare_zone_id        = "0123456789abcdef0123456789abcdef"
  cloudflare_account_id     = "fedcba9876543210fedcba9876543210"
  cloudflare_api_token      = "test-token"
  budget_notification_email = "billing@example.com"
  judge_ami_id              = "ami-0123456789abcdef0"
}

run "burstable_cpu_throttles_rather_than_billing" {
  command = plan

  assert {
    # `unlimited` keeps performing under sustained load and bills the surplus.
    # On an account with no hard cap, predictable slowness is the safer failure
    # mode (ADR-0001).
    condition     = aws_instance.app.credit_specification[0].cpu_credits == "standard"
    error_message = "Burstable CPU credits must be `standard`, or sustained load bills surplus charges instead of throttling."
  }

  assert {
    # The judge matters more than the application here. It is the host that
    # runs untrusted code, so the sustained-CPU case worth planning for is a
    # miner rather than a busy afternoon — and on `standard` a miner throttles
    # to the baseline instead of generating surplus charges (ADR-0005).
    condition     = aws_instance.judge.credit_specification[0].cpu_credits == "standard"
    error_message = "The judge's CPU credits must be `standard`, or a miner on that host bills the surplus."
  }
}

run "compute_is_halted_before_the_bill_runs_away" {
  command = plan

  assert {
    condition     = aws_budgets_budget.monthly.limit_amount == "50"
    error_message = "The monthly budget limit should be the $50 described in ADR-0001."
  }

  assert {
    condition     = aws_budgets_budget_action.stop_compute.action_threshold[0].action_threshold_value == 100
    error_message = "The halt must fire at 100% of the limit."
  }

  assert {
    condition     = aws_budgets_budget_action.stop_compute.approval_model == "AUTOMATIC"
    error_message = "A halt that waits for a human approval is not a halt; nobody is present to approve it."
  }

  assert {
    # Alerts have to arrive with room to act. An alert at the same threshold as
    # the halt is a post-mortem, not a warning.
    condition     = alltrue([for t in var.budget_alert_thresholds : t < 100])
    error_message = "Billing alerts must fire below the halt threshold."
  }
}

# The one assertion here that needs identifiers, and identifiers do not exist
# until apply — so this block applies, against the same mocked providers the
# rest of the file plans against. Nothing is created and no credentials are
# used; the mocks generate the identifiers the real API would have returned.
run "the_halt_reaches_every_instance" {
  command = apply

  assert {
    # Both instances. The judge especially: it is the box running untrusted
    # code, so it is the likeliest source of the mining workload this halt
    # exists to stop, and an instance missing from this list is one the halt
    # cannot reach.
    condition = setintersection(
      toset(aws_budgets_budget_action.stop_compute.definition[0].ssm_action_definition[0].instance_ids),
      toset([aws_instance.app.id, aws_instance.judge.id])
      ) == toset([aws_instance.app.id, aws_instance.judge.id]
    )
    error_message = "The halt must stop both the application and the judge."
  }
}

run "the_database_can_actually_be_recovered" {
  command = plan

  assert {
    # Point-in-time recovery on RDS is not a separate switch — it is what a
    # non-zero retention period buys.
    condition     = aws_db_instance.main.backup_retention_period >= 7
    error_message = "Seven days of automated backups is what enables point-in-time recovery."
  }

  assert {
    condition     = aws_db_instance.main.deletion_protection
    error_message = "The production database must not be destroyable by a stray plan."
  }

  assert {
    condition     = aws_db_instance.main.skip_final_snapshot == false
    error_message = "Destroying the database must leave a final snapshot behind."
  }

  assert {
    condition     = aws_db_instance.main.delete_automated_backups == false
    error_message = "Automated backups must outlive the instance; losing them with it defeats the point."
  }
}

run "backup_retention_shorter_than_a_week_is_refused" {
  command = plan

  variables {
    backup_retention_days = 1
  }

  # Retention below seven silently shortens the point-in-time recovery window,
  # and zero disables both it and automated backups altogether. Failing at plan
  # time is considerably cheaper than discovering it during a restore.
  expect_failures = [var.backup_retention_days]
}

run "the_database_is_beside_the_compute" {
  command = plan

  assert {
    # Two subnets, because a subnet group requires two availability zones even
    # for a single-AZ instance. Asserted on the subnets themselves rather than
    # on the group, whose members are unknown until the subnets exist.
    condition     = length(aws_subnet.private) == 2
    error_message = "A subnet group needs two availability zones, even for a single-AZ instance."
  }

  assert {
    # Cross-region would add latency to every query and a data-transfer charge
    # to every byte. Availability zone names are prefixed by their region, so
    # this checks the database's subnets and the instance's subnet are all in
    # the region the stack is configured for.
    condition = alltrue([
      for az in concat(aws_subnet.private[*].availability_zone, [aws_subnet.public.availability_zone]) :
      startswith(az, var.region)
    ])
    error_message = "The database must be in the same region as the compute."
  }
}
