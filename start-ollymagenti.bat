@echo off
title OllyMagenti Launcher
echo ========================================
echo     OllyMagenti - Local AI Chat
echo ========================================
echo.
echo Starting OllyMagenti...
echo.

cd /d C:\Users\HUAWEI\ollympagenti

:: Start backend (window stays open)
echo [1/3] Starting backend server...
start "OllyMagenti Backend" cmd /k "node server/index.js"

:: Wait for backend to initialize
timeout /t 3 /nobreak >nul

:: Start frontend (window stays open)
echo [2/3] Starting frontend...
start "OllyMagenti Frontend" cmd /k "npx vite client --port 5173"

:: Wait for frontend to initialize
timeout /t 3 /nobreak >nul

:: Open browser
echo [3/3] Opening browser...
start http://localhost:5173

echo.
echo ========================================
echo OllyMagenti is running!
echo.
echo You can close this window.
echo The two command windows will stay open.
echo To stop OllyMagenti, close those windows
echo or run stop-ollymagenti.bat
echo ========================================
echo.
pause