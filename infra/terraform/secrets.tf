# Secrets.
#
# Parameter Store's Standard tier, which is free, rather than Secrets Manager at
# $0.40 per secret per month. Nothing here needs automatic rotation, which is
# the feature the difference actually buys.
#
# Nothing in this file is ever written to the repository or baked into an image.
# The instance reads these at boot and on each deploy using its instance
# profile; the values reach the container as environment variables and are never
# written to its filesystem.

locals {
  parameter_prefix = "/gmc/${var.environment}"

  # Assembled here rather than on the instance so there is exactly one
  # definition of how the application addresses its database. `sslmode=require`
  # matches the `rds.force_ssl` parameter group — without it the connection is
  # refused rather than silently downgraded.
  database_url = "jdbc:postgresql://${aws_db_instance.main.endpoint}/${aws_db_instance.main.db_name}?sslmode=require"
}

resource "aws_ssm_parameter" "database_url" {
  name  = "${local.parameter_prefix}/database/url"
  type  = "String"
  value = local.database_url
}

resource "aws_ssm_parameter" "database_username" {
  name  = "${local.parameter_prefix}/database/username"
  type  = "String"
  value = aws_db_instance.main.username
}

resource "aws_ssm_parameter" "database_password" {
  name = "${local.parameter_prefix}/database/password"
  # SecureString under the account's default `aws/ssm` key, which costs nothing.
  # A customer-managed key would be $1/month to protect a value that is already
  # only readable by one instance role.
  type  = "SecureString"
  value = random_password.db.result
}

resource "aws_ssm_parameter" "tunnel_token" {
  name        = "${local.parameter_prefix}/tunnel/token"
  description = "Credentials cloudflared uses to dial out and hold the tunnel open"
  type        = "SecureString"
  value       = data.cloudflare_zero_trust_tunnel_cloudflared_token.main.token
}

# The registry pull credential cannot be created by this stack — it is a GitHub
# personal access token, and GitHub is not a provider configured here. The
# parameter is declared so the instance role's permissions and the deploy script
# can both reference a resource that definitely exists, and its value is written
# out of band exactly once:
#
#   aws ssm put-parameter --overwrite --type SecureString \
#     --name /gmc/prod/registry/token --value "$GHCR_READ_TOKEN"
#
# `ignore_changes` is what stops the next `apply` from reverting that write back
# to the placeholder and breaking every subsequent image pull.
resource "aws_ssm_parameter" "registry_token" {
  name        = "${local.parameter_prefix}/registry/token"
  description = "Read-only GHCR token; value is set out of band, never by Terraform"
  type        = "SecureString"
  value       = "placeholder-set-out-of-band"

  lifecycle {
    ignore_changes = [value]
  }
}
