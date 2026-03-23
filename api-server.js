// ============================================================================
// API-SERVER.JS — API Bridge para integração com agentes externos
// ============================================================================
// Endpoints REST para criação de tarefas e documentos via agentes de IA.
// Pode ser usado tanto no modo Electron (main.js) quanto Web (server.js).
// ============================================================================

const express = require('express');

// Mapeamento de prioridades PT→EN (o Brainiac armazena em inglês internamente)
const PRIORITY_MAP = { 'alta': 'high', 'média': 'medium', 'normal': 'normal' };
const VALID_PRIORITIES = Object.keys(PRIORITY_MAP);

/**
 * Cria um router Express com os endpoints da API Bridge.
 *
 * @param {object} storageAdapter - Adaptador de acesso aos dados
 * @param {function} storageAdapter.get - (key) => Promise<any> — lê dados do storage
 * @param {function} storageAdapter.set - (key, value) => Promise<void> — grava dados no storage
 * @param {function} [storageAdapter.notify] - (event, data) => void — notifica a UI (opcional)
 * @returns {express.Router}
 */
function createApiRouter(storageAdapter) {
  const router = express.Router();
  const { get, set, notify } = storageAdapter;

  // ---- Middleware de autenticação por API Key ----
  router.use((req, res, next) => {
    // Health check não exige autenticação
    if (req.path === '/health') return next();

    const apiKey = process.env.BRAINIAC_API_KEY;
    if (!apiKey) {
      console.warn('⚠ BRAINIAC_API_KEY não configurada — API Bridge bloqueada por segurança');
      return res.status(503).json({ error: 'API Bridge indisponível — BRAINIAC_API_KEY não configurada' });
    }

    const provided = req.headers['x-api-key'];
    if (!provided || provided !== apiKey) {
      return res.status(401).json({ error: 'API Key inválida ou ausente. Envie o header X-API-Key.' });
    }
    next();
  });

  // ================================================================
  // GET /api/health
  // ================================================================
  router.get('/health', async (req, res) => {
    try {
      const people = await get('checklist-people') || [];
      const projects = (await get('brain-projects') || []).map(p => typeof p === 'string' ? p : p.name);

      res.json({
        status: 'ok',
        version: '1.0.0',
        people,
        projects
      });
    } catch (error) {
      console.error('❌ Erro no /api/health:', error.message);
      res.status(500).json({ status: 'error', error: error.message });
    }
  });

  // ================================================================
  // POST /api/tasks — Criar tarefas em lote
  // ================================================================
  router.post('/tasks', async (req, res) => {
    try {
      const { source, meeting_id, meeting_title, meeting_date, tasks: incomingTasks } = req.body;

      if (!incomingTasks || !Array.isArray(incomingTasks) || incomingTasks.length === 0) {
        return res.status(400).json({ error: 'O campo "tasks" é obrigatório e deve ser um array não vazio.' });
      }

      // Carregar dados atuais do Brainiac
      const people = (await get('checklist-people') || []).map(p => p.toLowerCase());
      const peopleOriginal = await get('checklist-people') || [];
      const projects = await get('brain-projects') || [];
      const projectNames = projects.map(p => (typeof p === 'string' ? p : p.name).toLowerCase());
      const projectNamesOriginal = projects.map(p => typeof p === 'string' ? p : p.name);
      const existingTasks = await get('checklist-tasks') || [];

      const details = [];
      const newTasks = [];

      for (const item of incomingTasks) {
        // Validação: description obrigatória
        if (!item.description || typeof item.description !== 'string' || !item.description.trim()) {
          details.push({ description: item.description || '', status: 'skipped', reason: 'Descrição vazia ou ausente' });
          continue;
        }

        // Validação: person deve existir
        if (!item.person || typeof item.person !== 'string') {
          details.push({ description: item.description, status: 'skipped', reason: 'Pessoa não especificada' });
          continue;
        }
        const personIdx = people.indexOf(item.person.toLowerCase());
        if (personIdx === -1) {
          details.push({ description: item.description, status: 'skipped', reason: `Pessoa '${item.person}' não encontrada` });
          continue;
        }
        const personName = peopleOriginal[personIdx];

        // Validação: date deve ser válida (YYYY-MM-DD)
        if (!item.date || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || isNaN(Date.parse(item.date))) {
          details.push({ description: item.description, status: 'skipped', reason: `Data inválida: '${item.date}'` });
          continue;
        }

        // Validação: priority
        const rawPriority = (item.priority || 'normal').toLowerCase();
        if (!VALID_PRIORITIES.includes(rawPriority)) {
          details.push({ description: item.description, status: 'skipped', reason: `Prioridade inválida: '${item.priority}'. Use: alta, média, normal` });
          continue;
        }
        const priority = PRIORITY_MAP[rawPriority];

        // Validação: project (opcional, mas se fornecido deve existir)
        let projectName = null;
        if (item.project) {
          const projIdx = projectNames.indexOf(item.project.toLowerCase());
          if (projIdx === -1) {
            details.push({ description: item.description, status: 'skipped', reason: `Projeto '${item.project}' não encontrado` });
            continue;
          }
          projectName = projectNamesOriginal[projIdx];
        }

        // Criar a tarefa no formato do Brainiac
        const taskId = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const task = {
          id: taskId,
          description: item.description.trim(),
          person: personName,
          people: [personName],
          date: item.date,
          priority: priority,
          project: projectName,
          projects: projectName ? [projectName] : [],
          tags: Array.isArray(item.tags) ? item.tags : [],
          completed: false,
          createdAt: new Date().toISOString(),
          source: source || 'meet-agent',
          meetingId: meeting_id || null,
          meetingTitle: meeting_title || null,
          meetingDate: meeting_date || null,
          context: item.context || null,
          order: existingTasks.length + newTasks.length
        };

        newTasks.push(task);
        details.push({ description: item.description, status: 'created', id: taskId });
      }

      // Salvar tarefas no storage
      if (newTasks.length > 0) {
        const allTasks = [...existingTasks, ...newTasks];
        await set('checklist-tasks', allTasks);
        console.log(`✓ API Bridge: ${newTasks.length} tarefa(s) criada(s) via ${source || 'api'} [meeting: ${meeting_id || 'n/a'}]`);

        // Notificar a UI
        if (notify) {
          notify('tasks-updated', {
            count: newTasks.length,
            source: source || 'meet-agent',
            meetingTitle: meeting_title || null
          });
        }
      }

      const created = details.filter(d => d.status === 'created').length;
      const skipped = details.filter(d => d.status === 'skipped').length;

      res.json({
        status: skipped > 0 ? (created > 0 ? 'partial' : 'error') : 'ok',
        tasks_created: created,
        tasks_skipped: skipped,
        details
      });

    } catch (error) {
      console.error('❌ Erro no POST /api/tasks:', error);
      res.status(500).json({ error: 'Erro interno ao processar tarefas', details: error.message });
    }
  });

  // ================================================================
  // POST /api/documents — Salvar transcrição como documento
  // ================================================================
  router.post('/documents', async (req, res) => {
    try {
      const { name, content, project, tags, source, meeting_id } = req.body;

      if (!name || !content) {
        return res.status(400).json({ error: 'Os campos "name" e "content" são obrigatórios.' });
      }

      // Validar projeto se fornecido
      let projectName = null;
      if (project) {
        const projects = await get('brain-projects') || [];
        const projectNames = projects.map(p => (typeof p === 'string' ? p : p.name).toLowerCase());
        const projectNamesOriginal = projects.map(p => typeof p === 'string' ? p : p.name);
        const projIdx = projectNames.indexOf(project.toLowerCase());
        if (projIdx !== -1) {
          projectName = projectNamesOriginal[projIdx];
        }
        // Se não encontrar, salva sem projeto (não bloqueia)
      }

      const docId = 'doc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const document = {
        id: docId,
        name: name.trim(),
        content: content,
        project: projectName,
        tags: Array.isArray(tags) ? tags : [],
        source: source || 'meet-agent',
        meetingId: meeting_id || null,
        createdAt: new Date().toISOString()
      };

      const existingDocs = await get('brain-documents') || [];
      existingDocs.push(document);
      await set('brain-documents', existingDocs);

      console.log(`✓ API Bridge: Documento '${name}' salvo [meeting: ${meeting_id || 'n/a'}]`);

      // Notificar a UI
      if (notify) {
        notify('documents-updated', { name: name, id: docId, source: source || 'meet-agent' });
      }

      res.json({ status: 'ok', id: docId, name: name });

    } catch (error) {
      console.error('❌ Erro no POST /api/documents:', error);
      res.status(500).json({ error: 'Erro interno ao salvar documento', details: error.message });
    }
  });

  // ================================================================
  // POST /api/oneones — Salvar sessão 1:1 via agente externo
  // ================================================================
  router.post('/oneones', async (req, res) => {
    try {
      const { teamMember, date, transcript, summary, actionItems, sentiment,
              developmentAreas, keyTopics, source, meeting_id, meeting_title } = req.body;

      if (!teamMember || !transcript) {
        return res.status(400).json({ error: 'Os campos "teamMember" e "transcript" são obrigatórios.' });
      }

      const sessionId = 'oneone_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      const session = {
        id: sessionId,
        teamMember: teamMember.trim(),
        date: date || new Date().toISOString().split('T')[0],
        transcript: transcript,
        summary: summary || '',
        actionItems: Array.isArray(actionItems) ? actionItems.map(a => ({
          text: a.text || a,
          done: false,
          dueDate: a.dueDate || null,
          owner: a.owner || teamMember
        })) : [],
        sentiment: sentiment || 'neutral',
        sentimentDetails: '',
        developmentAreas: Array.isArray(developmentAreas) ? developmentAreas : [],
        keyTopics: Array.isArray(keyTopics) ? keyTopics : [],
        source: source || 'meet-agent',
        meetingId: meeting_id || null,
        meetingTitle: meeting_title || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const existingSessions = await get('brain-oneone-sessions') || [];
      existingSessions.push(session);
      await set('brain-oneone-sessions', existingSessions);

      console.log(`✓ API Bridge: 1:1 com '${teamMember}' salvo [meeting: ${meeting_id || 'n/a'}]`);

      if (notify) {
        notify('oneones-updated', {
          teamMember,
          id: sessionId,
          source: source || 'meet-agent'
        });
      }

      res.json({ status: 'ok', id: sessionId, teamMember });

    } catch (error) {
      console.error('❌ Erro no POST /api/oneones:', error);
      res.status(500).json({ error: 'Erro interno ao salvar 1:1', details: error.message });
    }
  });

  return router;
}

module.exports = { createApiRouter, PRIORITY_MAP, VALID_PRIORITIES };
