output "uptime_monitor_id" {
  description = "UptimeRobot monitor. Quoted in the verification runbook when confirming an outage was actually detected."
  value       = uptimerobot_monitor.health.id
}

output "dashboard_url" {
  description = "The dashboard, in the Grafana stack it was applied to."
  value       = "${var.grafana_url}${grafana_dashboard.gmc.url}"
}

output "folder_uid" {
  description = "Folder holding the dashboard and the alert rules."
  value       = grafana_folder.gmc.uid
}
