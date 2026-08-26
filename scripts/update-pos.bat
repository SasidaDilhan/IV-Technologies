@echo off
REM ===========================================================================
REM  IV Technology Billing - apply an update
REM
REM  Run this after copying a newer set of program files over this folder.
REM
REM  It does NOT touch the customer data. The database (prisma\dev.db), the
REM  .env file and the backups folder are never included in an update package,
REM  so copying one over this folder cannot overwrite them.
REM
REM  A backup is taken before anything else, so even a bad update is one file
REM  copy away from being undone.
REM ===========================================================================

cd /d "%~dp0.."

echo.
echo   IV Technology Billing - update
echo   ==============================
echo.

if not exist ".env" (
  echo   Creating .env from .env.example...
  copy /y ".env.example" ".env" >nul
)

echo   [1/4] Backing up the current data first...
call npm run db:backup
if errorlevel 1 (
  echo.
  echo   The backup FAILED. Stopping here - an update should never be
  echo   applied without one. Fix the problem above and run this again.
  echo.
  pause
  exit /b 1
)

echo.
echo   [2/4] Updating dependencies...
call npm install
if errorlevel 1 goto failed

echo.
echo   [3/4] Updating the database structure...
REM migrate deploy only applies migrations that have not run yet, and never
REM resets or drops anything. Existing customers, bills and stock are kept.
call npx prisma migrate deploy
if errorlevel 1 goto failed
call npx prisma generate
if errorlevel 1 goto failed

echo.
echo   [4/4] Rebuilding...
call npm run build
if errorlevel 1 goto failed

echo.
echo   ==============================
echo   Update finished. Start the system with scripts\start-pos.bat
echo.
pause
exit /b 0

:failed
echo.
echo   UPDATE FAILED - see the message above.
echo   The data is untouched and a backup was taken before starting.
echo   The previous version may no longer run until this is fixed.
echo.
pause
exit /b 1
