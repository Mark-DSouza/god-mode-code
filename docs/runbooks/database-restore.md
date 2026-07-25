# Restoring the database

An untested backup is not a backup. This runbook is the test, and the drill log
at the bottom is the evidence it has been run.

The stack keeps seven days of automated backups, which is also what buys
point-in-time recovery: RDS ships transaction logs to S3 continuously, so the
database can be restored to any second inside the window rather than only to a
nightly snapshot.

Restoring **never** modifies the running database. RDS restores into a _new_
instance, always. That is what makes this drill safe to rehearse against
production data whenever you like, and there is no reason not to.

## Before you start

You need credentials for the account the stack is applied to, and the region is
`ap-south-1`.

```bash
export AWS_REGION=ap-south-1
SOURCE=gmc-prod          # terraform output database_identifier
DRILL=gmc-restore-drill  # throwaway; deleted at the end
```

## 1. Confirm there is something to restore from

```bash
aws rds describe-db-instances \
  --db-instance-identifier "$SOURCE" \
  --query 'DBInstances[0].{retention:BackupRetentionPeriod,window:PreferredBackupWindow,status:DBInstanceStatus}'
```

`retention` must be at least 7. If it is 0, there are no automated backups and
no point-in-time recovery, and the rest of this document is moot — fix that
first.

Then find how far back recovery actually reaches:

```bash
aws rds describe-db-instances \
  --db-instance-identifier "$SOURCE" \
  --query 'DBInstances[0].LatestRestorableTime'
```

`LatestRestorableTime` is typically a few minutes behind now, not this instant.
That lag is normal — it is the transaction log shipping interval — and it is the
real recovery point objective, so it is worth knowing the number rather than
assuming it is zero.

## 2. Restore to a point in time, into a throwaway instance

```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier "$SOURCE" \
  --target-db-instance-identifier "$DRILL" \
  --use-latest-restorable-time \
  --db-instance-class db.t4g.micro \
  --db-subnet-group-name gmc-prod \
  --vpc-security-group-ids "$(aws ec2 describe-security-groups \
      --filters Name=group-name,Values=gmc-prod-db \
      --query 'SecurityGroups[0].GroupId' --output text)" \
  --no-publicly-accessible \
  --no-multi-az \
  --tags Key=Project,Value=god-mode-code Key=Purpose,Value=restore-drill
```

Into the same subnet group and the same security group as production, so the
restored instance is reachable from the application instance and from nowhere
else. A drill that makes the data publicly accessible for convenience has
tested something other than the recovery procedure.

Substitute `--restore-time 2026-07-25T09:30:00Z` for
`--use-latest-restorable-time` when rehearsing recovery from a specific
incident, which is the case that actually matters: the point of PITR is
stopping just before the bad migration ran.

Wait for it — this takes 10–20 minutes at this instance size:

```bash
aws rds wait db-instance-available --db-instance-identifier "$DRILL"
```

## 3. Verify the data is actually there

The step people skip, and the only one that proves anything. A restored
instance that reports `available` has proved that RDS can create an instance,
not that your data survived.

First get the restored instance's address. It is a different host from
production, so take it from the drill instance rather than from the
`/gmc/prod/database/url` parameter, which is a JDBC URL for the live database
and not what you want to connect to here:

```bash
DRILL_HOST=$(aws rds describe-db-instances \
  --db-instance-identifier "$DRILL" \
  --query 'DBInstances[0].Endpoint.Address' --output text)

echo "$DRILL_HOST"
```

The instance has no public route, so connect from the application host through
Session Manager:

```bash
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters Name=tag:Name,Values=gmc-prod-app Name=instance-state-name,Values=running \
  --query 'Reservations[].Instances[].InstanceId' --output text)

aws ssm start-session --target "$INSTANCE_ID"
```

That session is a fresh root shell on the host, so nothing set above is in
scope. Paste the address you just printed, and set the region explicitly —
the instance profile supplies credentials but not a default region:

```bash
export AWS_DEFAULT_REGION=ap-south-1
DRILL_HOST=<paste the address printed above>

# The restored instance keeps the source's master credentials, so this is the
# same password the live database uses.
PASSWORD=$(aws ssm get-parameter --name /gmc/prod/database/password \
  --with-decryption --query Parameter.Value --output text)

docker run --rm -i -e PGPASSWORD="$PASSWORD" postgres:17-alpine \
  psql -h "$DRILL_HOST" -U godmodecode -d godmodecode -c '\dt'
```

Check, at minimum:

- the tables exist, and `flyway_schema_history` is present
- the latest migration in `flyway_schema_history` is the one you expect
- a table with real rows in it actually has them — `SELECT count(*)` on
  something that should not be empty

Record the row counts in the drill log. A restore that succeeds structurally
while silently arriving empty is exactly the failure this drill exists to
catch, and only a number written down beforehand will reveal it.

## 4. Delete the throwaway instance

It costs money for as long as it exists.

```bash
aws rds delete-db-instance \
  --db-instance-identifier "$DRILL" \
  --skip-final-snapshot \
  --delete-automated-backups
```

`--skip-final-snapshot` is correct **only here**, on the drill instance. Never
pass it to the production identifier; the production instance is additionally
protected by `deletion_protection`, which Terraform sets and which must be
turned off deliberately before AWS will delete it at all.

Confirm it is gone, because an instance left running after a drill is a
recurring charge nobody is looking for:

```bash
aws rds describe-db-instances \
  --query "DBInstances[?starts_with(DBInstanceIdentifier, 'gmc-restore')].DBInstanceIdentifier"
```

## If you are restoring for real

Do not point the application at the restored instance by editing anything on
the host. Change it in one place:

1. Restore as above, to the moment before the incident.
2. Update `/gmc/prod/database/url` in Parameter Store to the new endpoint.
3. Re-run the deploy workflow. The backend picks the value up at start.
4. Once confirmed, rename or retire the old instance.

The application reads its database URL from Parameter Store on every start, so
this needs no code change, no image rebuild, and no Terraform apply.

## Drill log

Every performed drill gets a row. An empty row is not a formality — the whole
claim of this document is that the procedure above has been executed and
observed to work, and until a date appears here, that claim is unproven.

| Date                | Performed by | Restored to | Rows verified | Time to restore | Notes                                                                 |
| ------------------- | ------------ | ----------- | ------------- | --------------- | --------------------------------------------------------------------- |
| _not yet performed_ | —            | —           | —             | —               | Requires the stack to be applied to a live AWS account; see issue #5. |
