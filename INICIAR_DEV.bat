@echo off
title Servidor Local OscarFit Web
color 0A
echo ========================================================
echo   INICIANDO SERVIDOR OSCARFIT (VITE + REACT + SUPABASE)
echo ========================================================
echo.
cd /d "%~dp0"
echo Ubicacion: %CD%
echo Iniciando Vite en http://localhost:5173 ...
echo.
npm run dev
pause
