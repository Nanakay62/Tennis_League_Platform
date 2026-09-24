<#
.SYNOPSIS
    Convenience orchestrator for local development on Windows PowerShell.
#>
param (
    [Parameter(Position = 0)]
    [ValidateSet("api", "mobile", "check", "test", "format")]
    [string]$Command = "check"
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot

switch ($Command) {
    "api" {
        Write-Host "Starting FastAPI backend on http://localhost:8000 ..." -ForegroundColor Green
        Set-Location "$RootDir\apps\api"
        uv run fastapi dev app/main.py --host 0.0.0.0 --port 8000
    }
    "mobile" {
        Write-Host "Starting Expo Mobile client ..." -ForegroundColor Green
        Set-Location "$RootDir\apps\mobile"
        npm run start
    }
    "check" {
        Write-Host "Running Backend Checks (Ruff, Mypy, Pytest)..." -ForegroundColor Cyan
        Set-Location "$RootDir\apps\api"
        uv run ruff format --check .
        uv run ruff check .
        uv run mypy app
        uv run pytest -q

        Write-Host "`nRunning Client Checks (TypeScript)..." -ForegroundColor Cyan
        Set-Location "$RootDir\apps\mobile"
        npm run typecheck

        Write-Host "`nAll quality checks passed!" -ForegroundColor Green
    }
    "test" {
        Set-Location "$RootDir\apps\api"
        uv run pytest -v
    }
    "format" {
        Write-Host "Auto-formatting backend..." -ForegroundColor Cyan
        Set-Location "$RootDir\apps\api"
        uv run ruff check --fix .
        uv run ruff format .
    }
}
