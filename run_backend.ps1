$Host.UI.RawUI.WindowTitle = "ClipForge AI - Backend"
Write-Host "Starting ClipForge AI FastAPI Backend..." -ForegroundColor Cyan

$env:PYTHONPATH = $PSScriptRoot
& "$PSScriptRoot\backend\venv\Scripts\python.exe" -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
