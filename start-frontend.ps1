$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$frontendPath = Join-Path $projectRoot "frontend"

Push-Location $frontendPath
try {
    if (-not (Test-Path ".env.local") -and (Test-Path ".env.example")) {
        Copy-Item ".env.example" ".env.local"
    }

    Write-Host "Starting SIMPLE SURGERY frontend on http://localhost:3010" -ForegroundColor Cyan
    npm.cmd run dev
}
finally {
    Pop-Location
}
