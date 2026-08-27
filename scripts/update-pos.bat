@echo off
REM ===========================================================================
REM  IV Technology Billing - apply an update
REM
REM  Two ways to get a new version onto this machine:
REM
REM    A) This folder is a git clone - the script pulls the new version
REM       itself. Nothing to copy.
REM
REM    B) Someone copied an UPDATE folder over this one - the script just
REM       applies what is already here.
REM
REM  Either way the customer data is never touched. The database
REM  (prisma\dev.db), the .env file and the backups folder are git-ignored and
REM  are never in an update package, so neither route can overwrite them.
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

echo   [1/5] Backing up the current data first...
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
if not exist ".git" (
  echo   [2/5] Not a git copy - using the files already in this folder.
  goto deps
)

where git >nul 2>nul
if errorlevel 1 (
  echo   [2/5] git is not installed - using the files already in this folder.
  goto deps
)

REM Refuse to pull over local edits rather than clobbering them or stopping
REM half-way through a merge on a machine nobody can debug.
git diff --quiet
if errorlevel 1 (
  echo   This copy has local changes to the program files.
  echo   Pulling would overwrite them. Nothing has been changed.
  echo.
  echo   Ask whoever maintains the system to look at it.
  echo.
  pause
  exit /b 1
)

echo   [2/5] Fetching the new version...
git pull --ff-only
if errorlevel 1 (
  echo.
  echo   Could not fetch the update. The system is untouched and still
  echo   works - check the internet connection and try again.
  echo.
  pause
  exit /b 1
)

:deps
echo.
echo   [3/5] Updating dependencies...
call npm install
if errorlevel 1 goto failed

echo.
echo   [4/5] Updating the database structure...
REM migrate deploy only applies migrations that have not run yet, and never
REM resets or drops anything. Existing customers, bills and stock are kept.
call npx prisma migrate deploy
if errorlevel 1 goto failed
call npx prisma generate
if errorlevel 1 goto failed

echo.
echo   [5/5] Rebuilding...
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
