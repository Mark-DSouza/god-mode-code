# Provider and Terraform version constraints.
#
# Versions are pinned with `~>` rather than left open. Infrastructure that
# silently re-plans because a provider released a minor version is
# infrastructure whose diffs cannot be trusted, and the entire value of
# declaring this stack as code is that the diff means something (ADR-0001).

terraform {
  required_version = "~> 1.15"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  # State lives in S3 in the same account the stack is applied to, created by
  # `bootstrap/` before this module is ever initialised.
  #
  # `use_lockfile` is S3-native locking, which replaced the DynamoDB table the
  # older documentation still describes. One less resource to pay for and one
  # less thing that can drift out of existence while holding a lock.
  #
  # Values are supplied by `backend.hcl` at init time rather than hardcoded, so
  # the whole stack can be stood up in a different account — which is the
  # property that keeps the hosting decision reversible (ADR-0001).
  backend "s3" {
    key          = "godmodecode/terraform.tfstate"
    encrypt      = true
    use_lockfile = true
  }
}
