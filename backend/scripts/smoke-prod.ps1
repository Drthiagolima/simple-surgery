param(
  [string]$FrontendDomain = "www.simplesurgery.com.br",
  [string]$ApiDomain = "api.simplesurgery.com.br",
  [string]$LoginEmail = "centrocirurgico@simplesurgery.com.br",
  [string]$LoginPassword = "simplesurgery"
)

$ErrorActionPreference = "Stop"

function Write-Section {
  param([string]$Title)
  Write-Host ""
  Write-Host "=== $Title ===" -ForegroundColor Cyan
}

function Try-Resolve {
  param([string]$HostName)
  try {
    $records = Resolve-DnsName $HostName -ErrorAction Stop |
      Select-Object Name, Type, IPAddress, NameHost
    if (-not $records) {
      Write-Host "DNS sem registros para $HostName" -ForegroundColor Yellow
      return $false
    }

    $records | Format-Table -AutoSize | Out-Host
    return $true
  }
  catch {
    Write-Host "Falha DNS para ${HostName}: $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

function Try-Get {
  param(
    [string]$Url,
    [string]$Label
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20
    Write-Host "$Label => HTTP $($response.StatusCode)" -ForegroundColor Green
    if ($response.Content) {
      $preview = $response.Content
      if ($preview.Length -gt 160) {
        $preview = $preview.Substring(0, 160) + "..."
      }
      Write-Host "Conteudo: $preview"
    }
    return $true
  }
  catch {
    Write-Host "$Label => ERRO: $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

function Try-PostJson {
  param(
    [string]$Url,
    [hashtable]$Body,
    [string]$Label
  )

  try {
    $json = $Body | ConvertTo-Json -Depth 10
    $response = Invoke-WebRequest -Uri $Url -Method Post -ContentType "application/json" -Body $json -UseBasicParsing -TimeoutSec 20
    Write-Host "$Label => HTTP $($response.StatusCode)" -ForegroundColor Green
    if ($response.Content) {
      $preview = $response.Content
      if ($preview.Length -gt 160) {
        $preview = $preview.Substring(0, 160) + "..."
      }
      Write-Host "Conteudo: $preview"
    }
    return $true
  }
  catch {
    Write-Host "$Label => ERRO: $($_.Exception.Message)" -ForegroundColor Red
    return $false
  }
}

Write-Section "DNS"
$frontendDnsOk = Try-Resolve -HostName $FrontendDomain
$apiDnsOk = Try-Resolve -HostName $ApiDomain

Write-Section "HTTPS"
$frontendHttpOk = Try-Get -Url ("https://" + $FrontendDomain) -Label "Frontend"
$apiHttpOk = Try-Get -Url ("https://" + $ApiDomain + "/health") -Label "API /health"

Write-Section "Backend Mapping"
$legacyApiHealthOk = Try-Get -Url ("https://" + $ApiDomain + "/api/health") -Label "LEGACY /api/health (must be down)"

Write-Section "Auth"
$authOk = Try-PostJson -Url ("https://" + $ApiDomain + "/api/v1/auth/login") -Label "API /api/v1/auth/login" -Body @{
  email = $LoginEmail
  password = $LoginPassword
}

Write-Section "Resumo"
Write-Host "Frontend DNS: $frontendDnsOk"
Write-Host "API DNS: $apiDnsOk"
Write-Host "Frontend HTTPS: $frontendHttpOk"
Write-Host "API HTTPS: $apiHttpOk"
Write-Host "Legacy API health (esperado false): $legacyApiHealthOk"
Write-Host "API Auth: $authOk"

if ($frontendDnsOk -and $apiDnsOk -and $frontendHttpOk -and $apiHttpOk -and $authOk -and (-not $legacyApiHealthOk)) {
  Write-Host "SMOKE PROD OK" -ForegroundColor Green
  exit 0
}

Write-Host "SMOKE PROD FALHOU" -ForegroundColor Red
exit 1
