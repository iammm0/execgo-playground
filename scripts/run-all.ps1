param(
  [string]$Scenario = "basic"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Force -Path "out" | Out-Null

Write-Host "[preflight] Check execgo upstream updates"
pwsh ./scripts/check-execgo-version.ps1

Write-Host "[1/3] Run Go orchestrator"
go run ./orchestrators/go/cmd/orchestrator -request "./scenarios/$Scenario/request.json" `
  | Out-File -Encoding utf8 "./out/go.$Scenario.result.json"

Write-Host "[2/3] Run Python orchestrator"
python -m orchestrators.python.src.main --request "./scenarios/$Scenario/request.json" `
  | Out-File -Encoding utf8 "./out/python.$Scenario.result.json"

Write-Host "[3/3] Run TS orchestrator"
Push-Location "./orchestrators/ts"
npm install
npm run build
npm run start -- --request "../../scenarios/$Scenario/request.json" `
  | Out-File -Encoding utf8 "../../out/ts.$Scenario.result.json"
Pop-Location

Write-Host "Run compare script"
pwsh ./scripts/compare-results.ps1 -Scenario $Scenario
