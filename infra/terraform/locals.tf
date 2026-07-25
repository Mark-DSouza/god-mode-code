# Values shared across more than one file.
#
# Anything used in a single file stays in that file; this is only for the ones
# that would otherwise have to be defined somewhere arbitrary and read
# somewhere else.

locals {
  # Where every secret and every piece of runtime configuration lives. Read by
  # `secrets.tf` to create them, by `app.tf` to scope the instance role's
  # permission to exactly this subtree, and by both host scripts to fetch them.
  parameter_prefix = "/gmc/${var.environment}"
}
