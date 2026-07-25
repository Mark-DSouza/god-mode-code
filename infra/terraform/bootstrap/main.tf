# State backend bootstrap.
#
# A chicken-and-egg module: the main stack keeps its state in S3, and something
# has to create that bucket before the main stack can initialise. This is that
# something, and it is the only Terraform here that keeps its state locally.
#
# Run once, by hand, into a new account:
#
#   terraform -chdir=infra/terraform/bootstrap init
#   terraform -chdir=infra/terraform/bootstrap apply
#
# Losing this module's local state is recoverable and not an emergency — the
# bucket still exists, and `terraform import` puts it back under management.
# Nothing else depends on this state file.

terraform {
  required_version = "~> 1.15"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "god-mode-code"
      ManagedBy = "terraform"
      Purpose   = "terraform-state"
    }
  }
}

variable "region" {
  description = "Region the state bucket lives in. Same as the stack, so a regional outage takes both or neither."
  type        = string
  default     = "ap-south-1"
}

variable "bucket_name" {
  description = "Globally unique name for the state bucket."
  type        = string
}

resource "aws_s3_bucket" "state" {
  bucket = var.bucket_name

  # Terraform state describes the entire account. Deleting this bucket by
  # accident is not something to be one command away from.
  lifecycle {
    prevent_destroy = true
  }
}

# State is the record of what exists. A corrupt or truncated write with no
# previous version to fall back to is the worst failure this stack has, because
# it is the one that cannot be recovered by re-running anything.
resource "aws_s3_bucket_versioning" "state" {
  bucket = aws_s3_bucket.state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# State contains the database password in plain text. It is not a secret store
# and must never be reachable from outside the account.
resource "aws_s3_bucket_public_access_block" "state" {
  bucket = aws_s3_bucket.state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Old versions accumulate forever otherwise. Ninety days is comfortably longer
# than anyone would take to notice a bad apply.
resource "aws_s3_bucket_lifecycle_configuration" "state" {
  bucket = aws_s3_bucket.state.id

  rule {
    id     = "expire-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = 90
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

output "backend_config" {
  description = "Pass to `terraform init -backend-config=` for the main stack."
  value       = <<-EOT
    bucket = "${aws_s3_bucket.state.id}"
    region = "${var.region}"
  EOT
}
