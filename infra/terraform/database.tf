# Managed PostgreSQL.
#
# Managed rather than a container on the instance, because the thing being paid
# for is not the process — it is the automated backups, the point-in-time
# recovery, and not being the person who discovers at 3am that pg_dump has been
# failing silently for a month.

resource "aws_db_subnet_group" "main" {
  name       = "gmc-${var.environment}"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "gmc-${var.environment}"
  }
}

# Generated here rather than chosen by a human, so it never exists anywhere a
# human might paste it. It goes straight into Parameter Store and is read from
# there by the instance.
resource "random_password" "db" {
  length = 32
  # RDS rejects '/', '@', '"' and space in a master password, and the URL this
  # ends up inside has its own opinions about the rest of the punctuation.
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_db_parameter_group" "main" {
  name   = "gmc-${var.environment}-pg${var.db_engine_version}"
  family = "postgres${var.db_engine_version}"

  # The application connects over the private link inside the VPC, but the
  # security boundary should not be the only thing enforcing transport
  # security.
  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_instance" "main" {
  identifier     = "gmc-${var.environment}"
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  db_name  = "godmodecode"
  username = "godmodecode"
  password = random_password.db.result

  allocated_storage = var.db_allocated_storage
  # gp3 is cheaper than gp2 at this size and does not tie IOPS to capacity.
  storage_type      = "gp3"
  storage_encrypted = true

  db_subnet_group_name = aws_db_subnet_group.main.name
  # Without this the instance silently uses the default parameter group and
  # `rds.force_ssl` never takes effect, leaving the group above an orphan and
  # the `sslmode=require` in the connection URL the only thing asking for TLS.
  parameter_group_name   = aws_db_parameter_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false

  # Point-in-time recovery is not a separate switch on RDS: it is what a
  # non-zero retention period buys. Every transaction log is shipped to S3
  # continuously, so the instance can be restored to any second inside the
  # window rather than only to a nightly snapshot. Setting this to 0 would turn
  # both features off at once, which is why `variables.tf` refuses the value.
  backup_retention_period = var.backup_retention_days
  # Off-peak for India, where the users are.
  backup_window            = "20:00-21:00"
  maintenance_window       = "sun:21:30-sun:22:30"
  copy_tags_to_snapshot    = true
  delete_automated_backups = false

  # Single-AZ. Multi-AZ doubles the database cost to remove an outage this
  # project already accepts on the application tier (ADR-0009); spending it
  # here while the api is a single instance would be buying availability the
  # rest of the stack cannot deliver anyway.
  multi_az = false

  auto_minor_version_upgrade = true
  # Never at apply time. A schema-visible change should land in a maintenance
  # window, not in the middle of whatever else the plan was doing.
  apply_immediately = false

  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "gmc-${var.environment}-final"

  # Sends PostgreSQL's own logs somewhere they survive the instance.
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Name = "gmc-${var.environment}"
  }
}
