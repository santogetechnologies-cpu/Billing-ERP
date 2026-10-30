@echo off
title Universal Billing - Local Direct Print Bridge
echo ============================================================
echo Starting Universal Billing Local Direct Print Bridge Service
echo ============================================================
echo.
node "%~dp0print-bridge.cjs"
if %errorlevel% neq 0 (
  echo.
  echo Print bridge encountered an error or was stopped.
  pause
)
