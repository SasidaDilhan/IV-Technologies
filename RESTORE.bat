@echo off
REM Put back a backup. Close the billing system first.
REM You can also drag any .db file onto this icon to restore that file.
call "%~dp0scriptsestore-pos.bat" %1
