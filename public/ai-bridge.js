// ============================================================================
// AI BRIDGE — Web REST API version
// ============================================================================

class AIBridge {
  static async _post(endpoint, body) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await response.json();
    } catch (error) {
      console.error(`Erro na chamada ${endpoint}:`, error);
      return { success: false, error: error.message };
    }
  }

  static async parseNaturalLanguage(text, peopleList, projectsList, existingTaskDescriptions = []) {
    const result = await this._post('/api/ai/parse-natural-language', { text, peopleList, projectsList, existingTaskDescriptions });
    return result.success ? result.tasks : null;
  }

  static async analyzeDocument(content, documentName) {
    const result = await this._post('/api/ai/analyze-document', { content, documentName });
    return result.success ? result.analysis : null;
  }

  static async suggestPriorities(tasks) {
    const result = await this._post('/api/ai/suggest-priorities', { tasks });
    return result.success ? result.recommendations : null;
  }

  static async generateDailySummary(todayTasks, overdueTasks, completedTasks) {
    const result = await this._post('/api/ai/generate-summary', { todayTasks, overdueTasks, completedTasks });
    return result.success ? result.summary : null;
  }

  static async extractTasks(text) {
    const result = await this._post('/api/ai/extract-tasks', { text });
    return result.success ? result.tasks : null;
  }

  static async improveDescription(description) {
    const result = await this._post('/api/ai/improve-description', { description });
    return result.success ? result.improved : description;
  }

  static async analyzeImage(imageBase64, mimeType, peopleList, projectsList) {
    const result = await this._post('/api/ai/analyze-image', { imageBase64, mimeType, peopleList, projectsList });
    return result.success ? result.result : null;
  }

  static async captureScreen() {
    return null;
  }

  static isAvailable() {
    return true;
  }
}

// ============================================================================
// NOTIFICATION BRIDGE — Web version (browser Notification API)
// ============================================================================

class NotificationBridge {
  static async showNotification(title, body) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }

  static async updateSettings(settings) {}
  static async getSettings() { return null; }
  static setupMainProcessListener() {}
  static isAvailable() { return false; }
}

// ============================================================================
// SHEETS BRIDGE — Google Sheets via REST API (leitura e escrita)
// ============================================================================

class SheetsBridge {
  static async checkConfig() {
    try {
      const response = await fetch('/api/sheets/check-config');
      return await response.json();
    } catch (error) {
      return { configured: false };
    }
  }

  static async syncPull() {
    try {
      const response = await fetch('/api/sheets/sync-pull');
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async syncPush(projectsImpl, projectsOngoing) {
    try {
      const response = await fetch('/api/sheets/sync-push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectsImpl, projectsOngoing })
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async pushProject(projectType, project) {
    try {
      const response = await fetch('/api/sheets/push-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectType, project })
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static isAvailable() {
    return true;
  }
}

// ============================================================================
// FINANCIAL BRIDGE — Dados financeiros via REST API
// ============================================================================

class FinancialBridge {
  static async loadData() {
    try {
      const response = await fetch('/api/financial/load');
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static isAvailable() {
    return true;
  }
}

// ============================================================================
// ONE-ON-ONE BRIDGE — Analise de 1:1s via REST API
// ============================================================================

class OneOnOneBridge {
  static async analyze(transcript, teamMember, previousSessions) {
    const result = await AIBridge._post('/api/ai/analyze-oneone', { transcript, teamMember, previousSessions });
    return result.success ? result.analysis : null;
  }

  static isAvailable() {
    return true;
  }
}

// ============================================================================
// REPORT BRIDGE — Relatorios e previsoes via REST API
// ============================================================================

class ReportBridge {
  static async generateWeeklyReport(data) {
    const result = await AIBridge._post('/api/ai/weekly-report', data);
    return result.success ? result.report : null;
  }

  static async predictRisks(projects, teamPerformance) {
    const result = await AIBridge._post('/api/ai/predict-risks', { projects, teamPerformance });
    return result.success ? result.result : null;
  }

  static isAvailable() {
    return true;
  }
}

// Torna disponivel globalmente
if (typeof window !== 'undefined') {
  window.AIBridge = AIBridge;
  window.NotificationBridge = NotificationBridge;
  window.SheetsBridge = SheetsBridge;
  window.FinancialBridge = FinancialBridge;
  window.OneOnOneBridge = OneOnOneBridge;
  window.ReportBridge = ReportBridge;
}
