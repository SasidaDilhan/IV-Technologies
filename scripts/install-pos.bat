@echo off
REM ===========================================================================
REM  IV Technology Billing - one-time setup on a new computer
REM
REM  Run this ONCE after copying the project folder onto the shop machine.
REM  It installs dependencies, prepares the database, and builds the system
REM  for production. After this, day-to-day use is start-pos.bat.
REM
REM  Requires Node.js 20 or newer: https://nodejs.org
REM ===========================================================================

cd /d "%~dp0.."

echo.
echo   IV Technology Billing - setup
echo   =============================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js is not installed.
  echo   Install it from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do echo   Node %%v found.
echo.

echo   [1/4] Installing dependencies. This takes a few minutes...
call npm install
if errorlevel 1 goto failed

echo.
echo   [2/4] Preparing the database...
call npx prisma migrate deploy
if errorlevel 1 goto failed
call npx prisma generate
if errorlevel 1 goto failed

echo.
echo   [3/4] Building for production. This takes a minute...
call npm run build
if errorlevel 1 goto failed

echo.
echo   [4/4] Taking a first backup...
call npm run db:backup

echo.
echo   =============================
echo   Setup finished.
echo.
echo   Next steps:
echo     1. Double-click scripts\start-pos.bat to run the system.
echo     2. Open Settings and fill in the business details and logo.
echo     3. To start it automatically when this computer boots:
echo        press Win+R, type  shell:startup  and put a shortcut to
echo        start-pos.bat in the folder that opens.
echo.
pause
exit /b 0

:failed
echo.
echo   SETUP FAILED - see the message above.
echo   Nothing has been broken; fix the problem and run this again.
echo.
pause
exit /b 1
