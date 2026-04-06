@echo off
title Stopping OllyMagenti
echo ========================================
echo     Stopping OllyMagenti...
echo ========================================
echo.

:: Find and kill process on port 3000 (backend)
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo Stopping backend (PID: %%a)
    taskkill /F /PID %%a 2>nul
)

:: Find and kill process on port 5173 (frontend)
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5173" ^| find "LISTENING"') do (
    echo Stopping frontend (PID: %%a)
    taskkill /F /PID %%a 2>nul
)

echo.
echo OllyMagenti stopped.
echo You can now close this window.
timeout /t 3 /nobreak >nul