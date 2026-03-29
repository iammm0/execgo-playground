param(
  [string]$Scenario = "basic"
)

$ErrorActionPreference = "Stop"

function Load-Json([string]$Path) {
  if (-not (Test-Path $Path)) {
    throw "missing result file: $Path"
  }
  return Get-Content $Path -Raw | ConvertFrom-Json
}

$go = Load-Json "./out/go.$Scenario.result.json"
$py = Load-Json "./out/python.$Scenario.result.json"
$ts = Load-Json "./out/ts.$Scenario.result.json"

$checks = @(
  "result_version",
  "request_id",
  "summary.final_status"
)

foreach ($k in $checks) {
  $g = Invoke-Expression ('$go.' + $k)
  $p = Invoke-Expression ('$py.' + $k)
  $t = Invoke-Expression ('$ts.' + $k)
  if ($g -ne $p -or $p -ne $t) {
    throw "mismatch at $k : go=$g py=$p ts=$t"
  }
}

Write-Host "Result fields are aligned for scenario '$Scenario'."
