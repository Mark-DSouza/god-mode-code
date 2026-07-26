# Inputs.
#
# Defaults encode the decisions already made in the ADRs rather than leaving
# them to whoever runs `apply`. A variable with no default is one this stack
# genuinely cannot know: an account-specific identifier or a secret.

variable "region" {
  description = "AWS region. Mumbai, so the database sits beside the compute and the latency is India-local (ADR-0001)."
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name, used in resource names and tags."
  type        = string
  default     = "prod"
}

variable "vpc_cidr" {
  description = "Address space for the VPC."
  type        = string
  default     = "10.0.0.0/16"
}

variable "hostname" {
  description = "The single origin the whole application is served from (ADR-0002)."
  type        = string
  default     = "godmodecode.markdsouza.dev"
}

variable "cloudflare_zone_id" {
  description = "Zone the hostname belongs to."
  type        = string
}

variable "cloudflare_account_id" {
  description = "Cloudflare account that owns the tunnel."
  type        = string
}

variable "cloudflare_api_token" {
  description = "API token with Zone:DNS:Edit and Account:Cloudflare Tunnel:Edit."
  type        = string
  sensitive   = true
}

variable "app_instance_type" {
  description = <<-EOT
    Application instance. 2GB, because Spring Boot at -Xmx512m lands around
    700MB resident alongside Caddy, cloudflared and the operating system
    (ADR-0009). Graviton, because it is the cheapest way to buy that memory.
  EOT
  type        = string
  default     = "t4g.small"
}

variable "db_instance_class" {
  description = "Managed PostgreSQL instance class."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "Database storage in GB. gp3's floor for this class; there is no cheaper size."
  type        = number
  default     = 20
}

variable "db_engine_version" {
  description = "PostgreSQL major version. Matches the container the tests run against, so a migration cannot pass locally and fail here."
  type        = string
  default     = "17"
}

variable "backup_retention_days" {
  description = "Automated backup retention. Seven days, which is also what enables point-in-time recovery."
  type        = number
  default     = 7

  validation {
    # Retention of 0 disables automated backups *and* point-in-time recovery
    # silently. Refusing at plan time is cheaper than discovering it during a
    # restore.
    condition     = var.backup_retention_days >= 7
    error_message = "Backup retention must be at least 7 days; point-in-time recovery depends on it."
  }
}

variable "budget_limit" {
  description = "Monthly spend at which compute is stopped outright (ADR-0001)."
  type        = number
  default     = 50
}

variable "budget_alert_thresholds" {
  description = "Percentages of the limit at which billing alerts fire. Well below the halt, so the alert is a warning rather than a post-mortem."
  type        = list(number)
  default     = [50, 75, 90]
}

variable "budget_notification_email" {
  description = "Where billing alerts are sent."
  type        = string
}

variable "grafana_prometheus_url" {
  description = "Grafana Cloud Prometheus remote-write endpoint. Empty leaves the collector unstarted, which is a supported state (ADR-0008)."
  type        = string
  default     = ""
}

variable "grafana_prometheus_username" {
  description = "Grafana Cloud Prometheus instance id — the numeric user shown beside the endpoint."
  type        = string
  default     = ""
}

variable "grafana_loki_url" {
  description = "Grafana Cloud Loki push endpoint."
  type        = string
  default     = ""
}

variable "grafana_loki_username" {
  description = "Grafana Cloud Loki instance id."
  type        = string
  default     = ""
}

variable "judge_metrics_address" {
  description = <<-EOT
    host:port of the judge's scrape endpoint, reached over the private link.
    The judge has no egress and cannot ship its own telemetry, so the
    application host carries it (ADR-0005). Empty until the judge's instance
    lands with issue #13, and an empty value drops the target rather than
    leaving a permanently unreachable one on the dashboard.
  EOT
  type        = string
  default     = ""
}

variable "alarm_email" {
  description = "Where infrastructure alarms are sent. Defaults to the billing address, since one person operates this."
  type        = string
  default     = ""
}

variable "github_repository" {
  description = "owner/name of the source repository, used to scope the deploy role's trust policy."
  type        = string
  default     = "Mark-DSouza/god-mode-code"
}

variable "image_repository_prefix" {
  description = <<-EOT
    Namespace the deployable images live in, in the registry attached to the
    source host. The deploy document will refuse any image reference outside
    it, so this is a security control rather than a convenience.
  EOT
  type        = string
  default     = "ghcr.io/mark-dsouza/god-mode-code"
}
