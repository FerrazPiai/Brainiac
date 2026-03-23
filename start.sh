#!/bin/sh

echo "🚀 Iniciando Segundo Cérebro (Debug Mode)..."
echo "📂 Diretório atual: $(pwd)"
echo "👤 Usuário: $(whoami)"
echo "📦 Conteúdo do diretório:"
ls -la

echo "🔧 Variáveis de ambiente (seguro):"
echo "  NODE_ENV=${NODE_ENV:-not set}"
echo "  PORT=${PORT:-3000}"
echo "  ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:+****definida}"
echo "  GOOGLE_SHEETS_ID=${GOOGLE_SHEETS_ID:+****definido}"
echo "  GOOGLE_CREDENTIALS_B64=${GOOGLE_CREDENTIALS_B64:+****definido}"
echo "  GOOGLE_CREDENTIALS_JSON=${GOOGLE_CREDENTIALS_JSON:+****definido}"
echo "  BRAINIAC_API_KEY=${BRAINIAC_API_KEY:+****definida}"

echo "⏳ Iniciando servidor na porta ${PORT:-3000}..."

# Executa o servidor e captura qualquer erro
node server.js

EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ Servidor crashou com código $EXIT_CODE"
    echo "🛑 Mantendo container vivo para debug..."
    # Loop infinito para permitir leitura de logs e exec no container
    while true; do sleep 1000; done
else
    echo "✅ Servidor finalizou normalmente (SIGTERM/SIGINT recebido)"
fi
