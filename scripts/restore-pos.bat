@echo off
REM ===========================================================================
REM  IV Technology Billing - restore a backup
REM
REM  Close the billing system (its black window) before running this.
REM  The data in the system now is backed up first, so nothing is lost even if
REM  the wrong backup is picked - just run this again and pick that one.
REM ===========================================================================

cd /d "%~dp0.."

echo.
echo   IV Technology Billing - Restore a backup
echo   ----------------------------------------
echo.

call npx tsx scriptsestore.ts %1
if errorlevel 2 goto done
if errorlevel 1 goto failed

echo.
echo   Bringing the restored data up to this version...
REM An older backup may predate recent updates. migrate deploy adds whatever it
REM is missing and never removes anything.
call npx prisma migrate deploy
if errorlevel 1 goto failed

echo.
echo   ==============================
echo   Restore finished. Start the system with START.bat
echo   and check the last few invoices look right.
echo.
pause
exit /b 0

:failed
echo.
echo   RESTORE DID NOT COMPLETE - see the message above.
echo.
pause
exit /b 1

:done
echo.
pause
exit /b 0
