# The judge's host.
#
# Everything in this file exists to make one sentence true: an attacker who
# escapes a sandbox container lands somewhere worth nothing. No credentials to
# steal, no route to anywhere, no way to reach or be reached by anything except
# the application, on one port.
#
# Containers share the host kernel, so an escape is a question of when rather
# than whether (ADR-0005). The separation is not about resource contention,
# which cgroups already handle. It is about money: a host holding an IAM role
# can launch GPU instances, and a host with egress can bill five figures in
# data transfer at $0.09/GB. A host with neither is financially inert, and an
# escape there costs one `terraform apply`.
#
# The consequence, and it is deliberate: **there is no way onto this box.** No
# SSH, no Session Manager — the agent needs egress to reach Systems Manager and
# there is none. That is not an oversight to be fixed with one more rule. This
# host is cattle in the strictest sense: when something is wrong with it, it is
# replaced, and the only thing that survives a replacement is what is declared
# here.

locals {
  # A fixed address in the first private subnet, so the URL the application
  # dials never changes. Without this, replacing the judge — which any change
  # to its bootstrap does — would hand it a new address, and the application
  # would keep calling the old one until somebody redeployed it.
  #
  # `.10` rather than `.4`: AWS reserves the first four addresses of every
  # subnet and the last one.
  judge_private_ip = cidrhost(aws_subnet.private[0].cidr_block, 10)

  judge_url = "http://${local.judge_private_ip}:${var.judge_port}"
}

# ---------------------------------------------------------------------------
# Reachability
# ---------------------------------------------------------------------------

resource "aws_security_group" "judge" {
  name        = "gmc-${var.environment}-judge"
  description = "Judge host: one port in from the application, nothing out"
  vpc_id      = aws_vpc.main.id

  # One rule, one port, one source — and the source is a security group rather
  # than an address range, so it keeps meaning the application after the
  # application instance is replaced.
  ingress = [{
    description      = "Judgings and metric scrapes from the application only"
    from_port        = var.judge_port
    to_port          = var.judge_port
    protocol         = "tcp"
    security_groups  = [aws_security_group.app.id]
    cidr_blocks      = []
    ipv6_cidr_blocks = []
    prefix_list_ids  = []
    self             = false
  }]

  # Nothing out. Not to the internet, which the private route table already
  # forbids, and not to anything inside the VPC either — the database, the
  # application, the metadata service of any other host. Both halves matter:
  # the route table stops exfiltration, and this stops lateral movement.
  #
  # Security groups are stateful, so replies to an allowed judging still leave
  # the box. What cannot happen is the judge *initiating* a connection to
  # anything at all.
  #
  # Written as an explicit empty list rather than omitted, for the same reason
  # the application's ingress is: an omitted block is unmanaged, so a rule
  # added by hand would survive every future apply, and an explicit empty list
  # is known at plan time, which is what lets a test assert on it.
  egress = []

  tags = {
    Name = "gmc-${var.environment}-judge"
  }
}

# ---------------------------------------------------------------------------
# The instance
# ---------------------------------------------------------------------------

resource "aws_instance" "judge" {
  # A pre-baked image, and this is the direct consequence of the isolation
  # above rather than a preference. A host with no route out cannot install a
  # container runtime, cannot pull an execution image, and cannot fetch its own
  # binary. Everything it will ever run has to be on the disk before it boots.
  # docs/runbooks/judge-host.md is how that image is built.
  ami = var.judge_ami_id

  instance_type = var.judge_instance_type
  subnet_id     = aws_subnet.private[0].id
  private_ip    = local.judge_private_ip

  vpc_security_group_ids = [aws_security_group.judge.id]

  # No `iam_instance_profile`, and its absence is the single most important
  # line in this file. With no role attached there is nothing behind the
  # metadata service to steal: the credentials endpoint returns 404 rather than
  # a set of keys. This is why the judge cannot read Parameter Store, cannot be
  # reached by Systems Manager, and configures itself from user data below.
  #
  # If a future change needs the judge to hold a credential, it is not this
  # host any more, and ADR-0005 needs revisiting before the attribute is added.

  # No key pair either. Nothing is listening on 22 and nothing could reach it
  # if it were.

  credit_specification {
    # `standard`, not `unlimited`. This host runs untrusted code by design, so
    # the sustained-CPU case worth planning for is a miner rather than a busy
    # afternoon. On `standard` it exhausts its credits and throttles to the
    # baseline; on `unlimited` it would keep running at full speed and bill the
    # surplus (ADR-0001, ADR-0005).
    cpu_credits = "standard"
  }

  metadata_options {
    # Left enabled because cloud-init reads user data through it, which is how
    # this host is configured at all. What it exposes is worth being precise
    # about: user data and instance identity, and no credentials, because there
    # is no role.
    http_endpoint = "enabled"
    # IMDSv2. A session token is required, which a plain HTTP GET from a
    # confused proxy or an SSRF cannot obtain.
    http_tokens = "required"
    # One hop reaches the host and no further. A sandbox container is one hop
    # too many, so the untrusted code this box exists to run cannot see the
    # metadata service at all — not even to read the user data describing its
    # own cage.
    http_put_response_hop_limit = 1
    # The tags on this instance say nothing secret, but a sandbox that cannot
    # reach the metadata service has no use for them either.
    instance_metadata_tags = "disabled"
  }

  root_block_device {
    volume_type = "gp3"
    # Room for the container runtime, one execution image and the journal.
    # Sized with slack on purpose: nobody can log in to clear space, so a full
    # disk here is an instance replacement rather than a five-minute fix.
    volume_size = var.judge_volume_size
    encrypted   = true
    # The host holds nothing durable. The Pattern catalogue is compiled into
    # the binary, and every Judging is reported over the wire and forgotten.
    delete_on_termination = true
  }

  # Configuration, not installation — the image already contains the binary,
  # the runtime and the execution image. This writes the environment file the
  # systemd unit reads and restarts it.
  # The build version is deliberately not here. It belongs to the image that
  # contains the binary, so the image bakes it into a second environment file
  # and the unit reads both — which means /health cannot report a version the
  # running binary is not.
  user_data = templatefile("${path.module}/templates/judge_user_data.sh.tftpl", {
    port    = var.judge_port
    workers = var.judge_workers
  })

  # Changing the configuration rebuilds the host rather than leaving a running
  # instance that no longer matches its own definition. That is cheap here in a
  # way it is not for the application: the judge holds no state, and the fixed
  # private address means the application does not have to be told.
  user_data_replace_on_change = true

  tags = {
    Name = "gmc-${var.environment}-judge"
    # How spend is attributed, matching the application instance. The halt in
    # budget.tf works by instance id rather than by tag — this box is named
    # there explicitly, and it is the more important of the two to have named:
    # it is the one running code nobody vetted.
    Billable = "compute"
  }
}

# ---------------------------------------------------------------------------
# How the application finds it
# ---------------------------------------------------------------------------

# Written from the fixed address rather than from the instance's attribute, so
# the parameter is known at plan time and does not have to wait for the host to
# exist. The deploy script reads it and passes it to the backend as JUDGE_URL.
resource "aws_ssm_parameter" "judge_url" {
  name        = "${local.parameter_prefix}/judge/url"
  description = "Where the application reaches the judge across the private link"
  type        = "String"
  value       = local.judge_url
}
