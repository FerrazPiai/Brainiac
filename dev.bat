@echo off
cd /d "%~dp0"

echo.
echo  ============================================
echo   BRAINIAC - Dev Launcher
echo  ============================================
echo.

node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo  [ERRO] Node.js nao encontrado!
    echo  Instale em: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo  [OK] Node.js encontrado
echo.

if not exist "node_modules" (
    echo  Instalando dependencias...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo  [ERRO] Falha no npm install!
        pause
        exit /b 1
    )
    echo.
    echo  [OK] Dependencias instaladas
    echo.
)

if not exist ".env" (
    echo  Criando .env a partir do .env.example...
    copy ".env.example" ".env" >nul
    echo  [OK] .env criado
    echo.
)

:menu
echo.
echo  ============================================
echo   Como deseja rodar?
echo  ============================================
echo.
echo   [1] Electron (Desktop App)
echo   [2] Web Server (localhost:3000)
echo   [3] Testar API Bridge (curl)
echo   [4] Sair
echo.
set /p opcao="  Escolha [1/2/3/4]: "

if "%opcao%"=="1" goto electron
if "%opcao%"=="2" goto web
if "%opcao%"=="3" goto testapi
if "%opcao%"=="4" exit /b 0
goto menu

:electron
echo.
echo  Iniciando Brainiac (Electron)...
echo  API Bridge em http://127.0.0.1:3847/api
echo.
call npx electron .
goto menu

:web
echo.
echo  Iniciando Brainiac (Web Server)...
echo  Abra no browser: http://localhost:3000
echo  Ctrl+C para encerrar.
echo.
node server.js
goto menu

:testapi
echo.
echo  O Brainiac precisa estar rodando primeiro.
echo.
set /p apiurl="  URL base [http://127.0.0.1:3847]: "
if "%apiurl%"=="" set apiurl=http://127.0.0.1:3847

echo.
echo  --- Health Check ---
curl -s "%apiurl%/api/health"
echo.
echo.
echo  --- Criando tarefa de teste ---
curl -s -X POST "%apiurl%/api/tasks" -H "Content-Type: application/json" -H "X-API-Key: sua-chave-secreta-aqui" -d "{\"source\":\"teste-manual\",\"meeting_id\":\"teste001\",\"meeting_title\":\"Teste Dev\",\"meeting_date\":\"2026-03-18\",\"tasks\":[{\"description\":\"Tarefa de teste via API\",\"person\":\"Pedro\",\"date\":\"2026-03-19\",\"priority\":\"alta\",\"tags\":[\"teste\"]}]}"
echo.
echo.
echo  --- Criando documento de teste ---
curl -s -X POST "%apiurl%/api/documents" -H "Content-Type: application/json" -H "X-API-Key: sua-chave-secreta-aqui" -d "{\"name\":\"Teste Transcricao\",\"content\":\"Conteudo de teste.\",\"tags\":[\"teste\"],\"source\":\"teste-manual\",\"meeting_id\":\"teste001\"}"
echo.
echo.
echo  [OK] Testes finalizados.
echo.
goto menu
