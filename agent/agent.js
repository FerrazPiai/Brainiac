#!/usr/bin/env node
// ============================================================================
// AGENT.JS — Orquestrador principal do Meet Agent
// ============================================================================
// Processa transcrições do Google Meet e cria tarefas no Brainiac.
//
// Uso:
//   node agent.js              → Executa uma vez (últimas 2h)
//   node agent.js --watch      → Loop contínuo (a cada N minutos)
// ============================================================================

const fs = require('fs');
const config = require('./config');
const { getAuthClient } = require('./google-auth');
const { getRecentMeetEvents } = require('./calendar-service');
const { getTranscript } = require('./meet-service');
const { readDocument } = require('./drive-service');
const { processTranscript } = require('./filter-service');
const brainiac = require('./brainiac-client');

// ============================================================================
// Cache de meetings processados
// ============================================================================

function loadProcessedMeetings() {
  try {
    if (fs.existsSync(config.agent.processedMeetingsPath)) {
      return JSON.parse(fs.readFileSync(config.agent.processedMeetingsPath, 'utf8'));
    }
  } catch (e) {
    console.warn('⚠ Erro ao carregar cache de meetings:', e.message);
  }
  return {};
}

function saveProcessedMeeting(meetingId, result) {
  const cache = loadProcessedMeetings();
  cache[meetingId] = {
    processed_at: new Date().toISOString(),
    tasks_created: result.tasks_created || 0
  };
  fs.writeFileSync(config.agent.processedMeetingsPath, JSON.stringify(cache, null, 2));
}

// ============================================================================
// Pipeline principal
// ============================================================================

async function run() {
  console.log('');
  console.log('='.repeat(60));
  console.log('  🤖 Meet Agent — Processador de Transcrições');
  console.log('='.repeat(60));
  console.log(`  ⏰ ${new Date().toLocaleString()}`);
  console.log('');

  // ---- STEP 1: Health Check do Brainiac ----
  console.log('1️⃣  Verificando Brainiac...');
  let brainiacHealth;
  try {
    brainiacHealth = await brainiac.healthCheck();
    console.log(`   ✓ Brainiac online — ${brainiacHealth.people.length} pessoas, ${brainiacHealth.projects.length} projetos`);
  } catch (error) {
    console.error(`   ❌ Brainiac não encontrado em ${config.brainiac.url} — inicie o app primeiro`);
    console.error(`      Detalhes: ${error.message}`);
    process.exit(1);
  }

  const { people, projects } = brainiacHealth;

  // ---- STEP 2: Autenticação Google ----
  console.log('');
  console.log('2️⃣  Autenticando com Google...');
  let auth;
  try {
    auth = await getAuthClient();
    console.log('   ✓ Autenticado');
  } catch (error) {
    console.error('   ❌ Erro na autenticação Google:', error.message);
    process.exit(1);
  }

  // ---- STEP 3: Buscar eventos do Calendar ----
  console.log('');
  console.log('3️⃣  Buscando eventos no Google Calendar...');
  const processedCache = loadProcessedMeetings();
  const processedIds = new Set(Object.keys(processedCache));

  let meetEvents;
  try {
    meetEvents = await getRecentMeetEvents(auth, processedIds);
  } catch (error) {
    console.error('   ❌ Erro ao buscar eventos:', error.message);
    process.exit(1);
  }

  if (meetEvents.length === 0) {
    console.log('   ℹ Nenhuma call encontrada nas últimas 2h');
    console.log('');
    console.log('✅ Agente finalizado — nada para processar');
    return;
  }

  // ---- STEP 4-6: Processar cada evento ----
  let totalTasksCreated = 0;
  let totalDocsCreated = 0;

  for (const event of meetEvents) {
    console.log('');
    console.log(`━━━ Processando: "${event.title}" (${event.date}) ━━━`);

    // STEP 4: Buscar transcrição
    console.log('4️⃣  Buscando transcrição...');
    let transcriptInfo;
    try {
      transcriptInfo = await getTranscript(auth, event.conferenceId);
    } catch (error) {
      console.error('   ❌ Erro ao buscar transcrição:', error.message);
      continue;
    }

    if (!transcriptInfo) {
      console.log('   ⏭ Sem transcrição disponível — pulando');
      continue;
    }

    // Ler conteúdo do Google Docs
    console.log('   📄 Lendo documento da transcrição...');
    let transcriptText;
    try {
      transcriptText = await readDocument(auth, transcriptInfo.docsUrl);
    } catch (error) {
      console.error('   ❌ Erro ao ler documento:', error.message);
      continue;
    }

    if (!transcriptText || transcriptText.length < 50) {
      console.log('   ⏭ Transcrição vazia ou muito curta — pulando');
      continue;
    }
    console.log(`   ✓ Transcrição lida (${transcriptText.length} caracteres)`);

    // STEP 5: Filtro Inteligente (Claude API)
    console.log('5️⃣  Processando com Claude API...');
    let analysis;
    try {
      analysis = await processTranscript(
        transcriptText,
        {
          date: event.date,
          title: event.title,
          attendees: event.attendees
        },
        people,
        projects
      );
      console.log(`   ✓ Tipo: ${analysis.meeting_type}`);
      console.log(`   ✓ Tarefas extraídas: ${analysis.tasks?.length || 0}`);
      if (analysis.meeting_summary) {
        console.log(`   📝 Resumo: ${analysis.meeting_summary}`);
      }
    } catch (error) {
      console.error('   ❌ Erro no filtro inteligente:', error.message);
      continue;
    }

    // STEP 6: Enviar para o Brainiac
    console.log('6️⃣  Enviando para o Brainiac...');

    // Enviar tarefas
    if (analysis.tasks && analysis.tasks.length > 0) {
      try {
        const taskPayload = {
          source: config.agent.source,
          meeting_id: event.conferenceId,
          meeting_title: event.title,
          meeting_date: event.date,
          tasks: analysis.tasks
        };
        const taskResult = await brainiac.sendTasks(taskPayload);
        console.log(`   ✓ Tarefas: ${taskResult.tasks_created} criadas, ${taskResult.tasks_skipped} puladas`);
        totalTasksCreated += taskResult.tasks_created;

        if (taskResult.details) {
          for (const detail of taskResult.details) {
            if (detail.status === 'skipped') {
              console.log(`     ⚠ Pulada: "${detail.description}" — ${detail.reason}`);
            }
          }
        }
      } catch (error) {
        console.error('   ❌ Erro ao enviar tarefas:', error.message);
      }
    } else {
      console.log('   ℹ Nenhuma tarefa para enviar');
    }

    // Enviar transcrição como documento
    try {
      const dateFormatted = event.date.split('-').reverse().join('/');
      const docPayload = {
        name: `Transcrição - ${event.title} - ${dateFormatted}`,
        content: transcriptText,
        project: analysis.project || null,
        tags: ['transcrição', 'call', analysis.meeting_type],
        source: config.agent.source,
        meeting_id: event.conferenceId
      };
      const docResult = await brainiac.sendDocument(docPayload);
      console.log(`   ✓ Documento salvo: "${docResult.name}"`);
      totalDocsCreated++;
    } catch (error) {
      console.error('   ❌ Erro ao salvar documento:', error.message);
    }

    // Salvar no cache de processados
    saveProcessedMeeting(event.conferenceId, {
      tasks_created: analysis.tasks?.length || 0
    });
  }

  // ---- Resumo final ----
  console.log('');
  console.log('='.repeat(60));
  console.log(`  ✅ Agente finalizado`);
  console.log(`     📋 ${totalTasksCreated} tarefa(s) criada(s)`);
  console.log(`     📄 ${totalDocsCreated} documento(s) salvo(s)`);
  console.log(`     📅 ${meetEvents.length} reunião(ões) processada(s)`);
  console.log('='.repeat(60));
  console.log('');
}

// ============================================================================
// Modos de execução
// ============================================================================

const args = process.argv.slice(2);

if (args.includes('--watch')) {
  // Modo watch: loop contínuo
  const intervalMs = config.agent.checkIntervalMinutes * 60 * 1000;
  console.log(`🔄 Modo watch ativado — verificando a cada ${config.agent.checkIntervalMinutes} minutos`);

  // Executar imediatamente e depois em intervalo
  run().catch(err => console.error('❌ Erro na execução:', err.message));

  setInterval(() => {
    run().catch(err => console.error('❌ Erro na execução:', err.message));
  }, intervalMs);

} else {
  // Modo single-run
  run()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ Erro fatal:', err);
      process.exit(1);
    });
}
