# Deploying.
#
# Continuous integration assumes a role by OIDC and sends one Systems Manager
# command. There is no SSH key, no runner with standing credentials, and
# nothing listening on the instance — which is what lets the security group
# stay empty of inbound rules while the application still ships on every push
# to the default branch.

locals {
  # Dots are regex wildcards, so an unescaped prefix would also match
  # `ghcrxio`. Anchored at both ends, with the tag constrained to the character
  # set a commit SHA uses.
  escaped_image_prefix = replace(var.image_repository_prefix, ".", "\\.")

  api_image_pattern = "^${local.escaped_image_prefix}/api:[a-zA-Z0-9._-]+$"
  web_image_pattern = "^${local.escaped_image_prefix}/web:[a-zA-Z0-9._-]+$"
}

resource "aws_ssm_document" "deploy" {
  name            = "gmc-${var.environment}-deploy"
  document_type   = "Command"
  document_format = "YAML"

  content = yamlencode({
    schemaVersion = "2.2"
    description   = "Pull, replace and health-check the god-mode-code application containers"
    parameters = {
      apiImage = {
        type        = "String"
        description = "Fully qualified backend image reference, tagged with an immutable commit SHA"
        # Rejects anything outside this project's own registry namespace. The
        # value arrives from a workflow, and a document that will pull and run
        # whatever image reference it is handed is a remote code execution
        # primitive wearing a deploy script's clothes.
        allowedPattern = local.api_image_pattern
      }
      webImage = {
        type           = "String"
        description    = "Fully qualified reverse-proxy image reference, tagged with an immutable commit SHA"
        allowedPattern = local.web_image_pattern
      }
    }
    mainSteps = [{
      action = "aws:runShellScript"
      name   = "deploy"
      inputs = {
        # Split into lines because that is the shape Systems Manager expects;
        # the script itself lives in `templates/deploy.sh.tftpl` where it can be
        # read and reviewed as a shell script rather than as an embedded string.
        runCommand = split("\n", templatefile("${path.module}/templates/deploy.sh.tftpl", {
          region           = var.region
          parameter_prefix = local.parameter_prefix
          registry         = "ghcr.io"
        }))
      }
    }]
  })
}

# ---------------------------------------------------------------------------
# The role continuous integration assumes
# ---------------------------------------------------------------------------

# GitHub's OIDC issuer. Federation rather than an access key means there is no
# long-lived credential in repository secrets to leak, rotate or forget.
resource "aws_iam_openid_connect_provider" "github" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # Scoped to the default branch of one repository. Without a `sub`
    # condition this role is assumable from any workflow in any repository on
    # GitHub, which is the single most common way an OIDC trust policy is got
    # wrong. Restricting to `ref:refs/heads/main` also means a pull request
    # from a fork cannot deploy.
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:ref:refs/heads/main"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "gmc-${var.environment}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid     = "SendTheDeployCommand"
    effect  = "Allow"
    actions = ["ssm:SendCommand"]
    # Both halves are required: the document it may run, and the instance it
    # may run it on. Granting the document alone would allow deploying to any
    # instance in the account; granting the instance alone would allow running
    # any document — including AWS's own arbitrary-shell-command one — on the
    # production host.
    resources = [
      aws_ssm_document.deploy.arn,
      "arn:aws:ec2:${var.region}:${data.aws_caller_identity.current.account_id}:instance/${aws_instance.app.id}",
    ]
  }

  statement {
    sid    = "WatchItFinish"
    effect = "Allow"
    actions = [
      "ssm:GetCommandInvocation",
      "ssm:ListCommandInvocations",
    ]
    # These are read-only and are not addressable by command id in advance,
    # since the id does not exist until SendCommand returns.
    resources = ["*"]
  }

  statement {
    sid     = "FindTheInstance"
    effect  = "Allow"
    actions = ["ec2:DescribeInstances"]
    # The workflow looks the instance up by tag rather than being told its id.
    # Changing the bootstrap script replaces the instance, and a workflow
    # holding a hardcoded id would deploy to something that no longer exists —
    # whereas the policy above is re-applied with the new id by the same
    # Terraform run that caused the replacement.
    #
    # `DescribeInstances` does not support resource-level permissions; AWS
    # rejects any ARN here. It is read-only and reveals nothing an attacker
    # who already holds this role could not infer.
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "send-deploy-command"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
