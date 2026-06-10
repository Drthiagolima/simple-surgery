$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendPath = Join-Path $projectRoot "backend"

Push-Location $backendPath
try {
    if (-not (Test-Path ".env") -and (Test-Path ".env.example")) {
        Copy-Item ".env.example" ".env"
    }

    python -m pip install -r requirements.txt
    alembic upgrade head
    python -m scripts.seed
}
finally {
    Pop-Location
}
