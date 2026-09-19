@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "WSCRIPT=%SystemRoot%\System32\wscript.exe"
set "LAUNCHER=%~dp0START_CRM_HIDDEN.vbs"

if not exist "%WSCRIPT%" exit /b 1
if not exist "%LAUNCHER%" exit /b 2

start "" /b "%WSCRIPT%" "%LAUNCHER%"
endlocal
exit /b 0
