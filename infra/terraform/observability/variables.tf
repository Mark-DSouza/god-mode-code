variable "environment" {
  description = "Environment name, matched against the label the collector stamps on everything it ships."
  type        = string
  default     = "prod"
}

variable "hostname" {
  description = "The single origin the application is served from. What the uptime check actually dials."
  type        = string
  default     = "godmodecode.markdsouza.dev"
}

variable "alert_email" {
  description = "Where an outage is announced. The one address that has to be right."
  type        = string
}

variable "uptime_interval_seconds" {
  description = <<-EOT
    How often the external check runs. Five minutes is the floor on
    UptimeRobot's free plan; a shorter interval needs a paid one. That is the
    detection delay for a total outage, and it is the number to reduce first if
    this ever becomes something people rely on.
  EOT
  type        = number
  default     = 300

  validation {
    # Anything longer is not an uptime check, it is a daily digest.
    condition     = var.uptime_interval_seconds <= 900
    error_message = "An uptime check slower than fifteen minutes cannot tell you about an outage in time to matter."
  }
}

variable "grafana_url" {
  description = "Grafana Cloud stack URL, e.g. https://<stack>.grafana.net."
  type        = string
}

variable "grafana_auth" {
  description = "Grafana service account token with dashboard and alert-rule write access."
  type        = string
  sensitive   = true
}

variable "uptimerobot_api_key" {
  description = "UptimeRobot main API key."
  type        = string
  sensitive   = true
}

variable "prometheus_datasource_uid" {
  description = "UID of the Prometheus datasource in the Grafana stack that the collector remote-writes into."
  type        = string
}

variable "judge_failure_rate_threshold" {
  description = "Fraction of Judgings ending in error or timeout above which the judge is considered unwell."
  type        = number
  default     = 0.2
}

variable "disk_free_threshold" {
  description = "Fraction of the root volume left below which the instance is considered close to filling."
  type        = number
  default     = 0.15
}
