# Security groups.
#
# The application instance has **no ingress rules whatsoever**. Not 443, not 22.
# Traffic arrives over a tunnel that `cloudflared` establishes outbound from the
# instance, so the origin address is never exposed and there is no listening
# port on the public internet to find (ADR-0002). Administrative access is
# Session Manager, which is also outbound-initiated.
#
# `ingress = []` is written explicitly rather than simply omitted, and the
# difference matters twice. An omitted block is unmanaged, so a rule added by
# hand in the console would survive every future apply; an explicit empty list
# is managed, so the next apply removes it. It is also *known* at plan time,
# which is what lets `tests/security.tftest.hcl` assert the count is zero and
# turn this from a property somebody has to remember into a failing test.

resource "aws_security_group" "app" {
  name        = "gmc-${var.environment}-app"
  description = "Application instance: no inbound, egress only"
  vpc_id      = aws_vpc.main.id

  ingress = []

  egress = [{
    description      = "Image pulls, tunnel, Systems Manager"
    from_port        = 0
    to_port          = 0
    protocol         = "-1"
    cidr_blocks      = ["0.0.0.0/0"]
    ipv6_cidr_blocks = []
    prefix_list_ids  = []
    security_groups  = []
    self             = false
  }]

  tags = {
    Name = "gmc-${var.environment}-app"
  }
}

resource "aws_security_group" "db" {
  name        = "gmc-${var.environment}-db"
  description = "PostgreSQL: reachable only from the application"
  vpc_id      = aws_vpc.main.id

  # Referenced by security group, not by address. The instance's address changes
  # whenever it is replaced, and a rule pinned to one becomes either broken or
  # quietly far too wide the first time that happens.
  ingress = [{
    description      = "PostgreSQL from the application instance only"
    from_port        = 5432
    to_port          = 5432
    protocol         = "tcp"
    security_groups  = [aws_security_group.app.id]
    cidr_blocks      = []
    ipv6_cidr_blocks = []
    prefix_list_ids  = []
    self             = false
  }]

  # The database initiates nothing. Managed PostgreSQL does its own backups and
  # patching over AWS's internal paths, not through this group.
  egress = []

  tags = {
    Name = "gmc-${var.environment}-db"
  }
}
