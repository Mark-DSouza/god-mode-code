# The one alert that actually matters.
#
# Everything else in this repository tells you why something is wrong. This
# tells you *that* it is wrong, and it is the only check that can, because it
# runs somewhere else entirely: a host that is down cannot report that it is
# down, and neither can a collector, an alarm, or a dashboard hosted beside it
# (ADR-0008).
#
# It dials the real hostname over the real tunnel and reads the real health
# endpoint, which is the whole path an evaluator clicking a link takes. Anything
# less — pinging the instance, checking the tunnel exists — would be green on
# the day the site is unreachable.

resource "uptimerobot_alert_contact" "operator" {
  friendly_name = "god-mode-code operator"
  type          = "email"
  value         = var.alert_email
}

resource "uptimerobot_monitor" "health" {
  friendly_name = "god-mode-code ${var.environment}"

  # `/api/health` rather than the home page. The page is static content served
  # by Caddy, so it answers 200 with the backend and the database both gone;
  # the health endpoint answers 503 unless every dependency is reachable, which
  # is exactly why it was built to do that.
  type = "http"
  url  = "https://${var.hostname}/api/health"

  interval = var.uptime_interval_seconds

  alert_contact {
    id = uptimerobot_alert_contact.operator.id
    # Alert once when it breaks and once when it recovers, rather than every
    # interval until somebody wakes up. An alert channel that repeats is one
    # people learn to filter.
    threshold  = 0
    recurrence = 0
  }
}
