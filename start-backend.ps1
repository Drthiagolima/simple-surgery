$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $projectRoot "backend"

Push-Location $backendPath
try {
    if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
        Copy-Item ".env.example" ".env"
    }

    Write-Host "Starting SIMPLE SURGERY backend on http://localhost:8010" -ForegroundColor Cyan
    uvicorn app.main:app --reload --port 8010
}
finally {
    Pop-Location
}
