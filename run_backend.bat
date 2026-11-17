@echo off
title ClipForge AI - Backend
echo Starting ClipForge AI FastAPI Backend...
set PYTHONPATH=%~dp0
"%~dp0backend\venv\Scripts\python.exe" -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
pause
