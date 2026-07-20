param(
  [string]$RepoRoot = "C:\WiamLight",
  [string]$QaReportEndpoint = "",
  [string]$QaWebhookSecret = "",
  [string]$TaskName = "Wiam_QA_Hourly_Device_Runner"
)

$ErrorActionPreference = "Stop"

if (-not $QaReportEndpoint) { $QaReportEndpoint = $env:QA_REPORT_ENDPOINT }
if (-not $QaWebhookSecret) { $QaWebhookSecret = $env:QA_WEBHOOK_SECRET }

if (-not $QaReportEndpoint -or -not $QaWebhookSecret) {
  Write-Error "Provide QaReportEndpoint and QaWebhookSecret (or env vars QA_REPORT_ENDPOINT / QA_WEBHOOK_SECRET)."
}

$runnerScript = Join-Path $RepoRoot "scripts\qa\run_hourly_device_runner.ps1"
if (-not (Test-Path $runnerScript)) {
  Write-Error "Runner script not found: $runnerScript"
}

$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$runnerScript`" -RepoRoot `"$RepoRoot`" -QaReportEndpoint `"$QaReportEndpoint`" -QaWebhookSecret `"$QaWebhookSecret`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arg
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -StartWhenAvailable -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Wiam hourly enterprise QA device runner" -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Host "Scheduled task '$TaskName' registered and started."
