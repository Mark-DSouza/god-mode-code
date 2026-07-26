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

variable "judge_ami_id" {
  description = <<-EOT
    Machine image for the judge's host, built by docs/runbooks/judge-host.md.

    No default, and no fallback to the stock Amazon Linux image, because the
    judge's host has no route out: it cannot install a container runtime, pull
    an execution image or fetch its own binary at first boot. Everything it
    runs has to be on the disk before it boots, so the image is an input this
    stack genuinely cannot know — like the account identifiers above.
  EOT
  type        = string

  validation {
    condition     = can(regex("^ami-[0-9a-f]{8,17}$", var.judge_ami_id))
    error_message = "judge_ami_id must be an AMI identifier, e.g. ami-0123456789abcdef0."
  }
}

variable "judge_instance_type" {
  description = <<-EOT
    Judge instance. 1GB, which is what ADR-0005 sizes the Go supervisor and its
    sandbox containers against. Graviton, to match the execution image built
    for the same architecture.
  EOT
  type        = string
  default     = "t4g.micro"
}

variable "judge_port" {
  description = "The single port the judge listens on, and the only one the application may reach it over."
  type        = number
  default     = 9090
}

variable "judge_workers" {
  description = "How many sandbox containers may run at once. Two is the judge's own default on a 1GB host; raising it needs a measurement, not an opinion."
  type        = number
  default     = 2
}

variable "judge_volume_size" {
  description = "Judge root volume in GB. Holds the runtime, one execution image and the journal, with slack because nobody can log in to clear space."
  type        = number
  default     = 20
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
