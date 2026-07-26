# Alarms on the conditions that precede an outage.
#
# CloudWatch, deliberately, and not in contradiction of ADR-0008. What that
# decision moves out of the account is *custom* metrics — the dozens a JVM emits
# through Micrometer, charged at $0.30 each. Everything alarmed on here is a
# built-in EC2 or RDS metric that AWS already collects for free, and an alarm
# over it costs $0.10/month. Paying Grafana Cloud nothing to re-collect what
# CloudWatch collects anyway would mean shipping it out through the collector
# first, which is more moving parts for a worse signal.
#
# The exception is disk on the instance. EC2 publishes CPU, network and status
# checks, but not filesystem usage — that needs an agent, and the CloudWatch
# agent's disk metrics are custom metrics, which is precisely the bill ADR-0008
# exists to avoid. The collector is already on the host reading it, so that one
# alarm is a Grafana rule instead (infra/terraform/observability).
#
# What is *not* here is uptime. A host that is down cannot report that it is
# down, so the check that matters most is external and lives in the
# observability stack alongside the Grafana rules.

locals {
  # One person operates this, so alarms go where the billing alerts already do
  # unless a separate address is given.
  alarm_email = var.alarm_email != "" ? var.alarm_email : var.budget_notification_email
}

resource "aws_sns_topic" "alarms" {
  name = "gmc-${var.environment}-alarms"
}

# Confirmation is a link in an email; Terraform creates the subscription in
# `pending confirmation` and cannot click it. Until somebody does, the alarms
# fire into a topic nobody is listening to — which the verification runbook
# checks for exactly that reason.
resource "aws_sns_topic_subscription" "alarms_email" {
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = local.alarm_email
}

# ---------------------------------------------------------------------------
# The application instance
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_metric_alarm" "app_cpu" {
  alarm_name        = "gmc-${var.environment}-app-cpu"
  alarm_description = "Application instance CPU has been saturated for fifteen minutes."

  namespace   = "AWS/EC2"
  metric_name = "CPUUtilization"
  dimensions  = { InstanceId = aws_instance.app.id }

  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  # Three five-minute periods rather than one. A deploy rebuilds nothing but it
  # does restart a JVM, and a single-period alarm on a burstable instance fires
  # on every release.
  period             = 300
  evaluation_periods = 3

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]
}

# The one that actually predicts the outage on a burstable instance. Credits are
# `standard` (ADR-0001), so exhausting them does not cost money — it throttles
# the instance to its baseline, and the site becomes slow rather than expensive.
# This is the warning that the slowness is coming.
resource "aws_cloudwatch_metric_alarm" "app_cpu_credits" {
  alarm_name        = "gmc-${var.environment}-app-cpu-credits"
  alarm_description = "Application instance is running out of CPU credits and will throttle to its baseline."

  namespace   = "AWS/EC2"
  metric_name = "CPUCreditBalance"
  dimensions  = { InstanceId = aws_instance.app.id }

  statistic           = "Average"
  comparison_operator = "LessThanThreshold"
  threshold           = 30
  period              = 300
  evaluation_periods  = 2

  alarm_actions = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "app_status_check" {
  alarm_name        = "gmc-${var.environment}-app-status-check"
  alarm_description = "The application instance is failing its status checks — the hypervisor or the operating system is unwell."

  namespace   = "AWS/EC2"
  metric_name = "StatusCheckFailed"
  dimensions  = { InstanceId = aws_instance.app.id }

  statistic           = "Maximum"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 0
  period              = 60
  evaluation_periods  = 2

  # A stopped instance publishes nothing, and "no data" here means the host is
  # gone — which is the loudest thing this alarm can be told. Treating it as
  # missing would make the alarm silent in exactly that case.
  treat_missing_data = "breaching"

  alarm_actions = [aws_sns_topic.alarms.arn]
}

# ---------------------------------------------------------------------------
# The database
# ---------------------------------------------------------------------------

# Connection saturation, which is the failure this application will meet first.
# The pool is capped at ten (application.yaml) and db.t4g.micro allows about
# eighty, so this fires when something is leaking connections rather than when
# traffic is merely high.
resource "aws_cloudwatch_metric_alarm" "database_connections" {
  alarm_name        = "gmc-${var.environment}-database-connections"
  alarm_description = "Database connections are far above what one pool of ten should ever open."

  namespace   = "AWS/RDS"
  metric_name = "DatabaseConnections"
  dimensions  = { DBInstanceIdentifier = aws_db_instance.main.identifier }

  statistic           = "Maximum"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 25
  period              = 300
  evaluation_periods  = 2

  alarm_actions = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "database_storage" {
  alarm_name        = "gmc-${var.environment}-database-storage"
  alarm_description = "The database has less than 2GB of its 20GB left."

  namespace   = "AWS/RDS"
  metric_name = "FreeStorageSpace"
  dimensions  = { DBInstanceIdentifier = aws_db_instance.main.identifier }

  statistic           = "Average"
  comparison_operator = "LessThanThreshold"
  threshold           = 2 * 1024 * 1024 * 1024
  period              = 300
  evaluation_periods  = 1

  alarm_actions = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_metric_alarm" "database_cpu" {
  alarm_name        = "gmc-${var.environment}-database-cpu"
  alarm_description = "Database CPU has been saturated for fifteen minutes."

  namespace   = "AWS/RDS"
  metric_name = "CPUUtilization"
  dimensions  = { DBInstanceIdentifier = aws_db_instance.main.identifier }

  statistic           = "Average"
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  period              = 300
  evaluation_periods  = 3

  alarm_actions = [aws_sns_topic.alarms.arn]
}
