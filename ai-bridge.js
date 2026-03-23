// ============================================================================
// AI BRIDGE - Interface entre Renderer e AI Service
// ============================================================================

// Verifica se estamos no ambiente Electron
const hasIPC = typeof require !== 'undefined';
let ipcRenderer;

if (hasIPC) {
  try {
    const electron = require('electron');
    ipcRenderer = electron.ipcRenderer;
  } catch (e) {
    console.warn('IPC não disponível');
  }
}

class AIBridge {
  /**
   * Processa texto em linguagem natural usando IA
   */
  static async parseNaturalLanguage(text, peopleList, projectsList, existingTaskDescriptions = []) {
    if (!ipcRenderer) {
      console.warn('IA não disponível (IPC não encontrado)');
      return null;
    }

    try {
      const result = await ipcRenderer.invoke('ai-parse-natural-language', text, peopleList, projectsList, existingTaskDescriptions);
      return result.success ? result.tasks : null;
    } catch (error) {
      console.error('Erro ao processar com IA:', error);
      return null;
    }
  }

  /**
   * Analisa um documento usando IA
   */
  static async analyzeDocument(content, documentName) {
    if (!ipcRenderer) {
      return null;
    }

    try {
      const result = await ipcRenderer.invoke('ai-analyze-document', content, documentName);
      return result.success ? result.analysis : null;
    } catch (error) {
      console.error('Erro ao analisar documento:', error);
      return null;
    }
  }

  /**
   * Sugere prioridades para tarefas
   */
  static async suggestPriorities(tasks) {
    if (!ipcRenderer) {
      return null;
    }

    try {
      const result = await ipcRenderer.invoke('ai-suggest-priorities', tasks);
      return result.success ? result.recommendations : null;
    } catch (error) {
      console.error('Erro ao sugerir prioridades:', error);
      return null;
    }
  }

  /**
   * Gera resumo diário
   */
  static async generateDailySummary(todayTasks, overdueTasks, completedTasks) {
    if (!ipcRenderer) {
      return null;
    }

    try {
      const result = await ipcRenderer.invoke('ai-generate-summary', todayTasks, overdueTasks, completedTasks);
      return result.success ? result.summary : null;
    } catch (error) {
      console.error('Erro ao gerar resumo:', error);
      return null;
    }
  }

  /**
   * Extrai tarefas de texto livre
   */
  static async extractTasks(text) {
    if (!ipcRenderer) {
      return null;
    }

    try {
      const result = await ipcRenderer.invoke('ai-extract-tasks', text);
      return result.success ? result.tasks : null;
    } catch (error) {
      console.error('Erro ao extrair tarefas:', error);
      return null;
    }
  }

  /**
   * Melhora descrição de tarefa
   */
  static async improveDescription(description) {
    if (!ipcRenderer) {
      return description;
    }

    try {
      const result = await ipcRenderer.invoke('ai-improve-description', description);
      return result.success ? result.improved : description;
    } catch (error) {
      console.error('Erro ao melhorar descrição:', error);
      return description;
    }
  }

  /**
   * Analisa uma imagem e extrai tarefas via Claude Vision API
   */
  static async analyzeImage(imageBase64, mimeType, peopleList, projectsList) {
    if (!ipcRenderer) {
      console.warn('IA não disponível (IPC não encontrado)');
      return null;
    }
    try {
      const result = await ipcRenderer.invoke('ai-analyze-image', imageBase64, mimeType, peopleList, projectsList);
      return result.success ? result.result : null;
    } catch (error) {
      console.error('Erro ao analisar imagem:', error);
      return null;
    }
  }

  /**
   * Captura screenshot da tela
   */
  static async captureScreen() {
    if (!ipcRenderer) return null;
    try {
      const result = await ipcRenderer.invoke('capture-screen');
      return result.success ? result.image : null;
    } catch (error) {
      console.error('Erro ao capturar tela:', error);
      return null;
    }
  }

  /**
   * Verifica se a IA está disponível
   */
  static isAvailable() {
    return !!ipcRenderer;
  }
}

// ============================================================================
// NOTIFICATION BRIDGE - Notificações nativas via Electron
// ============================================================================

class NotificationBridge {
  static async showNotification(title, body) {
    if (!ipcRenderer) {
      // Fallback para Notification API do browser
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
      return;
    }
    try {
      await ipcRenderer.invoke('show-notification', title, body);
    } catch (error) {
      console.error('Erro ao mostrar notificação:', error);
    }
  }

  static async updateSettings(settings) {
    if (!ipcRenderer) return;
    try {
      await ipcRenderer.invoke('update-notification-settings', settings);
    } catch (error) {
      console.error('Erro ao atualizar config de notificações:', error);
    }
  }

  static async getSettings() {
    if (!ipcRenderer) return null;
    try {
      const result = await ipcRenderer.invoke('get-notification-settings');
      return result.success ? result.settings : null;
    } catch (error) {
      console.error('Erro ao obter config de notificações:', error);
      return null;
    }
  }

  static setupMainProcessListener() {
    if (!ipcRenderer) return;
    ipcRenderer.on('request-followup-check', () => {
      if (window._uiManager) {
        window._uiManager.checkDueTasks();
      }
    });

    // API Bridge: tarefas criadas por agente externo
    ipcRenderer.on('tasks-updated', (event, data) => {
      if (window._uiManager) {
        // Recarregar tarefas do localStorage
        window._uiManager.store.tasks = Storage.get('checklist-tasks', []).map(t => ({
          ...t,
          people: t.people || (t.person ? [t.person] : []),
          projects: t.projects || (t.project ? [t.project] : []),
          order: t.order ?? t.id
        }));
        window._uiManager.render();
        const msg = data && data.count
          ? `${data.count} tarefa(s) criada(s) automaticamente via ${data.source || 'Meet Agent'}${data.meetingTitle ? ' — ' + data.meetingTitle : ''}`
          : 'Tarefas atualizadas via agente externo';
        window._uiManager.showToast(msg, 'success');
      }
    });

    // API Bridge: documento salvo por agente externo
    ipcRenderer.on('documents-updated', (event, data) => {
      if (window._uiManager) {
        window._uiManager.store.documents = Storage.get('brain-documents', []);
        window._uiManager.render();
        const msg = data && data.name
          ? `Documento "${data.name}" salvo via ${data.source || 'Meet Agent'}`
          : 'Documento salvo via agente externo';
        window._uiManager.showToast(msg, 'info');
      }
    });
  }

  static isAvailable() {
    return !!ipcRenderer;
  }
}

// ============================================================================
// SHEETS BRIDGE - Google Sheets (leitura e escrita) via Electron
// ============================================================================

class SheetsBridge {
  static async checkConfig() {
    if (!ipcRenderer) return { configured: false };
    try {
      return await ipcRenderer.invoke('sheets-check-config');
    } catch (error) {
      console.error('Erro ao verificar config Sheets:', error);
      return { configured: false };
    }
  }

  static async syncPull() {
    if (!ipcRenderer) return { success: false, error: 'IPC não disponível' };
    try {
      return await ipcRenderer.invoke('sheets-sync-pull');
    } catch (error) {
      console.error('Erro ao puxar dados do Sheets:', error);
      return { success: false, error: error.message };
    }
  }

  static async syncPush(projectsImpl, projectsOngoing) {
    if (!ipcRenderer) return { success: false, error: 'IPC não disponível' };
    try {
      return await ipcRenderer.invoke('sheets-sync-push', projectsImpl, projectsOngoing);
    } catch (error) {
      console.error('Erro ao enviar dados para Sheets:', error);
      return { success: false, error: error.message };
    }
  }

  static async pushProject(projectType, project) {
    if (!ipcRenderer) return { success: false, error: 'IPC não disponível' };
    try {
      return await ipcRenderer.invoke('sheets-push-project', projectType, project);
    } catch (error) {
      console.error('Erro ao enviar projeto para Sheets:', error);
      return { success: false, error: error.message };
    }
  }

  static isAvailable() {
    return !!ipcRenderer;
  }
}

// ============================================================================
// FINANCIAL BRIDGE - Dados financeiros via Electron
// ============================================================================

class FinancialBridge {
  static async loadData() {
    if (!ipcRenderer) return { success: false, error: 'IPC não disponível' };
    try {
      return await ipcRenderer.invoke('sheets-financial-pull');
    } catch (error) {
      console.error('Erro ao carregar dados financeiros:', error);
      return { success: false, error: error.message };
    }
  }

  static isAvailable() {
    return !!ipcRenderer;
  }
}

// ============================================================================
// ONE-ON-ONE BRIDGE - Análise de 1:1s via Electron
// ============================================================================

class OneOnOneBridge {
  static async analyze(transcript, teamMember, previousSessions) {
    if (!ipcRenderer) return null;
    try {
      const result = await ipcRenderer.invoke('ai-analyze-oneone', transcript, teamMember, previousSessions);
      return result.success ? result.analysis : null;
    } catch (error) {
      console.error('Erro ao analisar 1:1:', error);
      return null;
    }
  }

  static isAvailable() {
    return !!ipcRenderer;
  }
}

// ============================================================================
// REPORT BRIDGE - Relatórios e previsões via Electron
// ============================================================================

class ReportBridge {
  static async generateWeeklyReport(data) {
    if (!ipcRenderer) return null;
    try {
      const result = await ipcRenderer.invoke('ai-weekly-report', data);
      return result.success ? result.report : null;
    } catch (error) {
      console.error('Erro ao gerar relatório semanal:', error);
      return null;
    }
  }

  static async predictRisks(projects, teamPerformance) {
    if (!ipcRenderer) return null;
    try {
      const result = await ipcRenderer.invoke('ai-predict-risks', projects, teamPerformance);
      return result.success ? result.result : null;
    } catch (error) {
      console.error('Erro ao prever riscos:', error);
      return null;
    }
  }

  static isAvailable() {
    return !!ipcRenderer;
  }
}

// Listener para 1:1s criados por agente externo
if (ipcRenderer) {
  ipcRenderer.on('oneones-updated', (event, data) => {
    if (window._uiManager) {
      window._uiManager.store.oneOneSessions = Storage.get('brain-oneone-sessions', []);
      window._uiManager.render();
      const msg = data && data.teamMember
        ? `1:1 com ${data.teamMember} salvo via ${data.source || 'Meet Agent'}`
        : '1:1 salvo via agente externo';
      window._uiManager.showToast(msg, 'info');
    }
  });
}

// Torna disponível globalmente se possível
if (typeof window !== 'undefined') {
  window.AIBridge = AIBridge;
  window.NotificationBridge = NotificationBridge;
  window.SheetsBridge = SheetsBridge;
  window.FinancialBridge = FinancialBridge;
  window.OneOnOneBridge = OneOnOneBridge;
  window.ReportBridge = ReportBridge;
}
