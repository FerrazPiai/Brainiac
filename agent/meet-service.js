// ============================================================================
// MEET-SERVICE.JS — Busca transcrições via Google Meet REST API
// ============================================================================

const { google } = require('googleapis');

/**
 * Busca a transcrição de uma conferência do Meet.
 * Usa a Meet REST API para obter o transcript e retorna o DocsDestination.
 *
 * @param {google.auth.OAuth2} auth - Cliente autenticado
 * @param {string} conferenceId - ID da conferência Meet
 * @returns {object|null} - { docsUrl, transcriptId } ou null se não disponível
 */
async function getTranscript(auth, conferenceId) {
  try {
    // Buscar conferenceRecords pelo conferenceId
    // A Meet REST API usa o formato: spaces/{spaceId}
    const meet = google.meet({ version: 'v2', auth });

    // Listar conference records
    const recordsResponse = await meet.conferenceRecords.list({
      filter: `space.meeting_code="${conferenceId}"`
    });

    const records = recordsResponse.data.conferenceRecords || [];
    if (records.length === 0) {
      console.log(`   ℹ Nenhum registro de conferência encontrado para ${conferenceId}`);
      return null;
    }

    // Usar o registro mais recente
    const latestRecord = records[records.length - 1];
    const recordName = latestRecord.name; // formato: conferenceRecords/{id}

    // Buscar transcrições
    const transcriptsResponse = await meet.conferenceRecords.transcripts.list({
      parent: recordName
    });

    const transcripts = transcriptsResponse.data.transcripts || [];
    if (transcripts.length === 0) {
      console.log(`   ℹ Transcrição ainda não disponível para ${conferenceId}`);
      return null;
    }

    const transcript = transcripts[0];

    // Verificar se tem DocsDestination
    if (transcript.docsDestination && transcript.docsDestination.document) {
      return {
        docsUrl: transcript.docsDestination.document,
        exportUri: transcript.docsDestination.exportUri,
        transcriptId: transcript.name
      };
    }

    console.log(`   ℹ Transcrição sem documento Docs associado para ${conferenceId}`);
    return null;

  } catch (error) {
    if (error.code === 404 || error.status === 404) {
      console.log(`   ℹ API Meet: Nenhuma transcrição encontrada para ${conferenceId}`);
      return null;
    }
    // Meet pode demorar até 45min para gerar transcrição
    if (error.code === 403 || error.message?.includes('not ready')) {
      console.log(`   ⏳ Transcrição ainda sendo gerada para ${conferenceId} (tente novamente em alguns minutos)`);
      return null;
    }
    throw error;
  }
}

module.exports = { getTranscript };
