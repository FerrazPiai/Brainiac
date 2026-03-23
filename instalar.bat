@echo off
cd /d "%~dp0"

echo ========================================
echo   SEGUNDO CEREBRO - INSTALACAO
echo ========================================
echo.
echo Diretorio atual: %CD%
echo.

echo [1/2] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Node.js nao encontrado!
    echo.
    echo Por favor, instale o Node.js:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js encontrado!
node --version
echo.

echo [2/2] Instalando dependencias...
echo.
npm install

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   INSTALACAO CONCLUIDA COM SUCESSO!
    echo ========================================
    echo.
    echo Para executar a aplicacao:
    echo   npm start
    echo.
    echo Ou execute: executar.bat
    echo.
) else (
    echo.
    echo [ERRO] Falha na instalacao!
    echo Tente executar manualmente:
    echo   1. Abra o terminal nesta pasta
    echo   2. Execute: npm install
    echo.
)

pause
