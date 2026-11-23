@echo off
title Portfolio & Admin Server
cd /d "%~dp0"

echo ====================================================
echo   Avvio Portfolio Locale e Pannello Admin...
echo ====================================================
echo.

:: Ricerca automatica dell'eseguibile Node.js
set "NODE_CMD="

where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    set "NODE_CMD=node"
) else if exist "C:\Program Files\nodejs\node.exe" (
    set "NODE_CMD=C:\Program Files\nodejs\node.exe"
    set "PATH=C:\Program Files\nodejs;%PATH%"
) else if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" (
    set "NODE_CMD=%LOCALAPPDATA%\Programs\nodejs\node.exe"
    set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
) else if exist "C:\Program Files (x86)\nodejs\node.exe" (
    set "NODE_CMD=C:\Program Files (x86)\nodejs\node.exe"
    set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
)

if "%NODE_CMD%"=="" (
    echo [ERRORE] Node.js non e stato trovato nel sistema!
    echo Assicurati che Node.js sia installato.
    echo.
    pause
    exit /b 1
)

:: Avvia l'apertura delle pagine nel browser predefinito dopo 1 secondo
start "" cmd /c "timeout /t 1 /nobreak >nul && start http://localhost:5001 && start http://localhost:5001/admin.html"

:: Avvia il server Node
"%NODE_CMD%" admin.js

pause
