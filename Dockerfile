# ============================================================================
# Dockerfile - Brainiac Hub (Web App para EasyPanel / VPS)
# ============================================================================

FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copiar package.json e instalar dependencias
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copiar backend
COPY server.js ./
COPY ai-service.js ./
COPY api-server.js ./
COPY google-sheets-service.js ./
COPY start.sh ./
RUN chmod +x start.sh

# Copiar frontend (versao web)
COPY public/ ./public/

# Copiar modulos de renderer da raiz para public (sobrescreve se existir)
COPY renderer.js ./public/renderer.js
COPY renderer-financeiro.js ./public/renderer-financeiro.js
COPY renderer-oneones.js ./public/renderer-oneones.js
COPY renderer-equipe.js ./public/renderer-equipe.js
COPY styles.css ./public/styles.css
COPY icon.png ./public/icon.png

# Diretorio de dados persistentes (montar volume no EasyPanel)
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000

# Usar script de debug para evitar restart loop
CMD ["./start.sh"]
