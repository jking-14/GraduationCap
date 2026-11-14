@echo off
cd /d "%~dp0"
where cloudflared >nul 2>&1
if errorlevel 1 (
  echo Install cloudflared first, then reopen this launcher.
  echo Official instructions: https://developers.cloudflare.com/tunnel/downloads/
  echo You can still use start-windows.bat for local controls without camera or tilt.
  pause
  exit /b 1
)
call "%~dp0start-windows.bat" --tunnel
