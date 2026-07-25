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
}

run "application_host_accepts_no_inbound_traffic" {
  command = plan

  assert {
    # The headline property of this whole stack. Traffic reaches the
    # application over an outbound-initiated tunnel, so there is nothing to
    # open and nothing to scan (ADR-0002). If this ever fails, the origin
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
    # This is the route table the judge's instance attaches to (issue #13). No
    # route out is what makes a compromised judge host financially inert rather
    # than a source of five-figure data-transfer bills (ADR-0005).
    condition     = length(aws_route_table.private.route) == 0
    error_message = "The private route table must have no routes. A gateway here would give the judge's host a way out."
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
