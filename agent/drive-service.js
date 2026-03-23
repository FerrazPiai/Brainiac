// ============================================================================
// DRIVE-SERVICE.JS — Lê conteúdo de documentos do Google Docs via Drive API
// ============================================================================

const { google } = require('googleapis');

/**
 * Lê o conteúdo texto de um Google Docs via Drive API.
 *
 * @param {google.auth.OAuth2} auth - Cliente autenticado
 * @param {string} documentUrl - URL ou ID do Google Docs
 * @returns {string|null} - Texto completo do documento ou null
 */
async function readDocument(auth, documentUrl) {
  try {
    // Extrair o document ID da URL
    const docId = extractDocId(documentUrl);
    if (!docId) {
      console.error('   ❌ Não foi possível extrair o ID do documento:', documentUrl);
      return null;
    }

    const docs = google.docs({ version: 'v1', auth });
    const response = await docs.documents.get({ documentId: docId });

    // Extrair texto do documento
    const content = response.data.body.content || [];
    let fullText = '';

    for (const element of content) {
      if (element.paragraph) {
        for (const textElement of element.paragraph.elements || []) {
          if (textElement.textRun && textElement.textRun.content) {
            fullText += textElement.textRun.content;
          }
        }
      }
    }

    return fullText.trim() || null;

  } catch (error) {
    if (error.code === 404) {
      console.error(`   ❌ Documento não encontrado: ${documentUrl}`);
      return null;
    }
    if (error.code === 403) {
      console.error(`   ❌ Sem permissão para acessar o documento: ${documentUrl}`);
      return null;
    }
    throw error;
  }
}

/**
 * Extrai o document ID de uma URL do Google Docs.
 */
function extractDocId(urlOrId) {
  if (!urlOrId) return null;

  // Se já é um ID puro (sem barras)
  if (!urlOrId.includes('/') && !urlOrId.includes('.')) {
    return urlOrId;
  }

  // Formatos de URL possíveis:
  // https://docs.google.com/document/d/{id}/edit
  // https://docs.google.com/document/d/{id}
  const match = urlOrId.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];

  // Formato exportUri
  const exportMatch = urlOrId.match(/id=([a-zA-Z0-9_-]+)/);
  if (exportMatch) return exportMatch[1];

  return urlOrId;
}

module.exports = { readDocument, extractDocId };
