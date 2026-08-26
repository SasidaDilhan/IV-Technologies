@echo off
REM ===========================================================================
REM  IV Technology Billing - start the till
REM
REM  Double-click this file, or put a shortcut to it in the Startup folder so
REM  it runs when the shop computer boots:
REM      Win+R  ->  shell:startup  ->  paste a shortcut to this file there
REM
REM  It backs up, starts the server, and opens the browser. Leave the black
REM  window open while you are billing - closing it stops the system.
REM
REM  If this is a new computer, run install-pos.bat first.
REM ===========================================================================

cd /d "%~dp0.."

echo.
echo   IV Technology Billing
echo   ---------------------

REM next start needs a production build. Without this check it fails with a
REM message that means nothing to whoever is standing at the till.
if not exist ".next\BUILD_ID" (
  echo.
  echo   This copy has not been built yet.
  echo   Run  scripts\install-pos.bat  once, then use this file every day.
  echo.
  pause
  exit /b 1
)

echo   Starting... this window must stay open.
echo.

REM Back up first. If the disk is full or the database is unreadable we want to
REM know now, not the next time someone needs to restore.
call npm run db:backup
if errorlevel 1 (
  echo.
  echo   WARNING: the backup failed. Check the message above.
  echo   Press any key to start anyway, or close this window to stop.
  pause >nul
)

REM Give the server a moment, then open the browser at the till screen.
start "" /b cmd /c "timeout /t 4 >nul && start http://localhost:3000"

call npm run start

echo.
echo   The billing system has stopped.
pause
