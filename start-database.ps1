$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$databasePath = Join-Path $projectRoot "database"

Push-Location $databasePath
try {
    Write-Host "Starting SIMPLE SURGERY PostgreSQL on localhost:5434" -ForegroundColor Cyan
    docker compose up -d
}
finally {
    Pop-Location
}
