# Outputs.
#
# What another operator, or the deploy workflow, needs in order to use this
# stack. Nothing sensitive: the database password and the tunnel token live in
# Parameter Store and are readable only by the instance role.

output "site_url" {
  description = "The single origin the application is served from."
  value       = "https://${var.hostname}"
}

output "app_instance_id" {
  description = "Application instance. The target of the deploy command and of the budget halt."
  value       = aws_instance.app.id
}

output "deploy_document_name" {
  description = "Systems Manager document the deploy workflow invokes."
  value       = aws_ssm_document.deploy.name
}

output "deploy_role_arn" {
  description = "Role continuous integration assumes by OIDC. Set as AWS_DEPLOY_ROLE_ARN in the repository."
  value       = aws_iam_role.github_deploy.arn
}

output "database_endpoint" {
  description = "Managed PostgreSQL endpoint. Reachable only from the application's security group."
  value       = aws_db_instance.main.endpoint
}

output "database_identifier" {
  description = "Database identifier, needed by the restore drill in docs/runbooks/database-restore.md."
  value       = aws_db_instance.main.identifier
}

output "app_security_group_id" {
  description = "Application security group. The judge's instance allows ingress only from this."
  value       = aws_security_group.app.id
}

output "private_subnet_ids" {
  description = "Routeless private subnets. The database and the judge's instance."
  value       = aws_subnet.private[*].id
}

output "judge_instance_id" {
  description = "Judge instance. There is no way onto it; this is for stopping and replacing it."
  value       = aws_instance.judge.id
}

output "judge_url" {
  description = "Where the application reaches the judge. Fixed, so replacing the judge does not require redeploying the application."
  value       = local.judge_url
}
