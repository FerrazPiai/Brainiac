// ============================================================================
// SERVER.JS - Segundo Cérebro — Web Server para VPS / EasyPanel
// ============================================================================

// Carregar .env se existir (override: true garante que .env tem prioridade sobre env vars vazias do sistema)
try { require('dotenv').config({ override: true }); } catch (e) { /* sem dotenv, usa env do sistema */ }

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// Tratamento de erros global — impede que o processo morra
// ============================================================================

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err.message);
    console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});

// Graceful shutdown (Docker envia SIGTERM ao parar container)
process.on('SIGTERM', () => {
    console.log('🔄 SIGTERM recebido, encerrando gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🔄 SIGINT recebido, encerrando...');
    process.exit(0);
});

// ============================================================================
// Middleware
// ============================================================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Log requests for debugging
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.url}`);
    next();
});

// Servir arquivos estáticos
// public/ primeiro (ai-bridge.js web tem prioridade sobre a versão Electron)
app.use(express.static(path.join(__dirname, 'public')));

// Fallback: servir arquivos frontend que ficam na raiz (dev local, fora do Docker)
// No Docker, esses arquivos já estão em public/ e são servidos pelo static acima
app.get('/renderer.js', (req, res) => {
  const pubPath = path.join(__dirname, 'public', 'renderer.js');
  const rootPath = path.join(__dirname, 'renderer.js');
  res.sendFile(pubPath, (err) => { if (err) res.sendFile(rootPath, (e) => { if (e) res.status(404).send('Not found'); }); });
});
app.get('/styles.css', (req, res) => {
  const pubPath = path.join(__dirname, 'public', 'styles.css');
  const rootPath = path.join(__dirname, 'styles.css');
  res.sendFile(pubPath, (err) => { if (err) res.sendFile(rootPath, (e) => { if (e) res.status(404).send('Not found'); }); });
});
app.get('/icon.png', (req, res) => {
  const pubPath = path.join(__dirname, 'public', 'icon.png');
  const rootPath = path.join(__dirname, 'icon.png');
  res.sendFile(pubPath, (err) => { if (err) res.sendFile(rootPath, (e) => { if (e) res.status(404).send('Not found'); }); });
});
// Novos módulos de renderer
['renderer-financeiro.js', 'renderer-oneones.js', 'renderer-equipe.js'].forEach(file => {
  app.get('/' + file, (req, res) => {
    const pubPath = path.join(__dirname, 'public', file);
    const rootPath = path.join(__dirname, file);
    res.sendFile(pubPath, (err) => { if (err) res.sendFile(rootPath, (e) => { if (e) res.status(404).send('Not found'); }); });
  });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
        if (err) res.status(200).send('Brainiac Server Running (Index Missing)');
    });
});

// ============================================================================
// Inicializar serviços (de forma segura — nunca crasha)
// ============================================================================

let aiService = null;
let sheetsService = null;

// AI Service
try {
    if (!process.env.ANTHROPIC_API_KEY) {
        console.warn('⚠ ANTHROPIC_API_KEY não definida — IA desabilitada');
    } else {
        const AIService = require('./ai-service');
        aiService = new AIService();
        console.log('✓ Serviço de IA inicializado');
    }
} catch (error) {
    console.error('⚠ Erro ao inicializar IA (servidor continua):', error.message);
    aiService = null;
}

// Google Sheets Service
try {
    const GoogleSheetsService = require('./google-sheets-service');
    sheetsService = new GoogleSheetsService();
    if (sheetsService.isConfigured()) {
        console.log('✓ Google Sheets configurado');
    } else {
        console.log('⚠ Google Sheets não configurado (faltam GOOGLE_SHEETS_ID / GOOGLE_API_KEY)');
    }
} catch (error) {
    console.error('⚠ Erro ao inicializar Google Sheets (servidor continua):', error.message);
    sheetsService = null;
}

// ============================================================================
// API ROUTES
// ============================================================================

// --- AI Endpoints ---

app.post('/api/ai/parse-natural-language', async (req, res) => {
    if (!aiService) return res.json({ success: false, error: 'Serviço de IA não disponível. Configure ANTHROPIC_API_KEY.' });
    try {
        const { text, peopleList, projectsList, existingTaskDescriptions } = req.body;
        const tasks = await aiService.parseNaturalLanguage(text, peopleList, projectsList, existingTaskDescriptions || []);
        res.json({ success: true, tasks });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/ai/analyze-document', async (req, res) => {
    if (!aiService) return res.json({ success: false, error: 'Serviço de IA não disponível' });
    try {
        const { content, documentName } = req.body;
        const analysis = await aiService.analyzeDocument(content, documentName);
        res.json({ success: true, analysis });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/ai/suggest-priorities', async (req, res) => {
    if (!aiService) return res.json({ success: false, error: 'Serviço de IA não disponível' });
    try {
        const { tasks } = req.body;
        const recommendations = await aiService.suggestPriorities(tasks);
        res.json({ success: true, recommendations });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/ai/generate-summary', async (req, res) => {
    if (!aiService) return res.json({ success: false, error: 'Serviço de IA não disponível' });
    try {
        const { todayTasks, overdueTasks, completedTasks } = req.body;
        const summary = await aiService.generateDailySummary(todayTasks, overdueTasks, completedTasks);
        res.json({ success: true, summary });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/ai/extract-tasks', async (req, res) => {
    if (!aiService) return res.json({ success: false, error: 'Serviço de IA não disponível' });
    try {
        const { text } = req.body;
        const result = await aiService.extractTasksFromText(text);
        res.json({ success: true, tasks: result ? result.tasks : [] });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/ai/improve-description', async (req, res) => {
    if (!aiService) return res.json({ success: false, error: 'Serviço de IA não disponível' });
    try {
        const { description } = req.body;
        const improved = await aiService.improveTaskDescription(description);
        res.json({ success: true, improved });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/ai/analyze-image', async (req, res) => {
    if (!aiService) return res.json({ success: false, error: 'Serviço de IA não disponível' });
    try {
        const { imageBase64, mimeType, peopleList, projectsList } = req.body;
        const result = await aiService.analyzeImage(imageBase64, mimeType, peopleList, projectsList);
        res.json({ success: true, result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// --- Google Sheets Endpoints ---

app.get('/api/sheets/check-config', async (req, res) => {
    if (!sheetsService) return res.json({ success: false, configured: false });
    res.json({ success: true, ...sheetsService.getStatus() });
});

app.get('/api/sheets/sync-pull', async (req, res) => {
    if (!sheetsService) return res.json({ success: false, error: 'Google Sheets não inicializado' });
    try {
        const result = await sheetsService.pullAll();
        res.json(result);
    } catch (error) {
        console.error('Erro no sheets-sync-pull:', error);
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/sheets/sync-push', async (req, res) => {
    if (!sheetsService) return res.json({ success: false, error: 'Google Sheets não inicializado' });
    if (!sheetsService.canWrite) return res.json({ success: false, error: 'Escrita requer Service Account' });
    try {
        const { projectsImpl, projectsOngoing } = req.body;
        const result = await sheetsService.pushAll(projectsImpl, projectsOngoing);
        res.json(result);
    } catch (error) {
        console.error('Erro no sheets-sync-push:', error);
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/sheets/push-project', async (req, res) => {
    if (!sheetsService) return res.json({ success: false, error: 'Google Sheets não inicializado' });
    if (!sheetsService.canWrite) return res.json({ success: false, error: 'Escrita requer Service Account' });
    try {
        const { projectType, project } = req.body;
        const result = await sheetsService.pushProject(projectType, project);
        res.json(result);
    } catch (error) {
        console.error('Erro no sheets-push-project:', error);
        res.json({ success: false, error: error.message });
    }
});

// --- Financial Data Endpoints ---

app.get('/api/financial/load', async (req, res) => {
    if (!sheetsService) return res.json({ success: false, error: 'Google Sheets não inicializado' });
    try {
        const result = await sheetsService.pullFinancial();
        res.json(result);
    } catch (error) {
        console.error('Erro no financial-load:', error);
        res.json({ success: false, error: error.message });
    }
});

// --- 1:1 AI Analysis Endpoint ---

app.post('/api/ai/analyze-oneone', async (req, res) => {
    if (!aiService) return res.json({ success: false, error: 'Serviço de IA não disponível' });
    try {
        const { transcript, teamMember, previousSessions } = req.body;
        const analysis = await aiService.analyzeOneOnOne(transcript, teamMember, previousSessions || []);
        res.json({ success: true, analysis });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// --- Weekly Report Endpoint ---

app.post('/api/ai/weekly-report', async (req, res) => {
    if (!aiService) return res.json({ success: false, error: 'Serviço de IA não disponível' });
    try {
        const report = await aiService.generateWeeklyReport(req.body);
        res.json({ success: true, report });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// --- Predictive Risks Endpoint ---

app.post('/api/ai/predict-risks', async (req, res) => {
    if (!aiService) return res.json({ success: false, error: 'Serviço de IA não disponível' });
    try {
        const { projects, teamPerformance } = req.body;
        const result = await aiService.predictProjectRisks(projects, teamPerformance);
        res.json({ success: true, result });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// --- Persistência Server-Side (dados ficam no servidor, não só no localStorage) ---

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

// Garantir que o diretório data/ existe
try { if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true }); } catch (e) { console.error('⚠ Erro ao criar diretório data/:', e.message); }

app.get('/api/data/load', (req, res) => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            const data = JSON.parse(raw);
            console.log('📂 Dados carregados do servidor');
            res.json({ success: true, data });
        } else {
            res.json({ success: true, data: null });
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error.message);
        res.json({ success: false, error: error.message });
    }
});

app.post('/api/data/save', (req, res) => {
    try {
        const data = req.body;
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        console.log('💾 Dados salvos no servidor');
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Erro ao salvar dados:', error.message);
        res.json({ success: false, error: error.message });
    }
});

// --- Health Check (original) ---

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: '2.0.0',
        ai: !!aiService,
        sheets: sheetsService ? sheetsService.isConfigured() : false,
        uptime: process.uptime()
    });
});

// ============================================================================
// API BRIDGE — Endpoints para integração com agentes externos (Meet Agent)
// ============================================================================

const { createApiRouter } = require('./api-server');

// Storage adapter para modo Web: usa store.json no servidor
const webStorageAdapter = {
    get: (key) => {
        try {
            if (fs.existsSync(DATA_FILE)) {
                const raw = fs.readFileSync(DATA_FILE, 'utf8');
                const data = JSON.parse(raw);
                return data[key] !== undefined ? data[key] : null;
            }
            return null;
        } catch (e) {
            console.error(`❌ API Bridge: Erro ao ler '${key}':`, e.message);
            return null;
        }
    },
    set: (key, value) => {
        try {
            let data = {};
            if (fs.existsSync(DATA_FILE)) {
                const raw = fs.readFileSync(DATA_FILE, 'utf8');
                data = JSON.parse(raw);
            }
            data[key] = value;
            fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
        } catch (e) {
            console.error(`❌ API Bridge: Erro ao gravar '${key}':`, e.message);
        }
    },
    notify: null // Sem UI no modo web server
};

const apiBridgeRouter = createApiRouter(webStorageAdapter);
app.use('/api', apiBridgeRouter);

// Fallback: qualquer rota não-API retorna index.html (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================================================
// START SERVER
// ============================================================================

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('  🧠 Segundo Cérebro — Web Server v2.0');
    console.log('='.repeat(60));
    console.log(`  🌐 Porta:   ${PORT}`);
    console.log(`  🤖 IA:      ${aiService ? '✓ Disponível' : '✗ Indisponível'}`);
    console.log(`  📊 Sheets:  ${sheetsService?.isConfigured() ? '✓ Configurado' : '✗ Não configurado'}`);
    console.log(`  🏭 Env:     ${process.env.NODE_ENV || 'development'}`);
    console.log('='.repeat(60));
    console.log('');
});

server.on('error', (err) => {
    console.error('❌ Erro ao iniciar servidor:', err.message);
    if (err.code === 'EADDRINUSE') {
        console.error(`   Porta ${PORT} já está em uso!`);
    }
});
