// ============================================================================
// CONFIG.JS — Configurações do agente
// ============================================================================

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const config = {
  // Google OAuth
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth/callback',
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/meetings.space.readonly',
      'https://www.googleapis.com/auth/drive.readonly'
    ],
    tokensPath: require('path').join(__dirname, 'tokens.json')
  },

  // Anthropic / Claude API
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0
  },

  // Brainiac API Bridge
  brainiac: {
    url: process.env.BRAINIAC_URL || 'http://localhost:3847',
    apiKey: process.env.BRAINIAC_API_KEY
  },

  // Agent settings
  agent: {
    checkIntervalMinutes: parseInt(process.env.AGENT_CHECK_INTERVAL_MINUTES) || 30,
    lookbackHours: 2,
    processedMeetingsPath: require('path').join(__dirname, 'processed-meetings.json'),
    source: 'meet-agent'
  }
};

module.exports = config;
