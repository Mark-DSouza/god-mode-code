# The network.
#
# Two tiers and no NAT gateway. A NAT gateway is ~$32/month in ap-south-1 —
# roughly the cost of everything else in this stack combined — and the only
# thing that needs outbound access is the application instance, which can have
# it directly from a public subnet for nothing (ADR-0001).
#
# "Public subnet" here means *routable*, not *reachable*. The application
# instance opens no inbound ports at all; see security.tf.

data "aws_availability_zones" "available" {
  state = "available"
}

# Flow logs are declined, and the reason is the same one that put the rest of
# the telemetry outside AWS (ADR-0008): CloudWatch Logs charges per GB ingested
# and a VPC whose instances talk continuously to a registry, a tunnel and
# Systems Manager produces that continuously, for a record nobody is watching.
# What flow logs would be read to confirm after the fact is asserted up front
# instead, on every pull request that touches this directory — no inbound rules
# on the application, no route out of the private subnet
# (tests/security.tftest.hcl).
#trivy:ignore:AVD-AWS-0178
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "gmc-${var.environment}"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "gmc-${var.environment}"
  }
}

# ---------------------------------------------------------------------------
# Public tier: the application instance.
# ---------------------------------------------------------------------------

# Trivy reads `map_public_ip_on_launch` as exposure. Here it is the opposite:
# with no NAT gateway (~$32/month, ADR-0001) a routable address is the only way
# the application instance reaches the registry, Cloudflare and Systems
# Manager, and every one of those connections is outbound. Nothing can dial in
# — the application security group has no ingress rules at all, which
# tests/security.tftest.hcl asserts on every pull request. Moving the
# assignment onto the instance would satisfy this rule and change neither the
# address nor the exposure, which is why the finding is answered rather than
# engineered around.
#trivy:ignore:AVD-AWS-0164
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, 0)
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true

  tags = {
    Name = "gmc-${var.environment}-public"
    Tier = "public"
  }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "gmc-${var.environment}-public"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# ---------------------------------------------------------------------------
# Private tier: the database now, the judge's instance later (issue #13).
# ---------------------------------------------------------------------------

# Two subnets in different availability zones, because an RDS subnet group
# requires it even for a single-AZ instance.
resource "aws_subnet" "private" {
  count = 2

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 1)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "gmc-${var.environment}-private-${count.index}"
    Tier = "private"
  }
}

# Deliberately routeless beyond the VPC-local route AWS creates implicitly.
# There is no 0.0.0.0/0 entry here and there must never be one: this is the
# route table the judge's instance will attach to, and "no route out" is the
# property that makes a compromised judge host financially inert rather than a
# source of five-figure data-transfer bills (ADR-0005).
#
# `route = []` is explicit for the same two reasons the application security
# group states its empty ingress explicitly: an omitted block is unmanaged, so
# a route added by hand would survive every future apply, and an explicit empty
# list is known at plan time, which is what lets a test assert on it.
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route = []

  tags = {
    Name = "gmc-${var.environment}-private"
  }
}

resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
