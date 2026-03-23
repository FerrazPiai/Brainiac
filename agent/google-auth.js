// ============================================================================
// GOOGLE-AUTH.JS — Autenticação OAuth2 com Google APIs
// ============================================================================

const { google } = require('googleapis');
const fs = require('fs');
const http = require('http');
const url = require('url');
const config = require('./config');

/**
 * Cria e retorna um cliente OAuth2 autenticado.
 * No primeiro uso, abre o browser para autorização.
 * Tokens são salvos em tokens.json para reutilização.
 */
async function getAuthClient() {
  const oauth2Client = new google.auth.OAuth2(
    config.google.clientId,
    config.google.clientSecret,
    config.google.redirectUri
  );

  // Tentar carregar tokens salvos
  if (fs.existsSync(config.google.tokensPath)) {
    const tokens = JSON.parse(fs.readFileSync(config.google.tokensPath, 'utf8'));
    oauth2Client.setCredentials(tokens);

    // Verificar se o token expirou e renovar se necessário
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      console.log('🔄 Token expirado, renovando...');
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
        fs.writeFileSync(config.google.tokensPath, JSON.stringify(credentials, null, 2));
        console.log('✓ Token renovado');
      } catch (error) {
        console.error('❌ Erro ao renovar token. Será necessário reautenticar.');
        return await authorizeInteractively(oauth2Client);
      }
    }

    return oauth2Client;
  }

  // Primeira vez: autenticação interativa
  return await authorizeInteractively(oauth2Client);
}

/**
 * Fluxo de autorização interativa — abre o browser.
 */
async function authorizeInteractively(oauth2Client) {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: config.google.scopes,
    prompt: 'consent'
  });

  console.log('');
  console.log('='.repeat(60));
  console.log('  🔐 Autorização Google necessária');
  console.log('='.repeat(60));
  console.log('');
  console.log('  Abra esta URL no browser:');
  console.log('');
  console.log(`  ${authUrl}`);
  console.log('');

  // Abrir browser automaticamente (Windows/Mac/Linux)
  const open = process.platform === 'win32' ? 'start' :
    process.platform === 'darwin' ? 'open' : 'xdg-open';
  require('child_process').exec(`${open} "${authUrl}"`);

  // Servidor temporário para capturar o callback
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const queryParams = url.parse(req.url, true).query;

      if (queryParams.code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h2>✓ Autorização concedida! Pode fechar esta aba.</h2>');

        try {
          const { tokens } = await oauth2Client.getToken(queryParams.code);
          oauth2Client.setCredentials(tokens);
          fs.writeFileSync(config.google.tokensPath, JSON.stringify(tokens, null, 2));
          console.log('✓ Tokens salvos em', config.google.tokensPath);
          resolve(oauth2Client);
        } catch (error) {
          reject(error);
        }

        server.close();
      }
    });

    const callbackPort = parseInt(new URL(config.google.redirectUri).port) || 3000;
    server.listen(callbackPort, () => {
      console.log(`  Aguardando callback em http://localhost:${callbackPort}...`);
    });

    // Timeout de 5 minutos
    setTimeout(() => {
      server.close();
      reject(new Error('Timeout na autorização (5 minutos)'));
    }, 5 * 60 * 1000);
  });
}

module.exports = { getAuthClient };
