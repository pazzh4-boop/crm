@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title VIP CRM Diagnostics

echo.
echo ============================================================
echo   VIP CRM DIAGNOSTICS
echo ============================================================
echo.

echo [1] CRM folder:
cd
echo.

echo [2] Required files:
for %%F in (index.html main.css main.js crm_server.ps1 being_config.json START_CRM.bat) do (
  if exist "%%F" (
    echo [OK] %%F
  ) else (
    echo [MISSING] %%F
  )
)
echo.

echo [3] Windows PowerShell:
if exist "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" (
  echo [OK] Found
  "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "$PSVersionTable.PSVersion.ToString()"
) else (
  echo [ERROR] Not found
)
echo.

echo [4] Port 8765:
netstat -ano | findstr ":8765"
if errorlevel 1 echo Port 8765 currently looks free.
echo.

echo [5] being_config.json:
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "$c=Get-Content -LiteralPath '.\being_config.json' -Raw ^| ConvertFrom-Json; Write-Host ('Web App URL configured: ' + [bool]([string]$c.web_app_url).Trim()); Write-Host ('Web App URL ends in /exec: ' + ([string]$c.web_app_url -match '/exec(?:\?.*)?$')); Write-Host ('API key configured: ' + [bool]([string]$c.api_key).Trim())"
echo API key and Web App URL are intentionally hidden.
echo.

echo [6] Live local bridge:
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -Command "try { $p=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/being-api?action=ping' -TimeoutSec 35; Write-Host ('Ping: OK / Apps Script ' + $p.version); $d=Invoke-RestMethod -Uri 'http://127.0.0.1:8765/being-api?action=getClients' -TimeoutSec 35; Write-Host ('Client feed: OK / ' + @($d.clients).Count + ' clients') } catch { Write-Host ('Bridge test failed: ' + $_.Exception.Message) }"
echo.

echo ============================================================
echo Send a screenshot of this window if CRM still will not start.
echo ============================================================
echo.
pause
endlocal
