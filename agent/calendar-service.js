// ============================================================================
// CALENDAR-SERVICE.JS — Busca eventos do Google Calendar com Meet
// ============================================================================

const { google } = require('googleapis');
const config = require('./config');

/**
 * Busca eventos do Google Calendar que têm conferência Meet
 * e terminaram nas últimas N horas.
 *
 * @param {google.auth.OAuth2} auth - Cliente autenticado
 * @param {Set<string>} processedIds - IDs de meetings já processados
 * @returns {Array} - Lista de eventos com conferência Meet
 */
async function getRecentMeetEvents(auth, processedIds = new Set()) {
  const calendar = google.calendar({ version: 'v3', auth });

  const now = new Date();
  const lookback = new Date(now.getTime() - config.agent.lookbackHours * 60 * 60 * 1000);

  console.log(`📅 Buscando eventos entre ${lookback.toLocaleString()} e ${now.toLocaleString()}...`);

  const response = await calendar.events.list({
    calendarId: 'primary',
    timeMin: lookback.toISOString(),
    timeMax: now.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
    conferenceDataVersion: 1
  });

  const events = response.data.items || [];
  console.log(`   ${events.length} evento(s) encontrado(s) no período`);

  // Filtrar apenas eventos com Meet que já terminaram e não foram processados
  const meetEvents = events.filter(event => {
    // Deve ter conferência Meet
    if (!event.conferenceData || !event.conferenceData.conferenceId) return false;

    // Deve ter terminado
    const endTime = new Date(event.end.dateTime || event.end.date);
    if (endTime > now) return false;

    // Não deve ter sido processado
    const conferenceId = event.conferenceData.conferenceId;
    if (processedIds.has(conferenceId)) {
      console.log(`   ⏭ Pulando "${event.summary}" (já processado)`);
      return false;
    }

    return true;
  });

  console.log(`   ${meetEvents.length} evento(s) com Meet não processado(s)`);

  return meetEvents.map(event => ({
    id: event.id,
    conferenceId: event.conferenceData.conferenceId,
    title: event.summary || 'Sem título',
    date: (event.start.dateTime || event.start.date).split('T')[0],
    startTime: event.start.dateTime,
    endTime: event.end.dateTime,
    attendees: (event.attendees || []).map(a => ({
      email: a.email,
      name: a.displayName || a.email.split('@')[0]
    })),
    conferenceData: event.conferenceData
  }));
}

module.exports = { getRecentMeetEvents };
