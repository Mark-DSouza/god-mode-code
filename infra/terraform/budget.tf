# Cost control.
#
# AWS has no hard spending cap and never will, so protection here is structural
# rather than a limit: fixed-size instances that cost the same under load, no
# NAT gateway, `standard` CPU credits, a dedicated account — and this file, the
# backstop for whatever those failed to anticipate (ADR-0001).
#
# Budgets needs no aliased provider: it is a global service and the SDK routes
# to its global endpoint whatever region is configured. The action below still
# names ap-south-1 explicitly, because that is where the instances it stops are.

# The role Budgets assumes to actually stop things. Without an action, a budget
# is a notification that arrives while the bill continues to grow.
resource "aws_iam_role" "budget_action" {
  name = "gmc-${var.environment}-budget-action"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "budgets.amazonaws.com" }
      Action    = "sts:AssumeRole"
      Condition = {
        # Without this, any AWS customer's budget could in principle be
        # configured to assume this role — the classic confused deputy. The
        # source account must be ours.
        StringEquals = {
          "aws:SourceAccount" = data.aws_caller_identity.current.account_id
        }
      }
    }]
  })
}

# AWS's own managed policy for budget actions that control resources. It is
# narrower than it looks: it permits stopping and starting compute, and nothing
# that could create any.
resource "aws_iam_role_policy_attachment" "budget_action" {
  role       = aws_iam_role.budget_action.name
  policy_arn = "arn:aws:iam::aws:policy/AWSBudgetsActionsWithAWSResourceControlAccess"
}

resource "aws_budgets_budget" "monthly" {
  name         = "gmc-${var.environment}-monthly"
  budget_type  = "COST"
  limit_amount = tostring(var.budget_limit)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"

  # Alerts fire on *forecast* as well as actual spend. By the time actual spend
  # has crossed 90% of the limit the month is nearly over and the money is
  # already gone; a forecast crossing is the one that can still be acted on.
  dynamic "notification" {
    for_each = var.budget_alert_thresholds
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.budget_notification_email]
    }
  }

  dynamic "notification" {
    for_each = var.budget_alert_thresholds
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = notification.value
      threshold_type             = "PERCENTAGE"
      notification_type          = "FORECASTED"
      subscriber_email_addresses = [var.budget_notification_email]
    }
  }
}

# The halt. At 100% of the limit, compute stops.
#
# This is a blunt instrument and is meant to be: it takes the site down. That
# is the correct trade for a personal project on an account with no spending
# cap, where the failure mode being defended against is a compromised host
# mining cryptocurrency or exfiltrating data at $0.09/GB (ADR-0005). A site
# that is down costs nothing; a site that is up under those conditions costs
# five figures.
resource "aws_budgets_budget_action" "stop_compute" {
  budget_name        = aws_budgets_budget.monthly.name
  action_type        = "RUN_SSM_DOCUMENTS"
  approval_model     = "AUTOMATIC"
  notification_type  = "ACTUAL"
  execution_role_arn = aws_iam_role.budget_action.arn

  action_threshold {
    action_threshold_type  = "PERCENTAGE"
    action_threshold_value = 100
  }

  definition {
    ssm_action_definition {
      action_sub_type = "STOP_EC2_INSTANCES"
      region          = var.region
      # Listed explicitly rather than by tag, because this API takes instance
      # ids. The judge's instance joins this list when it lands (issue #13) —
      # ADR-0001 describes the halt as stopping both instances, and an instance
      # missing from here is one the halt cannot reach.
      instance_ids = [aws_instance.app.id]
    }
  }

  subscriber {
    address           = var.budget_notification_email
    subscription_type = "EMAIL"
  }
}
