@echo off
REM IV Technology Billing - take a backup now. Safe while the system is open.
cd /d "%~dp0.."
echo.
call npm run db:backup
echo.
pause
