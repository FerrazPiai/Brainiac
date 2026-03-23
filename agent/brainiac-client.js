// ============================================================================
// BRAINIAC-CLIENT.JS — Cliente HTTP para a API Bridge do Brainiac
// ============================================================================

const config = require('./config');

const BASE_URL = config.brainiac.url;
const API_KEY = config.brainiac.apiKey;

/**
 * Headers padrão para todas as requisições.
 */
function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (API_KEY) {
    headers['X-API-Key'] = API_KEY;
  }
  return headers;
}

/**
 * Health check — verifica se o Brainiac está rodando e retorna pessoas/projetos.
 * @returns {{ status: string, people: string[], projects: string[] }}
 */
async function healthCheck() {
  const response = await fetch(`${BASE_URL}/api/health`, {
    method: 'GET',
    headers: getHeaders()
  });

  if (!response.ok) {
    throw new Error(`Brainiac health check falhou: HTTP ${response.status}`);
  }

  return await response.json();
}

/**
 * Envia tarefas para o Brainiac.
 */
async function sendTasks(payload) {
  const response = await fetch(`${BASE_URL}/api/tasks`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao enviar tarefas: HTTP ${response.status} — ${text}`);
  }

  return await response.json();
}

/**
 * Envia documento (transcrição) para o Brainiac.
 */
async function sendDocument(payload) {
  const response = await fetch(`${BASE_URL}/api/documents`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro ao enviar documento: HTTP ${response.status} — ${text}`);
  }

  return await response.json();
}

module.exports = { healthCheck, sendTasks, sendDocument };
