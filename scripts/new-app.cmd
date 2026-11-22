@echo off
set "PATH=%SystemRoot%\System32;%SystemRoot%;%PATH%"
if exist "%APPDATA%\fnm\aliases\default\node.exe" set "PATH=%APPDATA%\fnm\aliases\default;%PATH%"
if exist "C:\Program Files\Git\cmd\git.exe" set "PATH=C:\Program Files\Git\cmd;%PATH%"
if exist "C:\Program Files\GitHub CLI\gh.exe" set "PATH=C:\Program Files\GitHub CLI;%PATH%"
cd /d "%~dp0.."
"%SystemRoot%\System32\chcp.com" 65001 >nul
node scripts\new-app.mjs %*
echo.
pause
