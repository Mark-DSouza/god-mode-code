# Security invariants.
#
# These run against a plan with mocked providers, so they need no AWS account,
# no credentials and no money — which is what lets them run on every pull
# request rather than only when somebody remembers to apply.
#
# What they protect is the set of properties that are easy to break silently
# and expensive to discover late: a security group that quietly acquires an
# inbound rule, a metadata service reachable from a container, a database that
# becomes publicly accessible, a private subnet that gains a route out.

mock_provider "aws" {
  # Mocked data sources return empty values by default, and an empty list of
  # availability zones fails the subnet lookups before any assertion is
  # reached. Three zones is what ap-south-1 actually has.
  mock_data "aws_availability_zones" {
    defaults = {
      names = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
    }
  }

  # `aws_iam_policy_document` normally computes its `json` attribute inside the
  # provider. Mocked, it returns an arbitrary string, which the IAM resources
  # then reject as invalid policy JSON before any assertion runs. These tests
  # are not about policy contents, so a minimal valid document is enough.
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
}

mock_provider "cloudflare" {}

variables {
  cloudflare_zone_id        = "0123456789abcdef0123456789abcdef"
  cloudflare_account_id     = "fedcba9876543210fedcba9876543210"
  cloudflare_api_token      = "test-token"
  budget_notification_email = "billing@example.com"
  # The judge's image is built out of band, because a host with no route out
  # cannot install anything at first boot. Any well-formed identifier will do
  # here; nothing is launched.
  judge_ami_id = "ami-0123456789abcdef0"
}

run "application_host_accepts_no_inbound_traffic" {
  command = plan

  assert {
    # The headline property of this whole stack. Traffic reaches the
    # application over the outbound-initiated tunnel ADR-0002 chose, so there
    # is nothing to open and nothing to scan. If this ever fails, the origin
    # address is exposed and the tunnel has become decorative.
    condition     = length(aws_security_group.app.ingress) == 0
    error_message = "The application security group has an inbound rule. It must have none; traffic arrives through the tunnel."
  }

  assert {
    condition     = length(aws_security_group.app.egress) == 1
    error_message = "The application instance needs exactly one egress rule to reach the registry, Cloudflare and Systems Manager."
  }
}

run "database_is_reachable_only_from_the_application" {
  command = plan

  assert {
    condition     = length(aws_security_group.db.ingress) == 1
    error_message = "The database should accept exactly one source of traffic."
  }

  assert {
    condition = alltrue([
      for rule in aws_security_group.db.ingress :
      rule.from_port == 5432 && rule.to_port == 5432 && length(rule.cidr_blocks) == 0
    ])
    error_message = "The database rule must be PostgreSQL only and must reference a security group rather than an address range."
  }

  assert {
    condition     = length(aws_security_group.db.egress) == 0
    error_message = "The database initiates no outbound connections."
  }

  assert {
    condition     = aws_db_instance.main.publicly_accessible == false
    error_message = "The database must not be publicly accessible."
  }

  assert {
    condition     = aws_db_instance.main.storage_encrypted
    error_message = "Database storage must be encrypted at rest."
  }
}

run "instance_metadata_is_not_reachable_from_a_container" {
  command = plan

  assert {
    # IMDSv1 is a plain HTTP GET, which is why one SSRF bug anywhere on the
    # host is enough to read the instance's credentials.
    condition     = aws_instance.app.metadata_options[0].http_tokens == "required"
    error_message = "IMDSv2 must be required."
  }

  assert {
    # One hop reaches the host and no further, so a process inside a container
    # cannot see the metadata service at all.
    condition     = aws_instance.app.metadata_options[0].http_put_response_hop_limit == 1
    error_message = "A hop limit above 1 lets containers reach the metadata service."
  }
}

run "private_subnets_have_no_route_out" {
  command = plan

  assert {
    # This is the route table the judge's instance attaches to. No route out is
    # what makes a compromised judge host financially inert rather than a
    # source of five-figure data-transfer bills (ADR-0005).
    condition     = length(aws_route_table.private.route) == 0
    error_message = "The private route table must have no routes. A gateway here would give the judge's host a way out."
  }

  assert {
    # Subnet identifiers do not exist until apply, so what is checked is the
    # judge's pinned address: it can only fall inside this range if the
    # instance is in the routeless subnet the range belongs to. Moving the
    # judge to the public subnet changes the range and fails here.
    condition     = aws_instance.judge.private_ip == cidrhost(aws_subnet.private[0].cidr_block, 10)
    error_message = "The judge must sit at its fixed address in a private subnet; anywhere else gives the host a way out."
  }
}

# ---------------------------------------------------------------------------
# The judge's host.
#
# These are the assertions that make ADR-0005's argument enforceable rather
# than aspirational. Each one protects a property whose loss would be silent:
# nothing about a judge that has quietly acquired an IAM role or an egress rule
# looks different from outside until the bill arrives.
# ---------------------------------------------------------------------------

run "the_judge_configures_itself_without_credentials" {
  command = plan

  # The property that matters most here — that `aws_instance.judge` attaches no
  # instance profile — cannot be asserted directly, and the reason is worth
  # writing down rather than rediscovering. `iam_instance_profile` is
  # optional-and-computed in the provider schema, so an unset one plans as
  # *unknown* rather than as null, and a condition on an unknown value cannot be
  # evaluated at all.
  #
  # What is checkable is the shape that absence forces. A host with a role reads
  # its configuration from Parameter Store, the way the application's bootstrap
  # does; a host without one cannot, and has to be handed everything in user
  # data. So the assertion below fails the moment somebody writes a judge
  # bootstrap that expects credentials — which is the same moment they would
  # have had to attach a role.

  assert {
    condition     = !strcontains(aws_instance.judge.user_data, "ssm")
    error_message = "The judge's bootstrap reads Parameter Store, which means it has been given a role. It must configure itself from user data alone."
  }

  assert {
    # Belt and braces on the same property, and the reason a role would be
    # useless even if one were attached: no egress means no route to the STS or
    # EC2 endpoints a stolen credential would have to be spent against.
    condition     = length(aws_security_group.judge.egress) == 0
    error_message = "A judge that can reach AWS endpoints is a judge whose credentials, present or future, are spendable."
  }
}

run "the_judge_can_reach_nothing_and_only_the_application_can_reach_it" {
  command = plan

  assert {
    condition     = length(aws_security_group.judge.ingress) == 1
    error_message = "The judge must accept exactly one source of traffic."
  }

  assert {
    # One port, one source, and the source referenced by security group rather
    # than by address — the identifiers themselves do not exist until apply, so
    # what is asserted is that exactly one group is named and no address range
    # is. A `cidr_blocks` entry here would be how "only the application" quietly
    # becomes "anything in the VPC".
    condition = alltrue([
      for rule in aws_security_group.judge.ingress :
      rule.from_port == var.judge_port
      && rule.to_port == var.judge_port
      && rule.protocol == "tcp"
      && length(rule.cidr_blocks) == 0
      && length(rule.ipv6_cidr_blocks) == 0
      && length(rule.security_groups) == 1
      && rule.self == false
    ])
    error_message = "The judge must be reachable only from the application's security group, on one port."
  }

  assert {
    # Exfiltration and lateral movement, refused rather than filtered. The
    # route table already denies the internet; this denies the database, the
    # application and every other host in the VPC as well.
    condition     = length(aws_security_group.judge.egress) == 0
    error_message = "The judge must have no egress rules at all. It initiates nothing."
  }
}

run "instance_metadata_is_not_reachable_from_a_sandbox" {
  command = plan

  assert {
    condition     = aws_instance.judge.metadata_options[0].http_tokens == "required"
    error_message = "IMDSv2 must be required on the judge."
  }

  assert {
    # The host this matters most on: the containers here are running submitted
    # source, and one hop stops them reaching the metadata service at all.
    condition     = aws_instance.judge.metadata_options[0].http_put_response_hop_limit == 1
    error_message = "A hop limit above 1 lets a sandbox container reach the metadata service."
  }
}

run "the_application_is_told_where_to_find_the_judge" {
  command = plan

  assert {
    # Fixed, and known at plan time. An address that changed when the judge was
    # replaced would leave the backend calling a host that no longer exists
    # until somebody redeployed it.
    condition     = aws_ssm_parameter.judge_url.value == "http://${aws_instance.judge.private_ip}:${var.judge_port}"
    error_message = "The judge's address must be the fixed private address the instance is pinned to."
  }

  assert {
    condition     = strcontains(aws_ssm_document.deploy.content, "JUDGE_URL")
    error_message = "The deploy must pass the judge's address to the backend, or the private link is never dialled."
  }
}

run "secrets_are_stored_encrypted_and_never_in_the_repository" {
  command = plan

  assert {
    condition     = aws_ssm_parameter.database_password.type == "SecureString"
    error_message = "The database password must be a SecureString."
  }

  assert {
    condition     = aws_ssm_parameter.tunnel_token.type == "SecureString"
    error_message = "The tunnel token must be a SecureString."
  }

  assert {
    condition     = aws_ssm_parameter.registry_token.type == "SecureString"
    error_message = "The registry token must be a SecureString."
  }
}

run "the_deploy_document_only_accepts_this_project_s_own_images" {
  command = plan

  assert {
    # The image reference is supplied by a workflow. Scoped to this namespace
    # it is a deploy; scoped to any registry it is a way to run an arbitrary
    # container on the production host.
    condition     = strcontains(aws_ssm_document.deploy.content, "mark-dsouza/god-mode-code/api:")
    error_message = "The deploy document must restrict the backend image to this project's registry namespace."
  }

  assert {
    condition     = strcontains(aws_ssm_document.deploy.content, "mark-dsouza/god-mode-code/web:")
    error_message = "The deploy document must restrict the proxy image to this project's registry namespace."
  }

  assert {
    # Systems Manager resolves every doubled-curly-brace occurrence in a
    # document against its declared parameters and rejects the whole document
    # if one does not match — including occurrences inside shell comments. The
    # script uses exactly two, one per declared parameter. Anything else means
    # either a typo or a `docker --format` Go template, and the failure only
    # surfaces at apply time as an opaque InvalidDocumentContent.
    condition     = length(regexall("\\{\\{[^}]*\\}\\}", aws_ssm_document.deploy.content)) == 2
    error_message = "The deploy document contains a curly-brace placeholder that is not one of its two declared parameters."
  }
}

run "the_hostname_is_served_through_the_tunnel" {
  command = plan

  assert {
    condition     = cloudflare_dns_record.app.proxied
    error_message = "The DNS record must be proxied; an unproxied record cannot resolve to a tunnel and would expose the origin."
  }

  assert {
    # A CNAME, never an A record. The tunnel's own target is only knowable
    # after apply, so what is checked here is the shape: an address record
    # would mean pointing DNS at the instance and exposing the origin.
    condition     = cloudflare_dns_record.app.type == "CNAME"
    error_message = "The record must be a CNAME to the tunnel, not an address record pointing at the instance."
  }

  assert {
    condition     = cloudflare_dns_record.app.name == var.hostname
    error_message = "The record must be for the single origin the application is served from."
  }
}
