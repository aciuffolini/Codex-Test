# Farm Visit vNext — Launch Dev Environment
# Starts the vNext gateway (port 8000) + web dev server (port 5173)
# Run from: farm_visit_ui_refactor/next-version/

Write-Host "=== Farm Visit vNext Development Server ===" -ForegroundColor Green
Write-Host ""

# Start gateway in background
Write-Host "[1/2] Starting vNext gateway on port 8000..." -ForegroundColor Cyan
$gatewayJob = Start-Job -ScriptBlock {
    Set-Location $using:PSScriptRoot\..
    python -m gateway.app
}

Start-Sleep -Seconds 2

# Start web dev server
Write-Host "[2/2] Starting web dev server on port 5173..." -ForegroundColor Cyan
Write-Host "       Open: http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers." -ForegroundColor DarkGray

try {
    Set-Location "$PSScriptRoot\..\web-app"
    npx vite --host
}
finally {
    Write-Host "Stopping gateway..." -ForegroundColor Yellow
    Stop-Job $gatewayJob -ErrorAction SilentlyContinue
    Remove-Job $gatewayJob -ErrorAction SilentlyContinue
    Write-Host "Done." -ForegroundColor Green
}
