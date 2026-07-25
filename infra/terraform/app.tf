# The application host.
#
# One instance running three things: `cloudflared` holding the tunnel open,
# Caddy serving the built SPA and proxying `/api/*`, and Spring Boot behind it.
# All three on one box on one origin, which is what removes CORS from the
# architecture entirely (ADR-0002).

# Amazon Linux 2023 on Graviton, resolved at plan time from the public
# parameter AWS maintains, so a rebuild from nothing picks up a patched image
# rather than a hardcoded AMI id that stopped existing.
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

# ---------------------------------------------------------------------------
# Identity
# ---------------------------------------------------------------------------

resource "aws_iam_role" "app" {
  name = "gmc-${var.environment}-app"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Session Manager. This is the only administrative access path, and it is what
# makes "no inbound ports" survivable rather than a way to lock yourself out:
# the agent connects outbound, so there is no sshd and no port 22.
resource "aws_iam_role_policy_attachment" "app_ssm" {
  role       = aws_iam_role.app.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "app_parameters" {
  statement {
    sid    = "ReadOwnParameters"
    effect = "Allow"
    actions = [
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath",
    ]
    # Scoped to this environment's prefix. A role that can read every parameter
    # in the account is a role whose blast radius is the account.
    resources = ["arn:aws:ssm:${var.region}:${data.aws_caller_identity.current.account_id}:parameter${local.parameter_prefix}/*"]
  }

  statement {
    sid       = "DecryptSecureStrings"
    effect    = "Allow"
    actions   = ["kms:Decrypt"]
    resources = [data.aws_kms_key.ssm.arn]

    # Decryption is allowed only when it happens *through* Parameter Store, so
    # this grant cannot be reused to read anything else the key protects.
    condition {
      test     = "StringEquals"
      variable = "kms:ViaService"
      values   = ["ssm.${var.region}.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "app_parameters" {
  name   = "read-parameters"
  role   = aws_iam_role.app.id
  policy = data.aws_iam_policy_document.app_parameters.json
}

resource "aws_iam_instance_profile" "app" {
  name = "gmc-${var.environment}-app"
  role = aws_iam_role.app.name
}

data "aws_caller_identity" "current" {}

data "aws_kms_key" "ssm" {
  key_id = "alias/aws/ssm"
}

# ---------------------------------------------------------------------------
# Instance
# ---------------------------------------------------------------------------

resource "aws_instance" "app" {
  ami                  = data.aws_ssm_parameter.al2023.value
  instance_type        = var.app_instance_type
  subnet_id            = aws_subnet.public.id
  iam_instance_profile = aws_iam_instance_profile.app.name

  vpc_security_group_ids = [aws_security_group.app.id]

  # No key pair. There is nothing to SSH into, so a key would only be one more
  # credential to lose.

  # `standard`, not `unlimited`. This is the whole cost-control argument for
  # burstable instances: under sustained load a `standard` instance throttles
  # to its baseline, while an `unlimited` one keeps performing and bills the
  # surplus. On an account with no hard spending cap, predictable slowness is
  # the safer failure mode (ADR-0001).
  credit_specification {
    cpu_credits = "standard"
  }

  metadata_options {
    http_endpoint = "enabled"
    # IMDSv2 only. v1 is a plain HTTP GET, which is why a single SSRF bug in
    # any application on the host is enough to read the instance's credentials.
    http_tokens = "required"
    # One hop reaches the host and no further. A process inside a container is
    # one hop too many, so the containers on this box cannot see the metadata
    # service at all — and none of them needs to.
    http_put_response_hop_limit = 1
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
    # The instance holds no state. Everything durable is in RDS, and everything
    # runnable is an image that can be pulled again.
    delete_on_termination = true
  }

  user_data = templatefile("${path.module}/templates/user_data.sh.tftpl", {
    region           = var.region
    parameter_prefix = local.parameter_prefix
  })

  # Changing the bootstrap script rebuilds the host rather than leaving a
  # running instance that no longer matches its own definition. Routine deploys
  # do not go through here — they are an SSM document (deploy.tf), so shipping
  # application code never replaces the instance.
  user_data_replace_on_change = true

  # The bootstrap script reads these at first boot. Only the prefix is
  # interpolated into the script, which is a string and creates no dependency
  # edge, so without this Terraform is free to create the instance first — and
  # a bootstrap that loses that race aborts on `set -euo pipefail`, leaving a
  # host with no tunnel and nothing reporting why.
  depends_on = [
    aws_ssm_parameter.tunnel_token,
    aws_ssm_parameter.registry_token,
    aws_ssm_parameter.database_url,
    aws_ssm_parameter.database_username,
    aws_ssm_parameter.database_password,
  ]

  tags = {
    Name = "gmc-${var.environment}-app"
    # The budget action selects on this. An instance without it is an instance
    # the $50 halt cannot stop.
    Billable = "compute"
  }
}
