param(
  [string]$RepoRoot = "C:\WiamLight",
  [string]$QaReportEndpoint = "",
  [string]$QaWebhookSecret = "",
  [switch]$SkipWiamVox
)

$ErrorActionPreference = "Stop"

if (-not $QaReportEndpoint) { $QaReportEndpoint = $env:QA_REPORT_ENDPOINT }
if (-not $QaWebhookSecret) { $QaWebhookSecret = $env:QA_WEBHOOK_SECRET }

if (-not $QaReportEndpoint -or -not $QaWebhookSecret) {
  Write-Error "QA_REPORT_ENDPOINT and QA_WEBHOOK_SECRET are required."
}

function Invoke-MaestroSuite {
  param(
    [string]$WorkingDir,
    [string]$SuitePath,
    [string]$Label
  )
  if (-not (Test-Path $SuitePath)) {
    return @{
      label = $Label
      status = "fail"
      detail = "Suite file missing: $SuitePath"
    }
  }
  Push-Location $WorkingDir
  try {
    & maestro test $SuitePath
    if ($LASTEXITCODE -eq 0) {
      return @{ label = $Label; status = "pass"; detail = "Suite passed." }
    }
    return @{ label = $Label; status = "fail"; detail = "Suite failed with exit code $LASTEXITCODE." }
  } catch {
    return @{ label = $Label; status = "fail"; detail = "Execution error: $($_.Exception.Message)" }
  } finally {
    Pop-Location
  }
}

$wiamAppDir = Join-Path $RepoRoot "WiamAppMobile"
$wiamVoxDir = Join-Path $RepoRoot "WiamVoxMobile"

$results = @()
$results += Invoke-MaestroSuite -WorkingDir $wiamAppDir -SuitePath (Join-Path $wiamAppDir "maestro\suite_top15.yaml") -Label "wiamapp_top15"

if (-not $SkipWiamVox) {
  $results += Invoke-MaestroSuite -WorkingDir $wiamVoxDir -SuitePath (Join-Path $wiamVoxDir "maestro\suite_top10.yaml") -Label "wiamvox_top10"
}

$failed = @($results | Where-Object { $_.status -ne "pass" })
$status = if ($failed.Count -eq 0) { "pass" } else { "fail" }
$score = if ($failed.Count -eq 0) { 100 } else { [Math]::Max(20, 100 - ($failed.Count * 35)) }
$summary = if ($failed.Count -eq 0) {
  "Hourly device QA passed for WiamApp and WiamVox."
} else {
  "Hourly device QA has failures: " + (($failed | ForEach-Object { $_.label }) -join ", ")
}

$payload = @{
  suite = "enterprise-ceo-rest-mode-hourly-device"
  status = $status
  score = $score
  environment = "windows-task-scheduler"
  platform = "wiamapp+wiamvox"
  run_url = ""
  summary = $summary
  metrics = @{
    flows_total = if ($SkipWiamVox) { 15 } else { 25 }
    suites = $results
  }
} | ConvertTo-Json -Depth 8

$headers = @{
  "Content-Type" = "application/json"
  "X-QA-Webhook-Secret" = $QaWebhookSecret
}

Invoke-RestMethod -Method Post -Uri $QaReportEndpoint -Headers $headers -Body $payload | Out-Null
Write-Host "QA hourly runner posted status: $status"
