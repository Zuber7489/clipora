$Host.UI.RawUI.WindowTitle = "ClipForge AI - Frontend"
Write-Host "Starting ClipForge AI Angular Frontend..." -ForegroundColor Magenta

Set-Location "$PSScriptRoot\frontend"
npx ng serve --port 4200
