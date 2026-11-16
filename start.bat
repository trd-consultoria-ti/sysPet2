@echo off
title Animal World - Subindo stack
cd /d "%~dp0"

echo [1/3] Subindo Postgres (docker compose)...
call npm run db:up
if errorlevel 1 (
  echo ERRO: Docker nao disponivel. Instale o Docker Desktop e tente de novo.
  pause
  exit /b 1
)

echo [2/3] Subindo API em http://localhost:3100...
start "Animal World API" cmd /k "node server\index.js"

echo [3/3] Subindo front Angular em http://localhost:4200...
echo      (Necessario NODE_OPTIONS=--openssl-legacy-provider no Node 24+)
set NODE_OPTIONS=--openssl-legacy-provider
call npm start
pause
