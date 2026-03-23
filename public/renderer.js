// ============================================================================
// SEGUNDO CÉREBRO - DESKTOP APP (Browser Compatible Version)
// Sistema de Gerenciamento de Tarefas com Memória de Contexto
// ============================================================================

// Check if we have electron APIs
const hasElectron = typeof window.electronAPI !== 'undefined';

// ============================================================================
// STORAGE SYSTEM
// ============================================================================

class Storage {
  static _serverData = null;      // Cache dos dados carregados do servidor
  static _serverLoaded = false;   // Flag: já tentou carregar do servidor?
  static _saveTimer = null;       // Debounce para salvar no servidor

  static get(key, defaultValue = null) {
    try {
      // Se temos dados do servidor, usa eles como fonte principal
      if (Storage._serverData && key in Storage._serverData) {
        return Storage._serverData[key];
      }
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key}:`, error);
      return defaultValue;
    }
  }

  static set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      // IMPORTANTE: Atualizar cache do servidor para evitar retornar dados stale
      if (Storage._serverData) {
        Storage._serverData[key] = value;
      }
      // Agendar sync com servidor (debounce de 2s para não sobrecarregar)
      Storage._scheduleServerSave();
    } catch (error) {
      console.error(`Error saving ${key}:`, error);
    }
  }

  static clear() {
    localStorage.clear();
  }

  // Carrega dados do servidor (chamado 1x ao iniciar)
  static async loadFromServer() {
    try {
      const res = await fetch('/api/data/load');
      const result = await res.json();
      if (result.success && result.data) {
        Storage._serverData = result.data;
        // Também salva no localStorage como cache local
        Object.keys(result.data).forEach(key => {
          localStorage.setItem(key, JSON.stringify(result.data[key]));
        });
        console.log('✓ Dados carregados do servidor');
        return true;
      }
      console.log('ℹ Sem dados no servidor (primeiro uso)');
      return false;
    } catch (e) {
      console.warn('⚠ Servidor indisponível, usando localStorage:', e.message);
      return false;
    }
  }

  // Salva todos os dados no servidor (debounced)
  static _scheduleServerSave() {
    if (Storage._saveTimer) clearTimeout(Storage._saveTimer);
    Storage._saveTimer = setTimeout(() => Storage._saveToServer(), 2000);
  }

  static async _saveToServer() {
    try {
      // Coleta todas as chaves conhecidas do localStorage
      const keys = [
        'checklist-tasks', 'checklist-people', 'brain-documents', 'brain-projects',
        'checklist-sprints', 'checklist-current-sprint', 'brain-quick-notes',
        'torre-projects-impl', 'torre-projects-ongoing',
        'torre-nps-data', 'torre-sync-meta',
        'financial-pnl', 'financial-impl-revenue', 'financial-ongoing-revenue',
        'brain-oneone-sessions',
        'dismissed-duplicates', 'duplicate-merge-log'
      ];
      const data = {};
      keys.forEach(key => {
        const val = localStorage.getItem(key);
        if (val) data[key] = JSON.parse(val);
      });

      await fetch('/api/data/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (e) {
      console.warn('⚠ Erro ao salvar no servidor:', e.message);
    }
  }
}

// ============================================================================
// DATA MODELS
// ============================================================================

class DataStore {
  constructor() {
    this.tasks = Storage.get('checklist-tasks', []).map(t => ({
      ...t,
      people: t.people || (t.person ? [t.person] : []),
      projects: t.projects || (t.project ? [t.project] : []),
      notes: t.notes || '',
      subtasks: t.subtasks || [],
      order: t.order ?? t.id
    }));
    this.people = Storage.get('checklist-people', ['Walter', 'Pedro', 'Paulo']);
    this.documents = Storage.get('brain-documents', []);
    this.projects = Storage.get('brain-projects', [
      { id: 'monnaie', name: 'Monnaie', status: 'active', createdAt: new Date().toISOString() },
      { id: 'hs-golden', name: 'HS Golden', status: 'active', createdAt: new Date().toISOString() },
      { id: 'marthan', name: 'Marthan', status: 'active', createdAt: new Date().toISOString() },
      { id: 'multimax', name: 'Multimax', status: 'active', createdAt: new Date().toISOString() },
      { id: 'big-credit', name: 'Big Credit', status: 'implementation', createdAt: new Date().toISOString() },
      { id: 'ozox', name: 'Ozox', status: 'implementation', createdAt: new Date().toISOString() },
    ]);

    // Sprint System
    this.sprints = Storage.get('checklist-sprints', []);
    this.currentSprintId = Storage.get('checklist-current-sprint', null);

    // Quick Notes (Brain Dump)
    this.quickNotes = Storage.get('brain-quick-notes', []);

    // Torre de Comando - Projetos
    this.projectsImpl = Storage.get('torre-projects-impl', []);
    this.projectsOngoing = Storage.get('torre-projects-ongoing', []);
    this.npsData = Storage.get('torre-nps-data', []);
    this.syncMeta = Storage.get('torre-sync-meta', { lastPull: null, lastPush: null });

    // Financeiro
    this.financialPnL = Storage.get('financial-pnl', []);
    this.financialImplRevenue = Storage.get('financial-impl-revenue', []);
    this.financialOngoingRevenue = Storage.get('financial-ongoing-revenue', []);

    // 1:1 Sessions
    this.oneOneSessions = Storage.get('brain-oneone-sessions', []);
  }

  saveSprints() {
    Storage.set('checklist-sprints', this.sprints);
    Storage.set('checklist-current-sprint', this.currentSprintId);
  }

  createSprint(sprint) {
    this.sprints.push(sprint);
    this.saveSprints();
  }

  getActiveSprint() {
    return this.sprints.find(s => s.status === 'active') || null;
  }

  getSprintById(id) {
    return this.sprints.find(s => s.id === id) || null;
  }

  assignTaskToSprint(taskId, sprintId) {
    const sprint = this.getSprintById(sprintId);
    if (sprint && !sprint.taskIds.includes(taskId)) {
      sprint.taskIds.push(taskId);
      this.saveSprints();
    }
  }

  removeTaskFromSprint(taskId, sprintId) {
    const sprint = this.getSprintById(sprintId);
    if (sprint) {
      sprint.taskIds = sprint.taskIds.filter(id => id !== taskId);
      this.saveSprints();
    }
  }

  getSprintTasks(sprintId) {
    const sprint = this.getSprintById(sprintId);
    if (!sprint) return [];
    return this.tasks.filter(t => sprint.taskIds.includes(t.id));
  }

  getSprintProgress(sprintId) {
    const tasks = this.getSprintTasks(sprintId);
    if (tasks.length === 0) return { total: 0, completed: 0, percentage: 0 };
    const completed = tasks.filter(t => t.completed).length;
    return {
      total: tasks.length,
      completed,
      percentage: Math.round((completed / tasks.length) * 100)
    };
  }

  saveTasks() {
    Storage.set('checklist-tasks', this.tasks);
  }

  savePeople() {
    Storage.set('checklist-people', this.people);
  }

  saveDocuments() {
    Storage.set('brain-documents', this.documents);
  }

  saveProjects() {
    Storage.set('brain-projects', this.projects);
  }

  saveQuickNotes() {
    Storage.set('brain-quick-notes', this.quickNotes);
  }

  saveProjectsImpl() {
    Storage.set('torre-projects-impl', this.projectsImpl);
  }

  saveProjectsOngoing() {
    Storage.set('torre-projects-ongoing', this.projectsOngoing);
  }

  saveNpsData() {
    Storage.set('torre-nps-data', this.npsData);
  }

  saveSyncMeta() {
    Storage.set('torre-sync-meta', this.syncMeta);
  }

  saveFinancialPnL() {
    Storage.set('financial-pnl', this.financialPnL);
  }

  saveFinancialImplRevenue() {
    Storage.set('financial-impl-revenue', this.financialImplRevenue);
  }

  saveFinancialOngoingRevenue() {
    Storage.set('financial-ongoing-revenue', this.financialOngoingRevenue);
  }

  saveOneOneSessions() {
    Storage.set('brain-oneone-sessions', this.oneOneSessions);
  }
}

// ============================================================================
// COMMAND PARSER
// ============================================================================

class CommandParser {
  static parseDate(dateStr) {
    const today = new Date();
    const normalized = dateStr.toLowerCase().trim();

    if (normalized === 'hoje' || normalized === 'today') {
      return today.toISOString().split('T')[0];
    }

    if (normalized === 'amanhã' || normalized === 'amanha' || normalized === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    }

    const dateMatch = dateStr.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const month = dateMatch[2].padStart(2, '0');
      let year = dateMatch[3];

      if (!year) {
        year = today.getFullYear();
      } else if (year.length === 2) {
        year = '20' + year;
      }

      return `${year}-${month}-${day}`;
    }

    return today.toISOString().split('T')[0];
  }

  static extractPriority(text) {
    const priorityMatch = text.match(/\[(alta|high|média|media|medium|normal|baixa|low)\]/i);
    if (priorityMatch) {
      const priority = priorityMatch[1].toLowerCase();
      const cleanText = text.replace(priorityMatch[0], '').trim();

      if (priority === 'alta' || priority === 'high') return { priority: 'high', text: cleanText };
      if (priority === 'média' || priority === 'media' || priority === 'medium') return { priority: 'medium', text: cleanText };
      return { priority: 'normal', text: cleanText };
    }
    return { priority: 'normal', text };
  }

  static extractTags(text) {
    const tags = [];
    const tagRegex = /#(\w+)/g;
    let match;

    while ((match = tagRegex.exec(text)) !== null) {
      tags.push(match[1]);
    }

    const cleanText = text.replace(/#\w+/g, '').trim();
    return { tags, text: cleanText };
  }

  static extractProject(text, projectsList) {
    const projectMatch = text.match(/@(\w+)/);
    if (projectMatch) {
      const projectName = projectMatch[1];
      const cleanText = text.replace(projectMatch[0], '').trim();

      const project = projectsList.find(p =>
        p.name.toLowerCase().includes(projectName.toLowerCase()) ||
        p.id.toLowerCase().includes(projectName.toLowerCase())
      );

      return { project: project?.name, text: cleanText };
    }
    return { project: null, text };
  }

  static parse(text, peopleList, projectsList) {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const tasks = [];

    lines.forEach(line => {
      const parts = line.split('-', 2);
      if (parts.length < 2) return;

      let [personDatePart, descriptionPart] = parts;
      personDatePart = personDatePart.trim();
      descriptionPart = descriptionPart.trim();

      const tokens = personDatePart.split(/\s+/);
      if (tokens.length === 0) return;

      let person = tokens[0];
      let dateStr = tokens.length > 1 ? tokens.slice(1).join(' ') : 'hoje';

      const targetPeople = person.toLowerCase() === 'todos' || person.toLowerCase() === 'all'
        ? peopleList
        : [person];

      const date = this.parseDate(dateStr);

      let processed = this.extractPriority(descriptionPart);
      processed = { ...processed, ...this.extractProject(processed.text, projectsList) };
      processed = { ...processed, ...this.extractTags(processed.text) };

      targetPeople.forEach(targetPerson => {
        tasks.push({
          id: Date.now() + Math.random(),
          description: processed.text,
          person: targetPerson,
          date,
          priority: processed.priority,
          completed: false,
          createdAt: new Date().toISOString(),
          project: processed.project,
          tags: processed.tags.length > 0 ? processed.tags : undefined
        });
      });
    });

    return tasks;
  }

  static parseMarkdown(markdown, peopleList) {
    const tasks = [];
    const lines = markdown.split('\n');

    let currentPerson = null;
    let currentDate = null;

    lines.forEach(line => {
      const personMatch = line.match(/^##\s*(?:🎯\s*)?([A-Z]+)/i);
      if (personMatch) {
        const personName = personMatch[1];
        currentPerson = peopleList.find(p =>
          p.toLowerCase() === personName.toLowerCase()
        ) || personName;
        currentDate = this.parseDate(line);
        return;
      }

      const taskMatch = line.match(/^-\s*\[([ x])\]\s*(.+)$/i);
      if (taskMatch && currentPerson) {
        const isCompleted = taskMatch[1].toLowerCase() === 'x';
        let description = taskMatch[2].trim();

        let priority = 'normal';
        const priorityMatch = description.match(/\[(alta|high|média|media|medium|normal)\]/i);
        if (priorityMatch) {
          const p = priorityMatch[1].toLowerCase();
          priority = (p === 'alta' || p === 'high') ? 'high' :
            (p === 'média' || p === 'media' || p === 'medium') ? 'medium' : 'normal';
          description = description.replace(priorityMatch[0], '').trim();
        }

        let taskDate = currentDate;
        const taskDateMatch = description.match(/\(prazo:\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\)/i);
        if (taskDateMatch) {
          taskDate = this.parseDate(taskDateMatch[1]);
          description = description.replace(taskDateMatch[0], '').trim();
        }

        tasks.push({
          id: Date.now() + Math.random(),
          description,
          person: currentPerson,
          date: taskDate,
          priority,
          completed: isCompleted,
          createdAt: new Date().toISOString()
        });
      }
    });

    return tasks;
  }
}

// ============================================================================
// UI MANAGER
// ============================================================================

class UIManager {
  constructor(dataStore) {
    this.store = dataStore;
    this.currentTab = 'tasks';
    this.filters = {
      person: 'all',
      date: 'all',
      priority: 'all',
      completed: 'pending',
      sprint: 'all'
    };
    this.searchQuery = '';
    this.toasts = [];

    // Attach global listeners ONCE
    this.attachGlobalListeners();
  }

  showModal(title, defaultValue = '', type = 'text') {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal-overlay';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header"><h3>${title}</h3></div>
          <input type="${type}" class="modal-input" value="${this.escapeHtml(defaultValue)}" />
          <div class="modal-actions">
            <button class="btn btn-secondary" id="modal-cancel">Cancelar</button>
            <button class="btn btn-primary" id="modal-confirm">Confirmar</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      const input = modal.querySelector('input');
      input.focus();
      if (defaultValue && type === 'text') input.setSelectionRange(0, input.value.length);

      const close = (value) => {
        modal.remove();
        resolve(value);
      };

      modal.querySelector('#modal-cancel').onclick = () => close(null);
      modal.querySelector('#modal-confirm').onclick = () => close(input.value);

      input.onkeydown = (e) => {
        if (e.key === 'Enter') close(input.value);
        if (e.key === 'Escape') close(null);
      };

      modal.onclick = (e) => {
        if (e.target === modal) close(null);
      };
    });
  }

  async editTaskDate(taskId) {
    const task = this.store.tasks.find(t => String(t.id) === String(taskId));
    if (!task) return;

    const newDate = await this.showModal('Nova Data para a Tarefa:', task.date, 'date');
    if (newDate) {
      task.date = newDate;
      this.store.saveTasks();
      this.showToast('Data atualizada!', 'success');
      this.render();
    }
  }

  showEditTaskModal(task) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const peopleCheckboxes = this.store.people.map(p => {
      const checked = (task.people || []).includes(p) ? 'checked' : '';
      return `<label class="edit-checkbox-label"><input type="checkbox" class="edit-person-cb" value="${this.escapeHtml(p)}" ${checked}> ${this.escapeHtml(p)}</label>`;
    }).join('');

    const projectCheckboxes = this.store.projects.map(p => {
      const checked = (task.projects || []).includes(p.name) ? 'checked' : '';
      return `<label class="edit-checkbox-label"><input type="checkbox" class="edit-project-cb" value="${this.escapeHtml(p.name)}" ${checked}> ${this.escapeHtml(p.name)}</label>`;
    }).join('');

    const subtasksHtml = (task.subtasks || []).map(st => `
      <div class="edit-subtask-item" data-subtask-id="${st.id}">
        <input type="checkbox" class="edit-subtask-cb" ${st.completed ? 'checked' : ''}>
        <input type="text" class="edit-subtask-text" value="${this.escapeHtml(st.text)}">
        <button class="edit-subtask-delete btn-icon" title="Remover">✕</button>
      </div>
    `).join('');

    overlay.innerHTML = `
      <div class="edit-modal-content">
        <div class="edit-modal-header">
          <h3>Editar Tarefa</h3>
          <button class="edit-modal-close btn-icon">✕</button>
        </div>
        <div class="edit-modal-body">
          <div class="edit-modal-section">
            <label class="edit-modal-label">Título</label>
            <input type="text" id="edit-description" class="edit-modal-input" value="${this.escapeHtml(task.description)}">
          </div>
          <div class="edit-modal-section">
            <label class="edit-modal-label">Notas / Detalhes</label>
            <textarea id="edit-notes" class="edit-modal-textarea" rows="4" placeholder="Adicione detalhes, contexto ou anotações...">${this.escapeHtml(task.notes || '')}</textarea>
          </div>
          <div class="edit-modal-row">
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Prioridade</label>
              <select id="edit-priority" class="edit-modal-select">
                <option value="normal" ${task.priority === 'normal' ? 'selected' : ''}>🔵 Normal</option>
                <option value="medium" ${task.priority === 'medium' ? 'selected' : ''}>🟡 Média</option>
                <option value="high" ${task.priority === 'high' ? 'selected' : ''}>🔴 Alta</option>
              </select>
            </div>
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Data</label>
              <input type="date" id="edit-date" class="edit-modal-input" value="${task.date || ''}">
            </div>
          </div>
          <div class="edit-modal-row">
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Pessoas</label>
              <div class="edit-checkbox-group">${peopleCheckboxes || '<span class="text-muted">Nenhuma pessoa cadastrada</span>'}</div>
            </div>
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Projetos</label>
              <div class="edit-checkbox-group">${projectCheckboxes || '<span class="text-muted">Nenhum projeto cadastrado</span>'}</div>
            </div>
          </div>
          <div class="edit-modal-section">
            <label class="edit-modal-label">Tags (separadas por vírgula)</label>
            <input type="text" id="edit-tags" class="edit-modal-input" value="${(task.tags || []).join(', ')}" placeholder="ex: urgente, follow, review">
          </div>
          <div class="edit-modal-section">
            <label class="edit-modal-label">Subtarefas</label>
            <div id="edit-subtasks-list">${subtasksHtml}</div>
            <button id="edit-add-subtask" class="btn btn-sm btn-secondary" style="margin-top:8px">+ Subtarefa</button>
          </div>
        </div>
        <div class="edit-modal-footer">
          <button class="btn btn-secondary" id="edit-cancel">Cancelar</button>
          <button class="btn btn-primary" id="edit-save">Salvar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Close handlers
    const close = () => overlay.remove();
    overlay.querySelector('.edit-modal-close').addEventListener('click', close);
    overlay.querySelector('#edit-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    // Add subtask
    overlay.querySelector('#edit-add-subtask').addEventListener('click', () => {
      const list = overlay.querySelector('#edit-subtasks-list');
      const id = Date.now();
      const div = document.createElement('div');
      div.className = 'edit-subtask-item';
      div.dataset.subtaskId = id;
      div.innerHTML = `
        <input type="checkbox" class="edit-subtask-cb">
        <input type="text" class="edit-subtask-text" placeholder="Nova subtarefa...">
        <button class="edit-subtask-delete btn-icon" title="Remover">✕</button>
      `;
      list.appendChild(div);
      div.querySelector('.edit-subtask-text').focus();
      div.querySelector('.edit-subtask-delete').addEventListener('click', () => div.remove());
    });

    // Delete subtask handlers for existing ones
    overlay.querySelectorAll('.edit-subtask-delete').forEach(btn => {
      btn.addEventListener('click', (e) => e.target.closest('.edit-subtask-item').remove());
    });

    // Save handler
    overlay.querySelector('#edit-save').addEventListener('click', () => {
      const description = overlay.querySelector('#edit-description').value.trim();
      if (!description) {
        this.showToast('Título é obrigatório', 'warning');
        return;
      }

      task.description = description;
      task.notes = overlay.querySelector('#edit-notes').value.trim();
      task.priority = overlay.querySelector('#edit-priority').value;
      task.date = overlay.querySelector('#edit-date').value;
      task.tags = overlay.querySelector('#edit-tags').value.split(',').map(t => t.trim()).filter(t => t);

      task.people = [];
      overlay.querySelectorAll('.edit-person-cb:checked').forEach(cb => task.people.push(cb.value));
      task.person = task.people[0] || '';

      task.projects = [];
      overlay.querySelectorAll('.edit-project-cb:checked').forEach(cb => task.projects.push(cb.value));
      task.project = task.projects[0] || '';

      // Collect subtasks
      task.subtasks = [];
      overlay.querySelectorAll('.edit-subtask-item').forEach(item => {
        const text = item.querySelector('.edit-subtask-text').value.trim();
        if (text) {
          task.subtasks.push({
            id: parseFloat(item.dataset.subtaskId) || Date.now() + Math.random(),
            text: text,
            completed: item.querySelector('.edit-subtask-cb').checked
          });
        }
      });

      this.store.saveTasks();
      this.showToast('Tarefa atualizada!', 'success');
      close();
      this.renderTasksList();
    });
  }

  async processImageForTasks(base64Data, mimeType) {
    this.showToast('🖼️ Analisando imagem com IA...', 'info');
    try {
      const result = await window.AIBridge.analyzeImage(
        base64Data, mimeType, this.store.people, this.store.projects
      );
      if (result && result.tasks && result.tasks.length > 0) {
        const newTasks = result.tasks.map(t => ({
          id: Date.now() + Math.random(),
          description: t.description || 'Tarefa extraída',
          notes: result.rawText || '',
          person: (t.people && t.people[0]) || this.store.people[0] || '',
          people: t.people || [this.store.people[0] || ''],
          date: t.date || new Date().toISOString().split('T')[0],
          priority: t.priority || 'normal',
          completed: false,
          createdAt: new Date().toISOString(),
          project: (t.projects && t.projects[0]) || '',
          projects: t.projects || [],
          tags: t.tags || ['ocr'],
          subtasks: [],
          order: Date.now()
        }));
        // Auto-criar pessoas que a IA detectou via OCR mas não existem na configuração
        const existingPeopleOCR = this.store.people.map(p => p.toLowerCase());
        const newPeopleOCR = new Set();
        newTasks.forEach(task => {
          (task.people || []).forEach(personName => {
            if (personName && !existingPeopleOCR.includes(personName.toLowerCase())) {
              newPeopleOCR.add(personName);
            }
          });
        });
        if (newPeopleOCR.size > 0) {
          newPeopleOCR.forEach(p => this.store.people.push(p));
          this.store.savePeople();
          this.showToast(`👤 ${newPeopleOCR.size} pessoa(s) criada(s): ${[...newPeopleOCR].join(', ')}`, 'info');
        }

        this.store.tasks.push(...newTasks);
        this.store.saveTasks();
        this.showToast(`✓ ${newTasks.length} tarefa(s) extraída(s) da imagem`, 'success');
        this.renderTasksList();
      } else {
        this.showToast('Nenhuma tarefa encontrada na imagem', 'warning');
      }
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      this.showToast('Erro ao analisar imagem', 'error');
    }
  }

  attachGlobalListeners() {
    console.log('🔧 Inicializando listeners globais...');

    // Global paste handler for images (Ctrl+V)
    document.addEventListener('paste', async (e) => {
      if (!window.AIBridge || !window.AIBridge.isAvailable()) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64Data = event.target.result.split(',')[1];
            await this.processImageForTasks(base64Data, item.type);
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    });

    // Helper for delegation
    const on = (selector, callback) => {
      document.addEventListener('click', (e) => {
        const target = e.target.closest(selector);
        if (target) callback(e, target);
      });
    };

    // --- CONFIGURAÇÃO: PESSOAS ---

    // Add person
    on('#btn-add-person', async () => {
      console.log('👤 Click: Adicionar Pessoa');
      const name = await this.showModal('Nome da pessoa:');
      if (!name || !name.trim()) return;

      const trimmedName = name.trim();
      if (this.store.people.some(p => p.toLowerCase() === trimmedName.toLowerCase())) {
        this.showToast('Pessoa já existe', 'warning');
        return;
      }

      this.store.people.push(trimmedName);
      this.store.savePeople();
      console.log('✅ Pessoa adicionada:', trimmedName);
      this.showToast(`✓ ${trimmedName} adicionado(a)`, 'success');
      this.render();
    });

    // Edit person
    on('.person-edit', async (e, btn) => {
      const oldName = btn.dataset.person;
      console.log('✏️ Click: Editar Pessoa:', oldName);

      const newName = await this.showModal('Novo nome para ' + oldName + ':', oldName);
      if (!newName || !newName.trim() || newName === oldName) return;

      const trimmedName = newName.trim();
      if (this.store.people.some(p => p.toLowerCase() === trimmedName.toLowerCase())) {
        this.showToast('Esse nome já existe', 'warning');
        return;
      }

      // Atualizar lista
      this.store.people = this.store.people.map(p => p === oldName ? trimmedName : p);
      this.store.savePeople();

      // Atualizar tarefas (campo legado 'person' E array 'people[]')
      let updatedTasksCount = 0;
      this.store.tasks.forEach(task => {
        let changed = false;
        // Campo legado
        if (task.person === oldName) {
          task.person = trimmedName;
          changed = true;
        }
        // Array de pessoas
        if (task.people && task.people.length) {
          const idx = task.people.indexOf(oldName);
          if (idx !== -1) {
            task.people[idx] = trimmedName;
            changed = true;
          }
        }
        if (changed) updatedTasksCount++;
      });
      if (updatedTasksCount > 0) this.store.saveTasks();

      // Atualizar sprints (se tiverem referência a pessoa)
      // Atualizar projetos da Torre (responsavel)
      let updatedProjects = 0;
      if (this.store.projectsImpl) {
        this.store.projectsImpl.forEach(p => {
          if (p.responsavel === oldName) { p.responsavel = trimmedName; updatedProjects++; }
        });
        if (updatedProjects > 0) this.store.saveProjectsImpl();
      }
      if (this.store.projectsOngoing) {
        this.store.projectsOngoing.forEach(p => {
          if (p.responsavel === oldName) { p.responsavel = trimmedName; updatedProjects++; }
        });
        if (updatedProjects > 0) this.store.saveProjectsOngoing();
      }

      console.log(`✅ Pessoa renomeada: ${oldName} -> ${trimmedName} (${updatedTasksCount} tarefas atualizadas)`);
      this.showToast(`✓ ${oldName} alterado para ${trimmedName}`, 'success');
      this.render();
    });

    // Remove person
    on('.person-remove', (e, btn) => {
      const personName = btn.dataset.person;
      console.log('🗑️ Click: Remover Pessoa:', personName);

      if (this.store.people.length <= 1) {
        this.showToast('Deve haver pelo menos uma pessoa', 'warning');
        return;
      }

      if (!confirm(`Remover ${personName}?`)) return;

      this.store.people = this.store.people.filter(p => p !== personName);
      this.store.savePeople();
      console.log('✅ Pessoa removida:', personName);
      this.showToast(`${personName} removido(a)`, 'success');
      this.render();
    });

    // --- CONFIGURAÇÃO: PROJETOS ---

    // Add project
    on('#btn-add-project', async () => {
      console.log('📁 Click: Adicionar Projeto');
      const name = await this.showModal('Nome do projeto:');
      if (!name || !name.trim()) return;

      const id = name.toLowerCase().replace(/\s+/g, '-');
      if (this.store.projects.some(p => p.id === id)) {
        this.showToast('Projeto já existe', 'warning');
        return;
      }

      const newProject = {
        id,
        name: name.trim(),
        status: 'active',
        createdAt: new Date().toISOString()
      };

      this.store.projects.push(newProject);
      this.store.saveProjects();
      console.log('✅ Projeto adicionado:', name);
      this.showToast(`✓ Projeto "${name}" criado`, 'success');
      this.render();
    });

    // Edit project
    on('.project-edit', async (e, btn) => {
      const projectId = btn.dataset.projectId;
      console.log('✏️ Click: Editar Projeto ID:', projectId);

      const project = this.store.projects.find(p => p.id === projectId);
      if (!project) return;

      const oldName = project.name;
      const newName = await this.showModal('Novo nome do projeto:', oldName);

      if (!newName || !newName.trim() || newName === oldName) return;

      const trimmedName = newName.trim();

      // Atualizar projeto
      project.name = trimmedName;
      this.store.saveProjects();

      // Atualizar tarefas associadas (campo legado 'project' E array 'projects[]')
      let updatedTasksCount = 0;
      this.store.tasks.forEach(task => {
        let changed = false;
        // Campo legado
        if (task.project === oldName) {
          task.project = trimmedName;
          changed = true;
        }
        // Array de projetos
        if (task.projects && task.projects.length) {
          const idx = task.projects.indexOf(oldName);
          if (idx !== -1) {
            task.projects[idx] = trimmedName;
            changed = true;
          }
        }
        if (changed) updatedTasksCount++;
      });
      if (updatedTasksCount > 0) this.store.saveTasks();

      console.log(`✅ Projeto renomeado: ${oldName} -> ${trimmedName} (${updatedTasksCount} tarefas atualizadas)`);
      this.showToast(`✓ Projeto renomeado para "${trimmedName}"`, 'success');
      this.render();
    });

    // Remove project
    on('.project-remove', (e, btn) => {
      const projectId = btn.dataset.projectId;
      console.log('🗑️ Click: Remover Projeto ID:', projectId);

      if (!confirm('Remover este projeto?')) return;

      this.store.projects = this.store.projects.filter(p => p.id !== projectId);
      this.store.saveProjects();
      console.log('✅ Projeto removido:', projectId);
      this.showToast('Projeto removido', 'success');
      this.render();
    });

    // --- DADOS ---

    // Export
    on('#btn-export-data', () => {
      console.log('Bkp: Exportando dados...');
      const data = {
        tasks: this.store.tasks,
        people: this.store.people,
        documents: this.store.documents,
        projects: this.store.projects,
        sprints: this.store.sprints,
        currentSprintId: this.store.currentSprintId,
        quickNotes: this.store.quickNotes,
        projectsImpl: this.store.projectsImpl,
        projectsOngoing: this.store.projectsOngoing,
        dismissedDuplicates: Storage.get('dismissed-duplicates', []),
        duplicateMergeLog: Storage.get('duplicate-merge-log', []),
        exportedAt: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `segundo-cerebro-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      this.showToast('✓ Dados exportados', 'success');
    });

    // Import
    on('#btn-import-data', () => {
      console.log('Bkp: Importando dados...');
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = JSON.parse(event.target.result);
            if (data.tasks) { this.store.tasks = data.tasks; this.store.saveTasks(); }
            if (data.people) { this.store.people = data.people; this.store.savePeople(); }
            if (data.documents) { this.store.documents = data.documents; this.store.saveDocuments(); }
            if (data.projects) { this.store.projects = data.projects; this.store.saveProjects(); }
            if (data.sprints) { this.store.sprints = data.sprints; this.store.saveSprints(); }
            if (data.currentSprintId !== undefined) { this.store.currentSprintId = data.currentSprintId; Storage.set('checklist-current-sprint', data.currentSprintId); }
            if (data.quickNotes) { this.store.quickNotes = data.quickNotes; this.store.saveQuickNotes(); }
            if (data.projectsImpl) { this.store.projectsImpl = data.projectsImpl; this.store.saveProjectsImpl(); }
            if (data.projectsOngoing) { this.store.projectsOngoing = data.projectsOngoing; this.store.saveProjectsOngoing(); }
            if (data.dismissedDuplicates) { Storage.set('dismissed-duplicates', data.dismissedDuplicates); }
            if (data.duplicateMergeLog) { Storage.set('duplicate-merge-log', data.duplicateMergeLog); }
            this.showToast('✓ Dados importados com sucesso', 'success');
            this.render();
          } catch (error) {
            console.error('Erro importação:', error);
            this.showToast('Erro ao importar dados', 'error');
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });

    // Clear
    on('#btn-clear-data', () => {
      if (!confirm('⚠️ ATENÇÃO: Isso apagará TODOS os dados. Tem certeza?')) return;
      this.store.tasks = [];
      this.store.documents = [];
      this.store.saveTasks();
      this.store.saveDocuments();
      this.showToast('Dados limpos', 'success');
      this.render();
    });

    // --- NOTIFICAÇÕES ---
    // --- DUPLICATE DETECTION ---

    on('.dup-merge-a', (e, btn) => {
      const keepId = parseFloat(btn.dataset.keepId);
      const removeId = parseFloat(btn.dataset.removeId);
      if (confirm('Mesclar tarefas? A tarefa B será combinada na tarefa A e removida.')) {
        this.mergeDuplicateTasks(keepId, removeId);
        this.render();
      }
    });

    on('.dup-merge-b', (e, btn) => {
      const keepId = parseFloat(btn.dataset.keepId);
      const removeId = parseFloat(btn.dataset.removeId);
      if (confirm('Mesclar tarefas? A tarefa A será combinada na tarefa B e removida.')) {
        this.mergeDuplicateTasks(keepId, removeId);
        this.render();
      }
    });

    on('.dup-dismiss', (e, btn) => {
      const pairKey = btn.dataset.pairKey;
      this.dismissDuplicate(pairKey);
      // Remover visualmente o card
      const pairEl = btn.closest('.duplicate-pair');
      if (pairEl) pairEl.remove();
      this.showToast('Duplicata ignorada', 'info');
    });

  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = type === 'success' ? '✓' :
      type === 'error' ? '✕' :
        type === 'info' ? 'ℹ️' : '⚠';
    toast.innerHTML = `<span class="toast-icon">${icon}</span> ${message}`;

    const container = document.getElementById('toast-container');
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  formatDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  render() {
    const root = document.getElementById('root');

    root.innerHTML = `
      <div id="toast-container"></div>

      <header class="header">
        <div class="header-content">
          <div class="header-title">
            <svg class="header-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a5 5 0 0 1 5 5c0 2.76-2.24 5-5 5s-5-2.24-5-5a5 5 0 0 1 5-5z"/>
              <path d="M12 12c-3 0-5.5 1.5-6.5 4"/>
              <path d="M12 12c3 0 5.5 1.5 6.5 4"/>
              <path d="M9 22h6"/>
              <path d="M12 16v6"/>
            </svg>
            <div>
              <h1>Brainiac</h1>
              <p class="header-subtitle">Hub de Gestao Inteligente</p>
            </div>
          </div>
        </div>
      </header>

      <nav class="tabs">
        <div class="tabs-content">
          <button class="tab ${this.currentTab === 'tasks' ? 'tab-active' : ''}" data-tab="tasks">Tarefas</button>
          <button class="tab ${this.currentTab === 'sprints' ? 'tab-active' : ''}" data-tab="sprints">Sprints</button>
          <button class="tab ${this.currentTab === 'memory' ? 'tab-active' : ''}" data-tab="memory">Memória</button>
          <button class="tab ${this.currentTab === 'notes' ? 'tab-active' : ''}" data-tab="notes">Anotações</button>
          <button class="tab ${this.currentTab === 'torre' ? 'tab-active' : ''}" data-tab="torre">Torre de Comando</button>
          <button class="tab ${this.currentTab === 'financeiro' ? 'tab-active' : ''}" data-tab="financeiro">Financeiro</button>
          <button class="tab ${this.currentTab === 'oneones' ? 'tab-active' : ''}" data-tab="oneones">1:1s</button>
          <button class="tab ${this.currentTab === 'equipe' ? 'tab-active' : ''}" data-tab="equipe">Equipe</button>
          <button class="tab ${this.currentTab === 'config' ? 'tab-active' : ''}" data-tab="config">Config</button>
        </div>
      </nav>

      <main class="main-content">
        <div id="tab-content"></div>
      </main>
    `;

    // Attach tab listeners
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.currentTab = tab.dataset.tab;
        this.render();
      });
    });

    // Render active tab
    this.renderActiveTab();
  }

  renderActiveTab() {
    const content = document.getElementById('tab-content');

    if (this.currentTab === 'tasks') {
      this.renderTasksTab(content);
    } else if (this.currentTab === 'sprints') {
      this.renderSprintsTab(content);
    } else if (this.currentTab === 'memory') {
      this.renderMemoryTab(content);
    } else if (this.currentTab === 'notes') {
      this.renderNotesTab(content);
    } else if (this.currentTab === 'torre') {
      this.renderTorreDeComandoTab(content);
    } else if (this.currentTab === 'financeiro') {
      this.renderFinanceiroTab(content);
    } else if (this.currentTab === 'oneones') {
      this.renderOneOnesTab(content);
    } else if (this.currentTab === 'equipe') {
      this.renderEquipeTab(content);
    } else if (this.currentTab === 'config') {
      this.renderConfigTab(content);
    }
  }

  renderTasksTab(container) {
    const today = new Date().toISOString().split('T')[0];
    const todayTasks = this.store.tasks.filter(t => t.date === today && !t.completed);
    const overdueTasks = this.store.tasks.filter(t => t.date < today && !t.completed);
    const completed = this.store.tasks.filter(t => t.completed).length;
    const total = this.store.tasks.length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Dashboard Summary -->
        <div class="card-grid">
          <div class="stat-card stat-blue">
            <div class="stat-label">Hoje</div>
            <div class="stat-value">${todayTasks.length}</div>
            <div class="stat-sub">tarefas pendentes</div>
          </div>

          <div class="stat-card stat-red">
            <div class="stat-label">Atrasadas</div>
            <div class="stat-value">${overdueTasks.length}</div>
            <div class="stat-sub">precisam atenção</div>
          </div>

          <div class="stat-card stat-green">
            <div class="stat-label">Conclusão</div>
            <div class="stat-value">${completionRate}%</div>
            <div class="stat-sub">${completed} de ${total}</div>
          </div>
        </div>

        <!-- Command Input -->
        <div class="card">
          <div class="card-header">
            <h3>⚡ Adicionar Tarefas Rapidamente</h3>
            <div style="display: flex; align-items: center; gap: 1rem;">
              <span style="display: flex; align-items: center; gap: 0.5rem; background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 0.25rem 0.75rem; border-radius: 1rem; font-size: 0.8rem; font-weight: 600;">🤖 IA Ativa</span>
              <span class="shortcut-hint">Ctrl+K</span>
            </div>
          </div>

          <textarea
            id="command-input"
            class="command-textarea"
            placeholder="🤖 FILTRO IA ATIVO — Digite qualquer texto e a IA vai interpretar corretamente!

Exemplos:
&quot;O Pedro precisa revisar o código amanhã com alta prioridade&quot;
&quot;Lembrar de fazer deploy em produção no dia 15&quot;
&quot;Walter deve atualizar o dashboard essa semana&quot;

Cole checklists, atas de reunião, e-mails ou qualquer texto — a IA extrai as tarefas!"
          ></textarea>

          <div class="button-group">
            <button id="btn-process-commands" class="btn btn-primary">
              <span id="btn-process-icon">🤖</span> <span id="btn-process-text">Processar com IA</span>
            </button>
            <button id="btn-clear-commands" class="btn btn-secondary">
              Limpar Campo
            </button>
            <button id="btn-clear-all-tasks" class="btn btn-danger" title="Apagar TODAS as tarefas (para testes)">
              🗑️ Limpar Tudo
            </button>
            <button id="btn-import-checklist" class="btn btn-purple">
              📥 Importar Checklist
            </button>
            <button id="btn-capture-screen" class="btn btn-secondary" title="Captura a tela e extrai tarefas com IA">
              📸 Capturar Tela
            </button>
            <button id="btn-toggle-form" class="btn btn-success" style="margin-left: auto;">
              + Formulário Manual
            </button>
          </div>
        </div>

        <!-- Manual Form (hidden by default) -->
        <div id="manual-form" class="card" style="display: none;">
          <div class="card-header">
            <h3>Nova Tarefa (Manual)</h3>
            <button id="btn-close-form" class="btn-icon">✕</button>
          </div>

          <div class="form-grid">
            <div class="form-group form-span-2">
              <label>Descrição *</label>
              <input type="text" id="task-description" placeholder="Ex: Adicionar dashboard de vendas">
            </div>

            <div class="form-group">
              <label>Pessoa</label>
              <select id="task-person">
                ${this.store.people.map(p => `<option value="${p}">${p}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Data</label>
              <input type="date" id="task-date" value="${today}">
            </div>

            <div class="form-group">
              <label>Prioridade</label>
              <select id="task-priority">
                <option value="normal">Normal</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>

            <div class="form-group">
              <label>Projeto (opcional)</label>
              <select id="task-project">
                <option value="">Nenhum</option>
                ${this.store.projects.map(p => `<option value="${p.name}">${p.name}</option>`).join('')}
              </select>
            </div>

            <div class="form-group form-span-2">
              <label>Tags (separadas por vírgula)</label>
              <input type="text" id="task-tags" placeholder="Ex: urgent, backend, review">
            </div>
          </div>

          <button id="btn-add-task" class="btn btn-success">
            + Adicionar Tarefa
          </button>
        </div>

        <!-- Filters -->
        <div class="card">
          <h3 class="card-title">Filtros</h3>

          <div class="filter-grid">
            <div class="form-group">
              <label>Pessoa</label>
              <select id="filter-person">
                <option value="all">Todas</option>
                ${this.store.people.map(p => `<option value="${p}" ${this.filters.person === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Data</label>
              <select id="filter-date">
                <option value="all" ${this.filters.date === 'all' ? 'selected' : ''}>Todas</option>
                <option value="today" ${this.filters.date === 'today' ? 'selected' : ''}>Hoje</option>
                <option value="tomorrow" ${this.filters.date === 'tomorrow' ? 'selected' : ''}>Amanhã</option>
                <option value="overdue" ${this.filters.date === 'overdue' ? 'selected' : ''}>Atrasadas</option>
              </select>
            </div>

            <div class="form-group">
              <label>Prioridade</label>
              <select id="filter-priority">
                <option value="all" ${this.filters.priority === 'all' ? 'selected' : ''}>Todas</option>
                <option value="high" ${this.filters.priority === 'high' ? 'selected' : ''}>Alta</option>
                <option value="medium" ${this.filters.priority === 'medium' ? 'selected' : ''}>Média</option>
                <option value="normal" ${this.filters.priority === 'normal' ? 'selected' : ''}>Normal</option>
              </select>
            </div>

            <div class="form-group">
              <label>Status</label>
              <select id="filter-completed">
                <option value="all" ${this.filters.completed === 'all' ? 'selected' : ''}>Todas</option>
                <option value="pending" ${this.filters.completed === 'pending' ? 'selected' : ''}>Pendentes</option>
                <option value="completed" ${this.filters.completed === 'completed' ? 'selected' : ''}>Concluídas</option>
              </select>
            </div>

            <div class="form-group">
              <label>Sprint</label>
              <select id="filter-sprint">
                <option value="all" ${this.filters.sprint === 'all' ? 'selected' : ''}>Todos</option>
                <option value="none" ${this.filters.sprint === 'none' ? 'selected' : ''}>Sem Sprint</option>
                ${this.store.sprints.map(s => `<option value="${s.id}" ${String(this.filters.sprint) === String(s.id) ? 'selected' : ''}>${this.escapeHtml(s.name)}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Buscar</label>
              <input type="text" id="filter-search" placeholder="Ctrl+F" value="${this.searchQuery}">
            </div>
          </div>
        </div>

        <!-- Tasks List -->
        <div id="tasks-list"></div>
      </div>
    `;

    // Render tasks
    this.renderTasksList();

    // Attach event listeners
    this.attachTasksEventListeners();
  }

  renderTasksList() {
    const container = document.getElementById('tasks-list');
    const filteredTasks = this.getFilteredTasks();
    const groupedTasks = this.groupTasks(filteredTasks);

    if (groupedTasks.length === 0) {
      container.innerHTML = `
        <div class="card empty-state">
          <div class="empty-icon">📋</div>
          <p>Nenhuma tarefa encontrada</p>
          <p class="empty-hint">Adicione tarefas usando os comandos rápidos acima</p>
        </div>
      `;
      return;
    }

    // Agrupar por dia (accordion por data)
    const byDate = {};
    groupedTasks.forEach(group => {
      if (!byDate[group.date]) byDate[group.date] = [];
      byDate[group.date].push(group);
    });

    // Inicializar estado de collapse se não existir
    if (!this._collapsedDays) this._collapsedDays = {};

    // Determinar se "hoje" deve abrir por padrão
    const today = new Date().toISOString().split('T')[0];

    let html = '';
    Object.keys(byDate).sort().forEach(date => {
      const dayGroups = byDate[date];
      const totalPending = dayGroups.reduce((sum, g) => sum + g.tasks.filter(t => !t.completed).length, 0);
      const totalTasks = dayGroups.reduce((sum, g) => sum + g.tasks.length, 0);
      const isCollapsed = this._collapsedDays[date] !== undefined ? this._collapsedDays[date] : (date !== today);
      const collapsedClass = isCollapsed ? 'collapsed' : '';

      html += `
        <div class="task-group ${collapsedClass}" data-group-date="${date}">
          <div class="task-group-header" data-toggle-date="${date}">
            <div class="task-group-info">
              <span class="task-group-toggle">▼</span>
              <span class="task-group-date">📅 ${this.formatDate(date)}</span>
              <span class="task-group-count" style="margin-left:0.5rem">${totalPending} pendente(s) · ${totalTasks} total</span>
            </div>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
              ${dayGroups.map(g => `<span class="task-group-person" style="font-size:0.8rem">👤 ${g.person}</span>`).join('')}
            </div>
          </div>

          <div class="task-group-body">
            ${dayGroups.map(group => `
              <div style="margin-bottom:0.75rem;">
                ${dayGroups.length > 1 ? `<div style="font-weight:600;color:#dc2626;font-size:0.875rem;margin-bottom:0.5rem;padding-top:0.5rem;border-top:1px solid var(--color-border);">👤 ${group.person} (${group.tasks.filter(t => !t.completed).length} pendente)</div>` : ''}
                <div class="task-list">
                  ${group.tasks.map(task => this.renderTaskCard(task)).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Attach collapse toggle listeners
    container.querySelectorAll('[data-toggle-date]').forEach(header => {
      header.addEventListener('click', (e) => {
        // Não colapsar se clicar em botão dentro do header
        if (e.target.closest('button')) return;
        const date = header.dataset.toggleDate;
        const group = container.querySelector(`[data-group-date="${date}"]`);
        if (group) {
          const isNowCollapsed = !group.classList.contains('collapsed');
          group.classList.toggle('collapsed');
          this._collapsedDays[date] = isNowCollapsed;
        }
      });
    });

    // Attach task event listeners
    this.attachTaskCardListeners();
  }

  renderTaskCard(task) {
    const priorityClass = {
      high: 'task-high',
      medium: 'task-medium',
      normal: 'task-normal'
    }[task.priority];

    const priorityLabel = {
      high: '🔴 Alta',
      medium: '🟡 Média',
      normal: '🔵 Normal'
    }[task.priority];

    return `
      <div class="task-card ${priorityClass} ${task.completed ? 'task-completed' : ''}" data-task-id="${task.id}" draggable="true">
        <div class="task-content">
          <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''}>

          <div class="task-body">
            <p class="task-description">${this.escapeHtml(task.description)}</p>

            <div class="task-tags">
              <span class="tag tag-priority">${priorityLabel}</span>
              ${task.projects && task.projects.length ? task.projects.map(p => `<span class="tag tag-project">📁 ${this.escapeHtml(p)}</span>`).join('') : (task.project ? `<span class="tag tag-project">📁 ${this.escapeHtml(task.project)}</span>` : '')}
              ${task.people && task.people.length > 1 ? task.people.filter(p => p !== task.person).map(p => `<span class="tag tag-tag" style="background:#e0f2fe;color:#0369a1">👤 ${this.escapeHtml(p)}</span>`).join('') : ''}
              ${task.tags ? task.tags.map(tag => `<span class="tag tag-tag">#${this.escapeHtml(tag)}</span>`).join('') : ''}
              ${this.getTaskSprintBadge(task.id)}
            </div>
          </div>

          <button class="task-edit btn-icon" title="Editar Tarefa">✏️</button>
          <button class="task-sprint-assign btn-icon" title="Atribuir a Sprint">🏃</button>
          <button class="task-date-edit btn-icon" title="Alterar Data">📅</button>
          <button class="task-delete btn-icon" title="Excluir">🗑️</button>
        </div>
        ${task.notes ? `<div class="task-notes-preview" title="Clique em ✏️ para ver detalhes">📝 ${this.escapeHtml(task.notes.substring(0, 100))}${task.notes.length > 100 ? '...' : ''}</div>` : ''}
        ${task.subtasks && task.subtasks.length > 0 ? `<div class="task-subtasks-progress">
          <span>${task.subtasks.filter(s => s.completed).length}/${task.subtasks.length} subtarefas</span>
          <div class="subtasks-bar"><div class="subtasks-bar-fill" style="width:${Math.round(task.subtasks.filter(s => s.completed).length / task.subtasks.length * 100)}%"></div></div>
        </div>` : ''}
      </div>
    `;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ============================================================================
  // DUPLICATE DETECTION SYSTEM
  // ============================================================================

  /**
   * Calcula similaridade entre duas strings (0.0 a 1.0)
   * Usa Dice Coefficient com bigrams para boa performance e precisão
   */
  stringSimilarity(a, b) {
    if (!a || !b) return 0;
    a = a.toLowerCase().trim();
    b = b.toLowerCase().trim();
    if (a === b) return 1.0;
    if (a.length < 2 || b.length < 2) return 0;

    const bigramsA = new Map();
    for (let i = 0; i < a.length - 1; i++) {
      const bigram = a.substring(i, i + 2);
      bigramsA.set(bigram, (bigramsA.get(bigram) || 0) + 1);
    }

    let intersectionSize = 0;
    for (let i = 0; i < b.length - 1; i++) {
      const bigram = b.substring(i, i + 2);
      const count = bigramsA.get(bigram) || 0;
      if (count > 0) {
        bigramsA.set(bigram, count - 1);
        intersectionSize++;
      }
    }

    return (2.0 * intersectionSize) / (a.length - 1 + b.length - 1);
  }

  /**
   * Encontra pares de tarefas duplicadas/similares
   * Retorna array de { task1, task2, similarity, reason }
   */
  findDuplicateTasks(threshold = 0.6) {
    const tasks = this.store.tasks.filter(t => !t.completed);
    const duplicates = [];
    const dismissedDupes = Storage.get('dismissed-duplicates', []);

    for (let i = 0; i < tasks.length; i++) {
      for (let j = i + 1; j < tasks.length; j++) {
        const t1 = tasks[i];
        const t2 = tasks[j];

        // Pula pares já descartados pelo usuário
        const pairKey = [t1.id, t2.id].sort().join('-');
        if (dismissedDupes.includes(pairKey)) continue;

        const descSim = this.stringSimilarity(t1.description, t2.description);

        // Similaridade alta na descrição
        if (descSim >= threshold) {
          let reason = `Descrição ${Math.round(descSim * 100)}% similar`;
          // Bônus de contexto
          const samePeople = (t1.people || []).some(p => (t2.people || []).includes(p));
          const sameProject = (t1.projects || []).some(p => (t2.projects || []).includes(p));
          const sameDate = t1.date === t2.date;

          if (samePeople) reason += ' · mesma(s) pessoa(s)';
          if (sameProject) reason += ' · mesmo projeto';
          if (sameDate) reason += ' · mesma data';

          duplicates.push({ task1: t1, task2: t2, similarity: descSim, reason, pairKey });
        }
      }
    }

    // Ordenar por similaridade (mais similares primeiro)
    duplicates.sort((a, b) => b.similarity - a.similarity);
    return duplicates;
  }

  /**
   * Mescla duas tarefas: mantém task1 e combina informações de task2
   */
  mergeDuplicateTasks(keepId, removeId) {
    const keep = this.store.tasks.find(t => t.id === keepId);
    const remove = this.store.tasks.find(t => t.id === removeId);
    if (!keep || !remove) return;

    // Combinar pessoas (sem duplicar)
    const allPeople = [...new Set([...(keep.people || []), ...(remove.people || [])])];
    keep.people = allPeople;
    keep.person = allPeople[0] || keep.person;

    // Combinar projetos (sem duplicar)
    keep.projects = [...new Set([...(keep.projects || []), ...(remove.projects || [])])];
    keep.project = keep.projects[0] || keep.project;

    // Combinar tags (sem duplicar)
    keep.tags = [...new Set([...(keep.tags || []), ...(remove.tags || [])])];

    // Combinar subtasks
    keep.subtasks = [...(keep.subtasks || []), ...(remove.subtasks || [])];

    // Combinar notas
    if (remove.notes && remove.notes.trim()) {
      keep.notes = (keep.notes || '') + (keep.notes ? '\n---\n' : '') + remove.notes;
    }

    // Usar a data mais cedo
    if (remove.date && (!keep.date || remove.date < keep.date)) {
      keep.date = remove.date;
    }

    // Usar prioridade mais alta
    const priorityOrder = { high: 3, medium: 2, normal: 1 };
    if ((priorityOrder[remove.priority] || 0) > (priorityOrder[keep.priority] || 0)) {
      keep.priority = remove.priority;
    }

    // Registrar merge para referência da IA
    const mergeLog = Storage.get('duplicate-merge-log', []);
    mergeLog.push({
      date: new Date().toISOString(),
      kept: { id: keep.id, description: keep.description },
      removed: { id: remove.id, description: remove.description },
      similarity: this.stringSimilarity(keep.description, remove.description)
    });
    Storage.set('duplicate-merge-log', mergeLog);

    // Remover a tarefa duplicada
    this.store.tasks = this.store.tasks.filter(t => t.id !== removeId);
    this.store.saveTasks();

    this.showToast(`✓ Tarefas mescladas com sucesso`, 'success');
  }

  /**
   * Descarta um par de duplicatas (não mostrar mais)
   */
  dismissDuplicate(pairKey) {
    const dismissed = Storage.get('dismissed-duplicates', []);
    if (!dismissed.includes(pairKey)) {
      dismissed.push(pairKey);
      Storage.set('dismissed-duplicates', dismissed);
    }
  }

  /**
   * Renderiza a seção de duplicatas na aba de config
   */
  renderDuplicatesSection() {
    const duplicates = this.findDuplicateTasks(0.55);

    if (duplicates.length === 0) {
      return `
        <div class="card">
          <h3 class="card-title">Detecção de Duplicatas</h3>
          <div style="text-align:center;padding:1rem;color:var(--text-muted);">
            <div style="font-size:2rem;margin-bottom:0.5rem;">✅</div>
            <p>Nenhuma tarefa duplicada encontrada</p>
          </div>
        </div>
      `;
    }

    return `
      <div class="card">
        <div class="card-header">
          <h3>Detecção de Duplicatas</h3>
          <span class="badge" style="background:var(--color-primary);color:#fff;padding:0.25rem 0.75rem;border-radius:1rem;font-size:0.8rem;">${duplicates.length} encontrada(s)</span>
        </div>
        <div class="duplicates-list" style="display:flex;flex-direction:column;gap:1rem;margin-top:0.75rem;">
          ${duplicates.map((dup, idx) => `
            <div class="duplicate-pair" data-pair-key="${dup.pairKey}" style="border:1px solid var(--color-border);border-radius:0.75rem;padding:1rem;background:var(--bg-card);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                <span style="font-size:0.8rem;color:var(--text-muted);font-weight:600;">
                  ⚠️ ${dup.reason}
                </span>
                <span style="font-size:0.75rem;background:${dup.similarity > 0.8 ? '#dc2626' : '#f59e0b'};color:#fff;padding:0.15rem 0.5rem;border-radius:0.5rem;">
                  ${Math.round(dup.similarity * 100)}% similar
                </span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
                <div style="border:1px solid var(--color-border);border-radius:0.5rem;padding:0.75rem;background:var(--bg-main);">
                  <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;font-weight:600;">Tarefa A</div>
                  <p style="font-weight:600;margin-bottom:0.25rem;">${this.escapeHtml(dup.task1.description)}</p>
                  <div style="font-size:0.75rem;color:var(--text-muted);">
                    👤 ${(dup.task1.people || [dup.task1.person]).join(', ')}
                    ${dup.task1.date ? ' · 📅 ' + this.formatDate(dup.task1.date) : ''}
                    ${dup.task1.projects && dup.task1.projects.length ? ' · 📁 ' + dup.task1.projects.join(', ') : ''}
                  </div>
                </div>
                <div style="border:1px solid var(--color-border);border-radius:0.5rem;padding:0.75rem;background:var(--bg-main);">
                  <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:0.25rem;text-transform:uppercase;font-weight:600;">Tarefa B</div>
                  <p style="font-weight:600;margin-bottom:0.25rem;">${this.escapeHtml(dup.task2.description)}</p>
                  <div style="font-size:0.75rem;color:var(--text-muted);">
                    👤 ${(dup.task2.people || [dup.task2.person]).join(', ')}
                    ${dup.task2.date ? ' · 📅 ' + this.formatDate(dup.task2.date) : ''}
                    ${dup.task2.projects && dup.task2.projects.length ? ' · 📁 ' + dup.task2.projects.join(', ') : ''}
                  </div>
                </div>
              </div>
              <div style="display:flex;gap:0.5rem;margin-top:0.75rem;justify-content:flex-end;">
                <button class="btn btn-sm btn-primary dup-merge-a" data-keep-id="${dup.task1.id}" data-remove-id="${dup.task2.id}" data-pair-key="${dup.pairKey}">
                  Manter A, mesclar B
                </button>
                <button class="btn btn-sm btn-primary dup-merge-b" data-keep-id="${dup.task2.id}" data-remove-id="${dup.task1.id}" data-pair-key="${dup.pairKey}">
                  Manter B, mesclar A
                </button>
                <button class="btn btn-sm dup-dismiss" data-pair-key="${dup.pairKey}" style="background:var(--bg-hover);color:var(--text-muted);">
                  Ignorar
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  getTaskSprint(taskId) {
    return this.store.sprints.find(s => s.taskIds && s.taskIds.includes(taskId)) || null;
  }

  getTaskSprintBadge(taskId) {
    const sprint = this.getTaskSprint(taskId);
    if (!sprint) return '';
    return `<span class="tag tag-sprint">🏃 ${this.escapeHtml(sprint.name)}</span>`;
  }

  async assignTaskToSprint(taskId) {
    const availableSprints = this.store.sprints.filter(s => s.status !== 'completed');
    if (availableSprints.length === 0) {
      this.showToast('Nenhum sprint disponível. Crie um sprint primeiro.', 'warning');
      return;
    }

    const currentSprint = this.getTaskSprint(taskId);
    const options = availableSprints.map(s => `<option value="${s.id}" ${currentSprint && currentSprint.id === s.id ? 'selected' : ''}>${this.escapeHtml(s.name)}</option>`).join('');

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header"><h3>Atribuir a Sprint</h3></div>
        <div class="modal-body">
          <select id="sprint-select" class="form-input" style="width:100%;padding:0.5rem;">
            <option value="">Nenhum Sprint</option>
            ${options}
          </select>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="modal-confirm">Confirmar</button>
          <button class="btn" id="modal-cancel">Cancelar</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#modal-confirm').addEventListener('click', () => {
      const selectedSprintId = parseFloat(document.getElementById('sprint-select').value);

      // Remove from current sprint if exists
      if (currentSprint) {
        this.store.removeTaskFromSprint(taskId, currentSprint.id);
      }

      // Assign to new sprint
      if (selectedSprintId) {
        this.store.assignTaskToSprint(taskId, selectedSprintId);
        this.showToast('Tarefa atribuída ao sprint!', 'success');
      } else {
        this.showToast('Tarefa removida do sprint', 'success');
      }

      modal.remove();
      this.renderTasksList();
    });

    modal.querySelector('#modal-cancel').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  }

  getFilteredTasks() {
    return this.store.tasks.filter(task => {
      // Check if person is in the list (or is the legacy person)
      if (this.filters.person !== 'all') {
        const people = task.people && task.people.length ? task.people : [task.person];
        if (!people.includes(this.filters.person)) return false;
      }
      if (this.filters.priority !== 'all' && task.priority !== this.filters.priority) return false;
      if (this.filters.completed === 'pending' && task.completed) return false;
      if (this.filters.completed === 'completed' && !task.completed) return false;

      if (this.filters.date !== 'all') {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];

        if (this.filters.date === 'today' && task.date !== today) return false;
        if (this.filters.date === 'tomorrow' && task.date !== tomorrowStr) return false;
        if (this.filters.date === 'overdue' && task.date >= today) return false;
      }

      if (this.filters.sprint !== 'all') {
        const allSprintTaskIds = this.store.sprints.flatMap(s => s.taskIds || []);
        if (this.filters.sprint === 'none') {
          if (allSprintTaskIds.includes(task.id)) return false;
        } else {
          const sprint = this.store.getSprintById(parseFloat(this.filters.sprint));
          if (!sprint || !sprint.taskIds.includes(task.id)) return false;
        }
      }

      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        if (task.description.toLowerCase().includes(query)) return true;
        if (task.notes && task.notes.toLowerCase().includes(query)) return true;
        if (task.person && task.person.toLowerCase().includes(query)) return true;
        if (task.people && task.people.some(p => p.toLowerCase().includes(query))) return true;
        if (task.project && task.project.toLowerCase().includes(query)) return true;
        if (task.projects && task.projects.some(p => p.toLowerCase().includes(query))) return true;
        if (task.tags && task.tags.some(t => t.toLowerCase().includes(query))) return true;
        if (task.subtasks && task.subtasks.some(st => st.text.toLowerCase().includes(query))) return true;
        return false;
      }

      return true;
    });
  }

  groupTasks(tasks) {
    const groups = {};

    tasks.forEach(task => {
      // Support multi-person grouping
      const people = task.people && task.people.length ? task.people : [task.person];

      people.forEach(person => {
        const key = `${task.date}_${person}`;
        if (!groups[key]) {
          groups[key] = {
            date: task.date,
            person: person,
            tasks: []
          };
        }
        groups[key].tasks.push(task);
      });
    });

    return Object.values(groups).sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return a.person.localeCompare(b.person);
    });
  }

  attachTasksEventListeners() {
    // Process commands - SEMPRE via IA (com fallback para parser local)
    document.getElementById('btn-process-commands')?.addEventListener('click', async () => {
      const input = document.getElementById('command-input');
      const text = input.value.trim();
      const btnProcess = document.getElementById('btn-process-commands');
      const btnIcon = document.getElementById('btn-process-icon');
      const btnText = document.getElementById('btn-process-text');

      if (!text) {
        this.showToast('Digite algo primeiro — qualquer texto!', 'warning');
        return;
      }

      let newTasks = [];

      // Desabilitar botão e mostrar loading
      btnProcess.disabled = true;
      btnIcon.textContent = '⏳';
      btnText.textContent = 'IA processando...';
      btnProcess.style.opacity = '0.7';

      try {
        if (window.AIBridge && window.AIBridge.isAvailable()) {
          // ========== PROCESSAMENTO VIA IA (PADRÃO) ==========
          this.showToast('🤖 Enviando para IA processar...', 'info');

          console.log('📤 Enviando para IA:', text);
          console.log('👥 Pessoas disponíveis:', this.store.people);
          console.log('📁 Projetos disponíveis:', this.store.projects.map(p => p.name));

          // Enviar tarefas existentes para a IA evitar duplicatas
          const existingTaskDescriptions = this.store.tasks
            .filter(t => !t.completed)
            .map(t => t.description);

          const aiTasks = await window.AIBridge.parseNaturalLanguage(
            text,
            this.store.people,
            this.store.projects,
            existingTaskDescriptions
          );

          console.log('📥 IA retornou:', aiTasks);

          if (aiTasks && aiTasks.length > 0) {
            // Converte tasks da IA para formato interno
            newTasks = aiTasks.map((task, index) => {
              const converted = {
                id: Date.now() + Math.random(),
                description: task.description || 'Sem descrição',
                person: (task.people && task.people.length) ? task.people[0] : (task.person || this.store.people[0]),
                people: (task.people && task.people.length) ? task.people : [task.person || this.store.people[0]],
                date: CommandParser.parseDate(task.date || 'hoje'),
                priority: task.priority === 'high' ? 'high' :
                  task.priority === 'medium' ? 'medium' : 'normal',
                completed: false,
                createdAt: new Date().toISOString(),
                project: (task.projects && task.projects.length) ? task.projects[0] : (task.project || undefined),
                projects: (task.projects && task.projects.length) ? task.projects : (task.project ? [task.project] : []),
                tags: task.tags || undefined
              };

              console.log(`✅ Tarefa ${index + 1} convertida:`, converted);
              return converted;
            });

            this.showToast(`🤖 IA criou ${newTasks.length} tarefa(s) com sucesso!`, 'success');

            // Auto-criar projetos que a IA detectou mas não existem ainda
            const existingProjectNames = this.store.projects.map(p => p.name.toLowerCase());
            const newProjectNames = new Set();

            newTasks.forEach(task => {
              if (task.projects && task.projects.length) {
                task.projects.forEach(pName => {
                  if (pName && !existingProjectNames.includes(pName.toLowerCase())) {
                    newProjectNames.add(pName);
                  }
                });
              } else if (task.project && !existingProjectNames.includes(task.project.toLowerCase())) {
                newProjectNames.add(task.project);
              }
            });

            if (newProjectNames.size > 0) {
              newProjectNames.forEach(projectName => {
                const newProject = {
                  id: projectName.toLowerCase().replace(/\s+/g, '-'),
                  name: projectName,
                  status: 'active',
                  createdAt: new Date().toISOString()
                };
                this.store.projects.push(newProject);
                console.log(`📁 Projeto auto-criado: ${projectName}`);
              });
              this.store.saveProjects();
              this.showToast(`📁 ${newProjectNames.size} projeto(s) criado(s): ${[...newProjectNames].join(', ')}`, 'info');
            }

            // Auto-criar pessoas que a IA detectou mas não existem na configuração
            const existingPeopleNames = this.store.people.map(p => p.toLowerCase());
            const newPeopleNames = new Set();

            newTasks.forEach(task => {
              if (task.people && task.people.length) {
                task.people.forEach(personName => {
                  if (personName && !existingPeopleNames.includes(personName.toLowerCase())) {
                    newPeopleNames.add(personName);
                  }
                });
              } else if (task.person && !existingPeopleNames.includes(task.person.toLowerCase())) {
                newPeopleNames.add(task.person);
              }
            });

            if (newPeopleNames.size > 0) {
              newPeopleNames.forEach(personName => {
                this.store.people.push(personName);
                console.log(`👤 Pessoa auto-criada: ${personName}`);
              });
              this.store.savePeople();
              this.showToast(`👤 ${newPeopleNames.size} pessoa(s) criada(s): ${[...newPeopleNames].join(', ')}`, 'info');
            }
          } else {
            // IA não encontrou tarefas → fallback
            console.warn('⚠️ IA não retornou tarefas, usando parser local como fallback');
            this.showToast('IA não encontrou tarefas, tentando parser local...', 'warning');
            newTasks = CommandParser.parse(text, this.store.people, this.store.projects);
          }
        } else {
          // IA não disponível (sem Electron/IPC) → fallback com aviso
          console.warn('⚠️ IA não disponível, usando parser local');
          this.showToast('⚠️ IA não disponível — usando parser local', 'warning');
          newTasks = CommandParser.parse(text, this.store.people, this.store.projects);
        }
      } catch (error) {
        // Erro na IA → fallback
        console.error('❌ Erro ao processar com IA:', error);
        this.showToast('Erro na IA, usando parser local como fallback...', 'warning');
        newTasks = CommandParser.parse(text, this.store.people, this.store.projects);
      } finally {
        // Restaurar botão
        btnProcess.disabled = false;
        btnIcon.textContent = '🤖';
        btnText.textContent = 'Processar com IA';
        btnProcess.style.opacity = '1';
      }

      if (newTasks.length === 0) {
        this.showToast('Nenhuma tarefa válida encontrada no texto', 'warning');
        return;
      }

      this.store.tasks.push(...newTasks);
      this.store.saveTasks();
      this.showToast(`✓ ${newTasks.length} tarefa(s) adicionada(s)`, 'success');

      input.value = '';
      this.renderTasksList();
    });

    // Clear commands
    document.getElementById('btn-clear-commands')?.addEventListener('click', () => {
      document.getElementById('command-input').value = '';
    });

    // Clear ALL tasks (para testes)
    document.getElementById('btn-clear-all-tasks')?.addEventListener('click', () => {
      if (!confirm('⚠️ ATENÇÃO: Isso vai APAGAR TODAS AS TAREFAS!\n\nEsta ação não pode ser desfeita.\n\nDeseja continuar?')) {
        return;
      }

      this.store.tasks = [];
      this.store.saveTasks();
      this.showToast('🗑️ Todas as tarefas foram removidas', 'success');
      this.renderTasksList();
    });

    // Import checklist - Browser version (file input)
    document.getElementById('btn-import-checklist')?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.txt';

      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target.result;
          const newTasks = CommandParser.parseMarkdown(content, this.store.people);

          if (newTasks.length === 0) {
            this.showToast('Nenhuma tarefa encontrada no arquivo', 'warning');
            return;
          }

          this.store.tasks.push(...newTasks);
          this.store.saveTasks();
          this.showToast(`✓ ${newTasks.length} tarefa(s) importada(s)`, 'success');
          this.renderTasksList();
        };

        reader.readAsText(file);
      };

      input.click();
    });

    // Capture screen
    document.getElementById('btn-capture-screen')?.addEventListener('click', async () => {
      if (!window.AIBridge || !window.AIBridge.isAvailable()) {
        this.showToast('IA não disponível', 'error');
        return;
      }
      const image = await window.AIBridge.captureScreen();
      if (image) {
        const [header, base64Data] = image.split(',');
        const mimeType = header.match(/:(.*?);/)?.[1] || 'image/png';
        await this.processImageForTasks(base64Data, mimeType);
      } else {
        this.showToast('Erro ao capturar tela', 'error');
      }
    });

    // Toggle manual form
    document.getElementById('btn-toggle-form')?.addEventListener('click', () => {
      const form = document.getElementById('manual-form');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('btn-close-form')?.addEventListener('click', () => {
      document.getElementById('manual-form').style.display = 'none';
    });

    // Add task manually
    document.getElementById('btn-add-task')?.addEventListener('click', () => {
      const description = document.getElementById('task-description').value.trim();

      if (!description) {
        this.showToast('Descrição é obrigatória', 'warning');
        return;
      }

      const person = document.getElementById('task-person').value;
      const date = document.getElementById('task-date').value;
      const priority = document.getElementById('task-priority').value;
      const project = document.getElementById('task-project').value;
      const tags = document.getElementById('task-tags').value
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const newTask = {
        id: Date.now(),
        description,
        person,
        date,
        priority,
        completed: false,
        createdAt: new Date().toISOString(),
        project: project || undefined,
        tags: tags.length > 0 ? tags : undefined
      };

      this.store.tasks.push(newTask);
      this.store.saveTasks();
      this.showToast('✓ Tarefa adicionada', 'success');

      // Reset form
      document.getElementById('task-description').value = '';
      document.getElementById('task-tags').value = '';
      document.getElementById('manual-form').style.display = 'none';

      this.renderTasksList();
    });

    // Filters
    ['filter-person', 'filter-date', 'filter-priority', 'filter-completed', 'filter-sprint'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', (e) => {
        const filterName = id.replace('filter-', '');
        this.filters[filterName] = e.target.value;
        this.renderTasksList();
      });
    });

    document.getElementById('filter-search')?.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.renderTasksList();
    });
  }

  attachTaskCardListeners() {
    // Toggle completion
    document.querySelectorAll('.task-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const card = e.target.closest('.task-card');
        const taskId = parseFloat(card.dataset.taskId);

        const task = this.store.tasks.find(t => t.id === taskId);
        if (task) {
          task.completed = e.target.checked;
          this.store.saveTasks();
          this.renderTasksList();
        }
      });
    });

    // Delete task
    document.querySelectorAll('.task-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (!confirm('Deletar esta tarefa?')) return;

        const card = e.target.closest('.task-card');
        const taskId = parseFloat(card.dataset.taskId);

        this.store.tasks = this.store.tasks.filter(t => t.id !== taskId);
        this.store.saveTasks();
        this.showToast('Tarefa deletada', 'success');
        this.renderTasksList();
      });
    });

    // Edit task date
    document.querySelectorAll('.task-date-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.task-card');
        const taskId = parseFloat(card.dataset.taskId);
        this.editTaskDate(taskId);
      });
    });

    // Edit task
    document.querySelectorAll('.task-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.task-card');
        const taskId = parseFloat(card.dataset.taskId);
        const task = this.store.tasks.find(t => t.id === taskId);
        if (task) this.showEditTaskModal(task);
      });
    });

    // Assign task to sprint
    document.querySelectorAll('.task-sprint-assign').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const card = e.target.closest('.task-card');
        const taskId = parseFloat(card.dataset.taskId);
        this.assignTaskToSprint(taskId);
      });
    });

    // Drag & Drop reordering
    let draggedTaskId = null;
    document.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedTaskId = parseFloat(card.dataset.taskId);
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        draggedTaskId = null;
        document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      });
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });
      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        if (draggedTaskId === null) return;
        const targetId = parseFloat(card.dataset.taskId);
        if (draggedTaskId === targetId) return;

        const dragIdx = this.store.tasks.findIndex(t => t.id === draggedTaskId);
        const targetIdx = this.store.tasks.findIndex(t => t.id === targetId);
        if (dragIdx < 0 || targetIdx < 0) return;

        const [draggedTask] = this.store.tasks.splice(dragIdx, 1);
        this.store.tasks.splice(targetIdx, 0, draggedTask);
        this.store.tasks.forEach((t, i) => t.order = i);
        this.store.saveTasks();
        this.renderTasksList();
      });
    });
  }

  // ============================================================================
  // SPRINTS TAB
  // ============================================================================

  renderSprintsTab(container) {
    const activeSprint = this.store.getActiveSprint();
    const planningSprints = this.store.sprints.filter(s => s.status === 'planning');
    const completedSprints = this.store.sprints.filter(s => s.status === 'completed');

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Header -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Sprints</h3>
            <button id="btn-toggle-sprint-form" class="btn btn-primary btn-sm">+ Novo Sprint</button>
          </div>
        </div>

        <!-- Sprint Creation Form (hidden) -->
        <div id="sprint-form" class="card" style="display: none;">
          <h3 class="card-title">Criar Novo Sprint</h3>
          <div class="form-grid">
            <div class="form-group form-span-2">
              <label>Nome do Sprint</label>
              <input type="text" id="sprint-name" class="form-input" placeholder="Ex: Sprint 1 - Fevereiro">
            </div>
            <div class="form-group">
              <label>Tipo de Sprint</label>
              <select id="sprint-type" class="form-input">
                <option value="1-week">1 Semana</option>
                <option value="2-weeks" selected>2 Semanas</option>
                <option value="1-month">1 Mes</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            <div class="form-group">
              <label>Data Inicio</label>
              <input type="date" id="sprint-start" class="form-input" value="${new Date().toISOString().split('T')[0]}">
            </div>
            <div class="form-group">
              <label>Data Fim</label>
              <input type="date" id="sprint-end" class="form-input" disabled>
            </div>
            <div class="form-group form-span-2">
              <label>Objetivo (opcional)</label>
              <input type="text" id="sprint-goals" class="form-input" placeholder="Ex: Entregar funcionalidades X, Y e Z">
            </div>
          </div>
          <div class="button-group" style="margin-top: 1rem;">
            <button id="btn-create-sprint" class="btn btn-success">Criar Sprint</button>
            <button id="btn-cancel-sprint" class="btn">Cancelar</button>
          </div>
        </div>

        <!-- Active Sprint -->
        ${activeSprint ? this.renderActiveSprintCard(activeSprint) : `
          <div class="card" style="text-align:center; padding: 2rem;">
            <p style="color: var(--color-text-secondary); font-size: 0.9375rem;">Nenhum sprint ativo no momento</p>
            <p style="color: var(--color-text-muted); font-size: 0.8125rem; margin-top: 0.375rem;">Crie um sprint e ative-o para acompanhar o progresso</p>
          </div>
        `}

        <!-- Planning Sprints -->
        ${planningSprints.length > 0 ? `
          <div class="card">
            <h3 class="card-title">Em Planejamento</h3>
            <div class="sprints-list">
              ${planningSprints.map(s => this.renderSprintCard(s)).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Completed Sprints -->
        ${completedSprints.length > 0 ? `
          <div class="card">
            <h3 class="card-title">Concluídos</h3>
            <div class="sprints-list">
              ${completedSprints.map(s => this.renderSprintCard(s)).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;

    this.attachSprintListeners();
    this.setupSprintTypeListener();
  }

  renderActiveSprintCard(sprint) {
    const progress = this.store.getSprintProgress(sprint.id);
    const today = new Date();
    const endDate = new Date(sprint.endDate + 'T00:00:00');
    const startDate = new Date(sprint.startDate + 'T00:00:00');
    const totalDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    const daysLeft = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));

    return `
      <div class="card sprint-card sprint-active">
        <div class="card-header">
          <div>
            <h3 class="card-title">${this.escapeHtml(sprint.name)}</h3>
            <span class="sprint-status-badge sprint-status-active">Ativo</span>
          </div>
          <div class="button-group">
            <button class="btn btn-success btn-sm sprint-complete" data-sprint-id="${sprint.id}">Concluir</button>
            <button class="btn btn-sm sprint-edit" data-sprint-id="${sprint.id}">Editar</button>
          </div>
        </div>

        ${sprint.goals ? `<p class="sprint-goal">${this.escapeHtml(sprint.goals)}</p>` : ''}

        <div class="sprint-stats">
          <span>📅 ${this.formatDate(sprint.startDate)} - ${this.formatDate(sprint.endDate)}</span>
          <span>⏳ ${daysLeft} dia(s) restante(s)</span>
        </div>

        <div class="sprint-progress-container">
          <div class="sprint-progress-header">
            <span>${progress.completed} / ${progress.total} tarefas</span>
            <span>${progress.percentage}%</span>
          </div>
          <div class="sprint-progress-bar">
            <div class="sprint-progress-fill" style="width: ${progress.percentage}%"></div>
          </div>
        </div>

        ${progress.total > 0 ? `
          <div class="sprint-tasks-summary">
            ${this.store.getSprintTasks(sprint.id).slice(0, 5).map(t => `
              <div class="sprint-task-item ${t.completed ? 'sprint-task-done' : ''}">
                <span>${t.completed ? '✅' : '⬜'} ${this.escapeHtml(t.description)}</span>
                <span class="sprint-task-person">${this.escapeHtml(t.person)}</span>
              </div>
            `).join('')}
            ${progress.total > 5 ? `<p style="color:#94a3b8;font-size:0.8rem;margin-top:0.5rem;">... e mais ${progress.total - 5} tarefa(s)</p>` : ''}
          </div>
        ` : '<p style="color:#94a3b8;margin-top:0.5rem;">Nenhuma tarefa atribuida a este sprint</p>'}
      </div>
    `;
  }

  renderSprintCard(sprint) {
    const progress = this.store.getSprintProgress(sprint.id);
    const statusClass = sprint.status === 'planning' ? 'sprint-planning' : 'sprint-completed';
    const statusLabel = sprint.status === 'planning' ? 'Planejamento' : 'Concluido';

    return `
      <div class="sprint-card-item ${statusClass}" data-sprint-id="${sprint.id}">
        <div class="sprint-card-header">
          <div>
            <strong>${this.escapeHtml(sprint.name)}</strong>
            <span class="sprint-status-badge sprint-status-${sprint.status}">${statusLabel}</span>
          </div>
          <div class="button-group">
            ${sprint.status === 'planning' ? `<button class="btn btn-primary btn-sm sprint-activate" data-sprint-id="${sprint.id}">Ativar</button>` : ''}
            <button class="btn btn-sm sprint-edit" data-sprint-id="${sprint.id}">Editar</button>
            <button class="btn btn-danger btn-sm sprint-delete" data-sprint-id="${sprint.id}">Excluir</button>
          </div>
        </div>
        <div class="sprint-stats">
          <span>📅 ${this.formatDate(sprint.startDate)} - ${this.formatDate(sprint.endDate)}</span>
          <span>📊 ${progress.completed}/${progress.total} tarefas (${progress.percentage}%)</span>
        </div>
        ${sprint.goals ? `<p class="sprint-goal">${this.escapeHtml(sprint.goals)}</p>` : ''}
        <div class="sprint-progress-bar" style="margin-top:0.5rem;">
          <div class="sprint-progress-fill" style="width: ${progress.percentage}%"></div>
        </div>
      </div>
    `;
  }

  setupSprintTypeListener() {
    const typeSelect = document.getElementById('sprint-type');
    const startInput = document.getElementById('sprint-start');
    const endInput = document.getElementById('sprint-end');
    if (!typeSelect || !startInput || !endInput) return;

    const updateEndDate = () => {
      const type = typeSelect.value;
      const start = new Date(startInput.value + 'T00:00:00');

      if (type === 'custom') {
        endInput.disabled = false;
        return;
      }

      endInput.disabled = true;
      const daysMap = { '1-week': 7, '2-weeks': 14, '1-month': 30 };
      const days = daysMap[type] || 14;
      const end = new Date(start);
      end.setDate(end.getDate() + days);
      endInput.value = end.toISOString().split('T')[0];
    };

    typeSelect.addEventListener('change', updateEndDate);
    startInput.addEventListener('change', updateEndDate);
    updateEndDate(); // Initialize
  }

  attachSprintListeners() {
    // Toggle form
    document.getElementById('btn-toggle-sprint-form')?.addEventListener('click', () => {
      const form = document.getElementById('sprint-form');
      if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
    });

    // Cancel form
    document.getElementById('btn-cancel-sprint')?.addEventListener('click', () => {
      const form = document.getElementById('sprint-form');
      if (form) form.style.display = 'none';
    });

    // Create sprint
    document.getElementById('btn-create-sprint')?.addEventListener('click', () => {
      const name = document.getElementById('sprint-name')?.value?.trim();
      const type = document.getElementById('sprint-type')?.value;
      const startDate = document.getElementById('sprint-start')?.value;
      const endDate = document.getElementById('sprint-end')?.value;
      const goals = document.getElementById('sprint-goals')?.value?.trim();

      if (!name) {
        this.showToast('Preencha o nome do sprint', 'error');
        return;
      }
      if (!startDate || !endDate) {
        this.showToast('Preencha as datas do sprint', 'error');
        return;
      }

      const sprint = {
        id: Date.now() + Math.random(),
        name,
        type,
        startDate,
        endDate,
        goals: goals || '',
        taskIds: [],
        status: 'planning'
      };

      this.store.createSprint(sprint);
      this.showToast('Sprint criado!', 'success');
      this.renderSprintsTab(document.getElementById('tab-content'));
    });

    // Activate sprint
    document.querySelectorAll('.sprint-activate').forEach(btn => {
      btn.addEventListener('click', () => {
        const sprintId = parseFloat(btn.dataset.sprintId);

        // Check if there's already an active sprint
        const currentActive = this.store.getActiveSprint();
        if (currentActive) {
          if (!confirm(`O sprint "${currentActive.name}" está ativo. Deseja desativá-lo e ativar este?`)) return;
          currentActive.status = 'planning';
        }

        const sprint = this.store.getSprintById(sprintId);
        if (sprint) {
          sprint.status = 'active';
          this.store.currentSprintId = sprintId;
          this.store.saveSprints();
          this.showToast('Sprint ativado!', 'success');
          this.renderSprintsTab(document.getElementById('tab-content'));
        }
      });
    });

    // Complete sprint
    document.querySelectorAll('.sprint-complete').forEach(btn => {
      btn.addEventListener('click', () => {
        const sprintId = parseFloat(btn.dataset.sprintId);
        if (!confirm('Concluir este sprint?')) return;

        const sprint = this.store.getSprintById(sprintId);
        if (sprint) {
          sprint.status = 'completed';
          if (this.store.currentSprintId === sprintId) {
            this.store.currentSprintId = null;
          }
          this.store.saveSprints();
          this.showToast('Sprint concluido!', 'success');
          this.renderSprintsTab(document.getElementById('tab-content'));
        }
      });
    });

    // Edit sprint
    document.querySelectorAll('.sprint-edit').forEach(btn => {
      btn.addEventListener('click', async () => {
        const sprintId = parseFloat(btn.dataset.sprintId);
        const sprint = this.store.getSprintById(sprintId);
        if (!sprint) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
          <div class="modal-content" style="max-width:500px;">
            <div class="modal-header"><h3>Editar Sprint</h3></div>
            <div class="modal-body">
              <div class="form-group">
                <label>Nome</label>
                <input type="text" id="edit-sprint-name" class="form-input" value="${this.escapeHtml(sprint.name)}">
              </div>
              <div class="form-group">
                <label>Data Inicio</label>
                <input type="date" id="edit-sprint-start" class="form-input" value="${sprint.startDate}">
              </div>
              <div class="form-group">
                <label>Data Fim</label>
                <input type="date" id="edit-sprint-end" class="form-input" value="${sprint.endDate}">
              </div>
              <div class="form-group">
                <label>Objetivo</label>
                <input type="text" id="edit-sprint-goals" class="form-input" value="${this.escapeHtml(sprint.goals || '')}">
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-primary" id="modal-save-sprint">Salvar</button>
              <button class="btn" id="modal-cancel-sprint">Cancelar</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#modal-save-sprint').addEventListener('click', () => {
          sprint.name = document.getElementById('edit-sprint-name').value.trim() || sprint.name;
          sprint.startDate = document.getElementById('edit-sprint-start').value || sprint.startDate;
          sprint.endDate = document.getElementById('edit-sprint-end').value || sprint.endDate;
          sprint.goals = document.getElementById('edit-sprint-goals').value.trim();
          this.store.saveSprints();
          modal.remove();
          this.showToast('Sprint atualizado!', 'success');
          this.renderSprintsTab(document.getElementById('tab-content'));
        });

        modal.querySelector('#modal-cancel-sprint').addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
      });
    });

    // Delete sprint
    document.querySelectorAll('.sprint-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const sprintId = parseFloat(btn.dataset.sprintId);
        if (!confirm('Excluir este sprint? As tarefas nao serao removidas.')) return;

        this.store.sprints = this.store.sprints.filter(s => s.id !== sprintId);
        if (this.store.currentSprintId === sprintId) {
          this.store.currentSprintId = null;
        }
        this.store.saveSprints();
        this.showToast('Sprint excluido', 'success');
        this.renderSprintsTab(document.getElementById('tab-content'));
      });
    });
  }

  // ============================================================================
  // NOTES TAB (Brain Dump)
  // ============================================================================

  renderNotesTab(container) {
    const notes = [...this.store.quickNotes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    container.innerHTML = `
      <div class="space-y-6">
        <div class="card">
          <div class="card-header">
            <h3>Anotações Rápidas</h3>
            <button id="btn-new-note" class="btn btn-primary">+ Nova Anotação</button>
          </div>

          <div id="note-editor" style="display:none; margin-top:1rem;">
            <textarea id="note-content" class="edit-modal-textarea" rows="6" placeholder="Digite sua anotação aqui... Ideias, rascunhos, brain dump..."></textarea>
            <div style="display:flex; gap:0.75rem; margin-top:0.75rem; align-items:center;">
              <input type="text" id="note-tags-input" class="edit-modal-input" placeholder="Tags (separadas por vírgula)" style="flex:1">
              <button id="btn-save-note" class="btn btn-success">Salvar</button>
              <button id="btn-cancel-note" class="btn btn-secondary">Cancelar</button>
            </div>
          </div>
        </div>

        <div id="notes-list">
          ${notes.length === 0 ? `
            <div class="card empty-state">
              <p style="font-size:1.25rem">📝 Nenhuma anotação ainda</p>
              <p style="color:#64748b; margin-top:0.5rem">Use este espaço para brain dumps, ideias rápidas e rascunhos.</p>
              <p style="color:#64748b; font-size:0.875rem; margin-top:0.25rem">Ctrl+V para colar texto, ou clique em "+ Nova Anotação"</p>
            </div>
          ` : notes.map(note => `
            <div class="card note-card" data-note-id="${note.id}" style="margin-bottom:1rem;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <span style="font-size:0.8125rem; color:#64748b;">${this.formatNoteDate(note.updatedAt)}</span>
                <div style="display:flex; gap:0.25rem;">
                  <button class="note-edit btn-icon" title="Editar">✏️</button>
                  <button class="note-delete btn-icon" title="Deletar">🗑️</button>
                </div>
              </div>
              <div style="margin-top:0.5rem; line-height:1.6; white-space:pre-wrap;">${this.escapeHtml(note.content)}</div>
              ${note.tags && note.tags.length > 0 ? `
                <div style="margin-top:0.75rem; display:flex; gap:0.375rem; flex-wrap:wrap;">
                  ${note.tags.map(t => `<span class="tag tag-tag">#${this.escapeHtml(t)}</span>`).join('')}
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.attachNotesListeners();
  }

  formatNoteDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Agora mesmo';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} min atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  attachNotesListeners() {
    let editingNoteId = null;

    const showEditor = (content = '', tags = '') => {
      const editor = document.getElementById('note-editor');
      editor.style.display = 'block';
      document.getElementById('note-content').value = content;
      document.getElementById('note-tags-input').value = tags;
      document.getElementById('note-content').focus();
    };

    const hideEditor = () => {
      document.getElementById('note-editor').style.display = 'none';
      document.getElementById('note-content').value = '';
      document.getElementById('note-tags-input').value = '';
      editingNoteId = null;
    };

    document.getElementById('btn-new-note')?.addEventListener('click', () => {
      editingNoteId = null;
      showEditor();
    });

    document.getElementById('btn-cancel-note')?.addEventListener('click', hideEditor);

    document.getElementById('btn-save-note')?.addEventListener('click', () => {
      const content = document.getElementById('note-content').value.trim();
      if (!content) { this.showToast('Conteúdo não pode estar vazio', 'warning'); return; }
      const tags = document.getElementById('note-tags-input').value.split(',').map(t => t.trim()).filter(t => t);
      const now = new Date().toISOString();

      if (editingNoteId) {
        const note = this.store.quickNotes.find(n => n.id === editingNoteId);
        if (note) { note.content = content; note.tags = tags; note.updatedAt = now; }
      } else {
        this.store.quickNotes.push({ id: Date.now(), content, tags, createdAt: now, updatedAt: now });
      }

      this.store.saveQuickNotes();
      this.showToast('✓ Anotação salva', 'success');
      this.renderNotesTab(document.getElementById('tab-content'));
    });

    document.querySelectorAll('.note-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (!confirm('Deletar esta anotação?')) return;
        const noteId = parseFloat(e.target.closest('.note-card').dataset.noteId);
        this.store.quickNotes = this.store.quickNotes.filter(n => n.id !== noteId);
        this.store.saveQuickNotes();
        this.showToast('Anotação deletada', 'success');
        this.renderNotesTab(document.getElementById('tab-content'));
      });
    });

    document.querySelectorAll('.note-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const noteId = parseFloat(e.target.closest('.note-card').dataset.noteId);
        const note = this.store.quickNotes.find(n => n.id === noteId);
        if (!note) return;
        editingNoteId = noteId;
        showEditor(note.content, (note.tags || []).join(', '));
      });
    });
  }

  // ============================================================================
  // TORRE DE COMANDO TAB (PMO Dashboard)
  // ============================================================================

  renderTorreDeComandoTab(container) {
    const impl = this.store.projectsImpl;
    const ongoing = this.store.projectsOngoing;
    const today = new Date().toISOString().split('T')[0];

    // Calculate KPIs
    const totalImpl = impl.filter(p => p.status !== 'Cancelado').length;
    const onTime = impl.filter(p => p.status === 'Concluído' || (p.status === 'Em andamento' && p.prazoRevisado >= today)).length;
    const delayed = impl.filter(p => p.status === 'Atrasado').length;
    const pctOnTime = totalImpl > 0 ? ((onTime / totalImpl) * 100).toFixed(1) : 0;

    const csatRatings = impl.filter(p => p.notaCsat && p.notaCsat > 0).map(p => p.notaCsat);
    const avgCsat = csatRatings.length > 0 ? (csatRatings.reduce((a, b) => a + b, 0) / csatRatings.length).toFixed(1) : '-';

    const churned = ongoing.filter(p => p.status === 'Churn').length;
    const totalOngoing = ongoing.length;
    const churnPct = totalOngoing > 0 ? ((churned / totalOngoing) * 100).toFixed(1) : 0;

    // Group by responsible
    const responsaveis = {};
    impl.forEach(p => {
      if (!p.responsavel) return;
      if (!responsaveis[p.responsavel]) responsaveis[p.responsavel] = { total: 0, onTime: 0, delayed: 0, completed: 0 };
      responsaveis[p.responsavel].total++;
      if (p.status === 'Concluído') responsaveis[p.responsavel].completed++;
      if (p.status === 'Atrasado') responsaveis[p.responsavel].delayed++;
      else responsaveis[p.responsavel].onTime++;
    });

    // Upcoming deliveries (next 14 days)
    const in14Days = new Date(); in14Days.setDate(in14Days.getDate() + 14);
    const upcoming = impl.filter(p => p.prazoRevisado && p.prazoRevisado >= today && p.prazoRevisado <= in14Days.toISOString().split('T')[0] && p.status !== 'Concluído');

    // Delayed projects
    const delayedProjects = impl.filter(p => p.status === 'Atrasado');

    // Status counts for chart
    const statusCounts = { 'Concluído': 0, 'Em andamento': 0, 'Atrasado': 0, 'A iniciar': 0 };
    impl.forEach(p => { if (statusCounts[p.status] !== undefined) statusCounts[p.status]++; });

    // Flag counts for ongoing
    const flagCounts = { 'Safe': 0, 'Care': 0, 'Danger': 0, 'Critical': 0 };
    ongoing.forEach(p => { if (p.flag && flagCounts[p.flag] !== undefined) flagCounts[p.flag]++; });

    container.innerHTML = `
      <div class="space-y-6">
        <!-- KPI Cards -->
        <div class="card-grid">
          <div class="stat-card ${parseFloat(pctOnTime) >= 90 ? 'stat-green' : parseFloat(pctOnTime) >= 70 ? 'stat-yellow' : 'stat-red'}">
            <div class="stat-label">Projetos no Prazo</div>
            <div class="stat-value">${pctOnTime}%</div>
            <div class="stat-sub">Meta: 90% | ${onTime} de ${totalImpl}</div>
          </div>
          <div class="stat-card ${avgCsat !== '-' && parseFloat(avgCsat) >= 4 ? 'stat-green' : 'stat-yellow'}">
            <div class="stat-label">CSAT Médio</div>
            <div class="stat-value">${avgCsat}</div>
            <div class="stat-sub">Meta: >= 4.0 | ${csatRatings.length} avaliações</div>
          </div>
          <div class="stat-card ${parseFloat(churnPct) < 6 ? 'stat-green' : 'stat-red'}">
            <div class="stat-label">Churn Rate</div>
            <div class="stat-value">${churnPct}%</div>
            <div class="stat-sub">Meta: < 6% | ${churned} de ${totalOngoing}</div>
          </div>
          <div class="stat-card stat-blue">
            <div class="stat-label">Projetos Ativos</div>
            <div class="stat-value">${impl.filter(p => p.status === 'Em andamento').length}</div>
            <div class="stat-sub">${delayed} atrasados</div>
          </div>
        </div>

        <!-- Charts Section -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
          <div class="card">
            <h3 class="card-title">Status dos Projetos</h3>
            <canvas id="chart-status" width="400" height="280"></canvas>
          </div>
          <div class="card">
            <h3 class="card-title">Projetos por Responsável</h3>
            <canvas id="chart-responsaveis" width="400" height="280"></canvas>
          </div>
        </div>

        <!-- Responsáveis Table -->
        <div class="card">
          <div class="card-header">
            <h3>Responsáveis</h3>
          </div>
          <table class="torre-table">
            <thead>
              <tr><th>Status</th><th>Nome</th><th>Projetos</th><th>% No Prazo</th></tr>
            </thead>
            <tbody>
              ${Object.entries(responsaveis).sort((a, b) => b[1].total - a[1].total).map(([name, data]) => {
                const pct = data.total > 0 ? Math.round((data.onTime / data.total) * 100) : 100;
                const emoji = pct >= 80 ? '🟢' : pct >= 50 ? '🟡' : '🔴';
                return `<tr><td>${emoji}</td><td>${this.escapeHtml(name)}</td><td>${data.total}</td><td>${pct}%</td></tr>`;
              }).join('')}
              ${Object.keys(responsaveis).length === 0 ? '<tr><td colspan="4" style="text-align:center;color:#64748b;">Nenhum projeto cadastrado</td></tr>' : ''}
            </tbody>
          </table>
        </div>

        <!-- Upcoming & Delayed -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
          <div class="card">
            <h3 class="card-title">Próximas Entregas (14 dias)</h3>
            <table class="torre-table">
              <thead><tr><th>Cliente</th><th>Projeto</th><th>Responsável</th><th>Prazo</th><th></th></tr></thead>
              <tbody>
                ${upcoming.map(p => `<tr class="torre-row-clickable" data-impl-id="${p.id}"><td>${this.escapeHtml(p.cliente || '')}</td><td>${this.escapeHtml(p.tipo || '')}</td><td>${this.escapeHtml(p.responsavel || '')}</td><td>${p.prazoRevisado || ''}</td><td><button class="btn-icon btn-edit-impl" data-impl-id="${p.id}" title="Editar">✏️</button></td></tr>`).join('')}
                ${upcoming.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#64748b;">Nenhuma entrega próxima</td></tr>' : ''}
              </tbody>
            </table>
          </div>
          <div class="card">
            <h3 class="card-title">Projetos Atrasados</h3>
            <table class="torre-table">
              <thead><tr><th>Cliente</th><th>Projeto</th><th>Responsável</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${delayedProjects.map(p => `<tr class="torre-row-clickable" data-impl-id="${p.id}"><td>${this.escapeHtml(p.cliente || '')}</td><td>${this.escapeHtml(p.tipo || '')}</td><td>${this.escapeHtml(p.responsavel || '')}</td><td><span class="torre-badge torre-badge-red">Atrasado</span></td><td><button class="btn-icon btn-edit-impl" data-impl-id="${p.id}" title="Editar">✏️</button></td></tr>`).join('')}
                ${delayedProjects.length === 0 ? '<tr><td colspan="5" style="text-align:center;color:#64748b;">Nenhum projeto atrasado</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>

        <!-- On Going -->
        <div class="card">
          <div class="card-header">
            <h3>Recorrências (On Going)</h3>
            <div style="display:flex; gap:0.5rem;">
              <span class="torre-badge torre-badge-green">Safe ${flagCounts.Safe}</span>
              <span class="torre-badge torre-badge-yellow">Care ${flagCounts.Care}</span>
              <span class="torre-badge torre-badge-orange">Danger ${flagCounts.Danger}</span>
              <span class="torre-badge torre-badge-red">Critical ${flagCounts.Critical}</span>
            </div>
          </div>
          <table class="torre-table">
            <thead><tr><th>Cliente</th><th>Tipo</th><th>Responsável</th><th>Valor</th><th>Flag</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${ongoing.sort((a, b) => {
                const order = { Critical: 0, Danger: 1, Care: 2, Safe: 3 };
                return (order[a.flag] ?? 4) - (order[b.flag] ?? 4);
              }).map(p => {
                const flagClass = { Safe: 'torre-badge-green', Care: 'torre-badge-yellow', Danger: 'torre-badge-orange', Critical: 'torre-badge-red' }[p.flag] || '';
                return `<tr class="torre-row-clickable" data-ongoing-id="${p.id}">
                  <td>${this.escapeHtml(p.cliente || '')}</td>
                  <td>${this.escapeHtml(p.tipo || '')}</td>
                  <td>${this.escapeHtml(p.responsavel || '')}</td>
                  <td>${p.valor ? 'R$ ' + parseFloat(p.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}</td>
                  <td><span class="torre-badge ${flagClass}">${this.escapeHtml(p.flag || '-')}</span></td>
                  <td>${this.escapeHtml(p.status || '')}</td>
                  <td><button class="btn-icon btn-edit-ongoing" data-ongoing-id="${p.id}" title="Editar">✏️</button></td>
                </tr>`;
              }).join('')}
              ${ongoing.length === 0 ? '<tr><td colspan="7" style="text-align:center;color:#64748b;">Nenhuma recorrência cadastrada</td></tr>' : ''}
            </tbody>
          </table>
        </div>

        <!-- Google Sheets Sync -->
        <div class="card">
          <div class="card-header">
            <h3>Google Sheets</h3>
            <span id="sheets-status" class="torre-badge torre-badge-care" style="font-size:0.75rem;">Verificando...</span>
          </div>
          <p style="color:#64748b;font-size:0.85rem;margin:0.5rem 0 1rem;">Sincronize dados entre o Brainiac e a planilha Google Sheets. Edite projetos acima e envie as alteracoes.</p>
          <div class="button-group" style="margin-top:0.5rem;">
            <button id="btn-sheets-pull" class="btn btn-primary" title="Baixar dados da planilha para o app">Puxar da Planilha</button>
            <button id="btn-sheets-push" class="btn btn-success" title="Enviar alteracoes do app para a planilha">Enviar para Planilha</button>
          </div>
          <div id="sheets-sync-msg" style="margin-top:0.75rem;display:none;"></div>
        </div>

        <!-- Actions -->
        <div class="card">
          <div class="card-header">
            <h3>Gerenciar Projetos</h3>
          </div>
          <div class="button-group" style="margin-top:1rem;">
            <button id="btn-add-impl" class="btn btn-primary">+ Projeto Implementação</button>
            <button id="btn-add-ongoing" class="btn btn-success">+ Recorrência</button>
            <button id="btn-import-torre" class="btn btn-purple">📥 Importar CSV/TSV</button>
          </div>
        </div>
      </div>
    `;

    // Draw charts
    this.drawStatusPieChart(statusCounts);
    this.drawResponsaveisBarChart(responsaveis);

    // Attach listeners
    this.attachTorreListeners();
  }

  drawStatusPieChart(data) {
    const canvas = document.getElementById('chart-status');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const cx = w * 0.4, cy = h / 2, r = Math.min(cx, cy) - 20;

    const colors = { 'Concluído': '#22c55e', 'Em andamento': '#3b82f6', 'Atrasado': '#ef4444', 'A iniciar': '#94a3b8' };
    const total = Object.values(data).reduce((a, b) => a + b, 0);
    if (total === 0) { ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Sem dados', cx, cy); return; }

    let startAngle = -Math.PI / 2;
    const entries = Object.entries(data).filter(([, v]) => v > 0);

    entries.forEach(([label, value]) => {
      const sliceAngle = (value / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, startAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = colors[label] || '#94a3b8';
      ctx.fill();
      startAngle += sliceAngle;
    });

    // Legend
    let ly = 20;
    entries.forEach(([label, value]) => {
      const lx = w * 0.75;
      ctx.fillStyle = colors[label] || '#94a3b8';
      ctx.fillRect(lx, ly, 14, 14);
      ctx.fillStyle = '#1e293b';
      ctx.font = '13px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${label}: ${value}`, lx + 20, ly + 12);
      ly += 24;
    });
  }

  drawResponsaveisBarChart(data) {
    const canvas = document.getElementById('chart-responsaveis');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;

    const entries = Object.entries(data).sort((a, b) => b[1].total - a[1].total).slice(0, 8);
    if (entries.length === 0) { ctx.fillStyle = '#94a3b8'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Sem dados', w / 2, h / 2); return; }

    const maxVal = Math.max(...entries.map(([, d]) => d.total));
    const barH = Math.min(28, (h - 40) / entries.length - 4);
    const chartLeft = 120, chartRight = w - 20;
    const chartWidth = chartRight - chartLeft;

    entries.forEach(([name, d], i) => {
      const y = 20 + i * (barH + 6);
      const barW = maxVal > 0 ? (d.total / maxVal) * chartWidth : 0;

      // Name
      ctx.fillStyle = '#1e293b';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(name.length > 14 ? name.substring(0, 14) + '…' : name, chartLeft - 8, y + barH / 2 + 4);

      // On time portion
      const onTimeW = maxVal > 0 ? (d.onTime / maxVal) * chartWidth : 0;
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(chartLeft, y, onTimeW, barH);

      // Delayed portion
      const delayedW = maxVal > 0 ? (d.delayed / maxVal) * chartWidth : 0;
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(chartLeft + onTimeW, y, delayedW, barH);

      // Count label
      ctx.fillStyle = '#1e293b';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(d.total.toString(), chartLeft + barW + 6, y + barH / 2 + 4);
    });
  }

  attachTorreListeners() {
    document.getElementById('btn-add-impl')?.addEventListener('click', () => this.showImplProjectModal());
    document.getElementById('btn-add-ongoing')?.addEventListener('click', () => this.showOngoingProjectModal());
    document.getElementById('btn-import-torre')?.addEventListener('click', () => this.importTorreCSV());

    // Google Sheets sync
    document.getElementById('btn-sheets-pull')?.addEventListener('click', () => this.sheetsSyncPull());
    document.getElementById('btn-sheets-push')?.addEventListener('click', () => this.sheetsSyncPush());
    this.checkSheetsStatus();

    // Edit buttons - Implementacao
    document.querySelectorAll('.btn-edit-impl').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.implId);
        const project = this.store.projectsImpl.find(p => p.id === id);
        if (project) this.showImplProjectModal(project);
      });
    });

    // Edit buttons - Ongoing
    document.querySelectorAll('.btn-edit-ongoing').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.ongoingId);
        const project = this.store.projectsOngoing.find(p => p.id === id);
        if (project) this.showOngoingProjectModal(project);
      });
    });

    // Row click - Implementacao
    document.querySelectorAll('.torre-row-clickable[data-impl-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-icon')) return;
        const id = parseInt(row.dataset.implId);
        const project = this.store.projectsImpl.find(p => p.id === id);
        if (project) this.showImplProjectModal(project);
      });
    });

    // Row click - Ongoing
    document.querySelectorAll('.torre-row-clickable[data-ongoing-id]').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.btn-icon')) return;
        const id = parseInt(row.dataset.ongoingId);
        const project = this.store.projectsOngoing.find(p => p.id === id);
        if (project) this.showOngoingProjectModal(project);
      });
    });
  }

  async checkSheetsStatus() {
    const statusEl = document.getElementById('sheets-status');
    if (!statusEl) return;
    if (!window.SheetsBridge || !window.SheetsBridge.isAvailable()) {
      statusEl.textContent = 'Indisponível';
      statusEl.className = 'torre-badge torre-badge-danger';
      return;
    }
    const config = await window.SheetsBridge.checkConfig();
    if (config.configured) {
      statusEl.textContent = config.connected ? 'Conectado' : 'Configurado';
      statusEl.className = 'torre-badge torre-badge-safe';
    } else {
      statusEl.textContent = 'Não configurado';
      statusEl.className = 'torre-badge torre-badge-danger';
    }
  }

  showSheetsSyncMsg(text, type = 'info') {
    const el = document.getElementById('sheets-sync-msg');
    if (!el) return;
    const colors = { info: '#3b82f6', success: '#22c55e', error: '#ef4444', warn: '#f59e0b' };
    el.style.display = 'block';
    el.style.color = colors[type] || '#64748b';
    el.style.fontSize = '0.85rem';
    el.textContent = text;
  }

  async sheetsSyncPush() {
    if (!window.SheetsBridge) return;
    const btn = document.getElementById('btn-sheets-push');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
    this.showSheetsSyncMsg('Enviando alteracoes para o Google Sheets...', 'info');

    try {
      const dirtyImpl = this.store.projectsImpl.filter(p => p._dirty);
      const dirtyOngoing = this.store.projectsOngoing.filter(p => p._dirty);

      if (dirtyImpl.length === 0 && dirtyOngoing.length === 0) {
        this.showSheetsSyncMsg('Nenhuma alteracao pendente para enviar.', 'info');
        if (btn) { btn.disabled = false; btn.textContent = 'Enviar para Planilha'; }
        return;
      }

      const result = await window.SheetsBridge.syncPush(this.store.projectsImpl, this.store.projectsOngoing);
      if (result.success || result.implUpdated !== undefined) {
        const total = (result.implUpdated || 0) + (result.implAdded || 0) + (result.ongoingUpdated || 0) + (result.ongoingAdded || 0);
        // Limpar dirty flags
        this.store.projectsImpl.forEach(p => p._dirty = false);
        this.store.projectsOngoing.forEach(p => p._dirty = false);
        this.store.saveProjectsImpl();
        this.store.saveProjectsOngoing();
        this.store.syncMeta.lastPush = new Date().toISOString();
        this.store.saveSyncMeta();
        this.showSheetsSyncMsg(`✅ ${total} projeto(s) enviado(s) para a planilha`, 'success');
      } else {
        this.showSheetsSyncMsg('❌ ' + (result.error || 'Falha ao enviar'), 'error');
      }
    } catch (error) {
      this.showSheetsSyncMsg('❌ ' + error.message, 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Enviar para Planilha'; }
  }

  async sheetsSyncPull() {
    if (!window.SheetsBridge) return;
    const btn = document.getElementById('btn-sheets-pull');
    if (btn) { btn.disabled = true; btn.textContent = 'Sincronizando...'; }
    this.showSheetsSyncMsg('Conectando ao Google Sheets...', 'info');

    try {
      const result = await window.SheetsBridge.syncPull();
      if (result.success) {
        this.store.projectsImpl = result.projectsImpl;
        this.store.projectsOngoing = result.projectsOngoing;
        if (result.npsData) {
          this.store.npsData = result.npsData;
          this.store.saveNpsData();
        }
        this.store.saveProjectsImpl();
        this.store.saveProjectsOngoing();
        this.store.syncMeta.lastPull = new Date().toISOString();
        this.store.saveSyncMeta();

        let msg = `✅ ${result.projectsImpl.length} projetos impl + ${result.projectsOngoing.length} recorrências`;
        if (result.npsData && result.npsData.length > 0) {
          msg += ` + ${result.npsData.length} NPS`;
        }
        if (result.warnings && result.warnings.length > 0) {
          msg += ' | ⚠ ' + result.warnings.join(', ');
        }
        this.showSheetsSyncMsg(msg, result.warnings?.length ? 'warn' : 'success');

        // Re-render para mostrar dados atualizados
        setTimeout(() => this.renderTorreDeComandoTab(document.getElementById('tab-content')), 800);
      } else {
        this.showSheetsSyncMsg('❌ ' + (result.error || 'Falha ao sincronizar'), 'error');
      }
    } catch (error) {
      this.showSheetsSyncMsg('❌ ' + error.message, 'error');
    }
    if (btn) { btn.disabled = false; btn.textContent = '🔄 Sincronizar com Planilha'; }
  }

  showImplProjectModal(project = null) {
    const isEdit = !!project;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const statusOptions = ['A iniciar', 'Em andamento', 'Concluído', 'Atrasado', 'Cancelado'];
    const tipoOptions = ['CRM Sales', 'CRM Marketing', 'E-commerce', 'Site Institucional', 'IA SDR', 'Solução Interna', 'Dashboard Mídia', 'Dashboard Completo', 'Dashboard Personalizado', 'Auditoria CRM'];

    overlay.innerHTML = `
      <div class="edit-modal-content">
        <div class="edit-modal-header">
          <h3>${isEdit ? 'Editar' : 'Novo'} Projeto de Implementação</h3>
          <button class="edit-modal-close btn-icon">✕</button>
        </div>
        <div class="edit-modal-body">
          <div class="edit-modal-row">
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Cliente</label>
              <input type="text" id="impl-cliente" class="edit-modal-input" value="${this.escapeHtml(project?.cliente || '')}">
            </div>
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Valor (R$)</label>
              <input type="number" id="impl-valor" class="edit-modal-input" step="0.01" value="${project?.valor || ''}">
            </div>
          </div>
          <div class="edit-modal-row">
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Tipo</label>
              <select id="impl-tipo" class="edit-modal-select">
                ${tipoOptions.map(t => `<option value="${t}" ${project?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Responsável</label>
              <select id="impl-responsavel" class="edit-modal-select">
                ${this.store.people.map(p => `<option value="${p}" ${project?.responsavel === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="edit-modal-row">
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Status</label>
              <select id="impl-status" class="edit-modal-select">
                ${statusOptions.map(s => `<option value="${s}" ${project?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Quarter</label>
              <input type="text" id="impl-quarter" class="edit-modal-input" placeholder="Q1/2026" value="${this.escapeHtml(project?.quarter || '')}">
            </div>
          </div>
          <div class="edit-modal-row">
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Data Início</label>
              <input type="date" id="impl-data-inicio" class="edit-modal-input" value="${project?.dataInicio || ''}">
            </div>
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Prazo Original</label>
              <input type="date" id="impl-prazo-original" class="edit-modal-input" value="${project?.prazoOriginal || ''}">
            </div>
          </div>
          <div class="edit-modal-row">
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Prazo Revisado</label>
              <input type="date" id="impl-prazo-revisado" class="edit-modal-input" value="${project?.prazoRevisado || ''}">
            </div>
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Data Entrega Real</label>
              <input type="date" id="impl-data-entrega" class="edit-modal-input" value="${project?.dataEntregaReal || ''}">
            </div>
          </div>
          <div class="edit-modal-section">
            <label class="edit-modal-label">Motivo Atraso</label>
            <textarea id="impl-motivo" class="edit-modal-textarea" rows="2">${this.escapeHtml(project?.motivoAtraso || '')}</textarea>
          </div>
          <div class="edit-modal-row">
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Nota CSAT</label>
              <input type="number" id="impl-csat" class="edit-modal-input" min="1" max="5" step="0.1" value="${project?.notaCsat || ''}">
            </div>
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Feedback CSAT</label>
              <input type="text" id="impl-feedback" class="edit-modal-input" value="${this.escapeHtml(project?.feedbackCsat || '')}">
            </div>
          </div>
        </div>
        <div class="edit-modal-footer">
          <button class="btn btn-secondary" id="impl-cancel">Cancelar</button>
          <button class="btn btn-primary" id="impl-save">Salvar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.edit-modal-close').addEventListener('click', close);
    overlay.querySelector('#impl-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('#impl-save').addEventListener('click', () => {
      const data = {
        id: project?.id || Date.now(),
        cliente: overlay.querySelector('#impl-cliente').value.trim(),
        valor: parseFloat(overlay.querySelector('#impl-valor').value) || 0,
        tipo: overlay.querySelector('#impl-tipo').value,
        responsavel: overlay.querySelector('#impl-responsavel').value,
        status: overlay.querySelector('#impl-status').value,
        quarter: overlay.querySelector('#impl-quarter').value.trim(),
        dataInicio: overlay.querySelector('#impl-data-inicio').value,
        prazoOriginal: overlay.querySelector('#impl-prazo-original').value,
        prazoRevisado: overlay.querySelector('#impl-prazo-revisado').value,
        dataEntregaReal: overlay.querySelector('#impl-data-entrega').value,
        motivoAtraso: overlay.querySelector('#impl-motivo').value.trim(),
        notaCsat: parseFloat(overlay.querySelector('#impl-csat').value) || 0,
        feedbackCsat: overlay.querySelector('#impl-feedback').value.trim(),
        links: project?.links || {}
      };

      if (!data.cliente) { this.showToast('Cliente é obrigatório', 'warning'); return; }

      if (isEdit) {
        data._dirty = true;
        data._rowIndex = project._rowIndex;
        data._sheetName = project._sheetName;
        const idx = this.store.projectsImpl.findIndex(p => p.id === project.id);
        if (idx >= 0) this.store.projectsImpl[idx] = data;
      } else {
        data._dirty = true;
        this.store.projectsImpl.push(data);
      }

      this.store.saveProjectsImpl();
      close();
      this.renderTorreDeComandoTab(document.getElementById('tab-content'));

      // Auto-sync com Google Sheets
      this.autoSyncProject('impl', data);
    });
  }

  showOngoingProjectModal(project = null) {
    const isEdit = !!project;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    const flagOptions = ['Safe', 'Care', 'Danger', 'Critical'];
    const statusOptions = ['Ativo', 'Churn', 'A iniciar'];
    const tipoOptions = ['CRM Sales', 'CRM Marketing', 'IA SDR', 'Dashboard Mídia', 'Dashboard Completo', 'Dashboard Personalizado', 'Site Institucional', 'CRM Sales & Marketing'];

    overlay.innerHTML = `
      <div class="edit-modal-content">
        <div class="edit-modal-header">
          <h3>${isEdit ? 'Editar' : 'Nova'} Recorrência</h3>
          <button class="edit-modal-close btn-icon">✕</button>
        </div>
        <div class="edit-modal-body">
          <div class="edit-modal-row">
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Cliente</label>
              <input type="text" id="og-cliente" class="edit-modal-input" value="${this.escapeHtml(project?.cliente || '')}">
            </div>
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Valor Mensal (R$)</label>
              <input type="number" id="og-valor" class="edit-modal-input" step="0.01" value="${project?.valor || ''}">
            </div>
          </div>
          <div class="edit-modal-row">
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Tipo</label>
              <select id="og-tipo" class="edit-modal-select">
                ${tipoOptions.map(t => `<option value="${t}" ${project?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Responsável</label>
              <select id="og-responsavel" class="edit-modal-select">
                ${this.store.people.map(p => `<option value="${p}" ${project?.responsavel === p ? 'selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="edit-modal-row">
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Status</label>
              <select id="og-status" class="edit-modal-select">
                ${statusOptions.map(s => `<option value="${s}" ${project?.status === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
            <div class="edit-modal-section edit-modal-half">
              <label class="edit-modal-label">Flag</label>
              <select id="og-flag" class="edit-modal-select">
                <option value="">Sem flag</option>
                ${flagOptions.map(f => `<option value="${f}" ${project?.flag === f ? 'selected' : ''}>${f}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="edit-modal-footer">
          <button class="btn btn-secondary" id="og-cancel">Cancelar</button>
          <button class="btn btn-primary" id="og-save">Salvar</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.querySelector('.edit-modal-close').addEventListener('click', close);
    overlay.querySelector('#og-cancel').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

    overlay.querySelector('#og-save').addEventListener('click', () => {
      const data = {
        id: project?.id || Date.now(),
        cliente: overlay.querySelector('#og-cliente').value.trim(),
        valor: parseFloat(overlay.querySelector('#og-valor').value) || 0,
        tipo: overlay.querySelector('#og-tipo').value,
        responsavel: overlay.querySelector('#og-responsavel').value,
        status: overlay.querySelector('#og-status').value,
        flag: overlay.querySelector('#og-flag').value
      };

      if (!data.cliente) { this.showToast('Cliente é obrigatório', 'warning'); return; }

      if (isEdit) {
        data._dirty = true;
        data._rowIndex = project._rowIndex;
        data._sheetName = project._sheetName;
        data.idCliente = project.idCliente;
        data.email = project.email;
        data.linkContrato = project.linkContrato;
        const idx = this.store.projectsOngoing.findIndex(p => p.id === project.id);
        if (idx >= 0) this.store.projectsOngoing[idx] = data;
      } else {
        data._dirty = true;
        this.store.projectsOngoing.push(data);
      }

      this.store.saveProjectsOngoing();
      close();
      this.renderTorreDeComandoTab(document.getElementById('tab-content'));

      // Auto-sync com Google Sheets
      this.autoSyncProject('ongoing', data);
    });
  }

  async autoSyncProject(type, project) {
    if (!window.SheetsBridge) return;

    try {
      const config = await window.SheetsBridge.checkConfig();
      if (!config.canWrite) return;

      // Garantir _sheetName para projetos novos
      if (!project._sheetName) {
        const result = await window.SheetsBridge.syncPull();
        if (result.success) {
          // Buscar o nome da aba correta
          if (type === 'impl') {
            const implProject = result.projectsImpl?.[0];
            if (implProject?._sheetName) project._sheetName = implProject._sheetName;
          } else {
            const ongoingProject = result.projectsOngoing?.[0];
            if (ongoingProject?._sheetName) project._sheetName = ongoingProject._sheetName;
          }
        }
      }

      const pushResult = await window.SheetsBridge.pushProject(type, project);
      if (pushResult.success) {
        project._dirty = false;
        if (type === 'impl') this.store.saveProjectsImpl();
        else this.store.saveProjectsOngoing();
        this.showToast('Sincronizado com a planilha', 'success');
      } else {
        this.showToast('Salvo localmente. Sync: ' + (pushResult.error || 'erro'), 'warning');
      }
    } catch (e) {
      this.showToast('Salvo localmente (sync falhou)', 'warning');
    }
  }

  importTorreCSV() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.txt';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target.result;
        const lines = content.split('\n').map(l => l.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/));
        if (lines.length < 2) { this.showToast('Arquivo vazio ou formato inválido', 'warning'); return; }

        const headers = lines[0].map(h => h.trim().toLowerCase().replace(/"/g, ''));
        let imported = 0;

        for (let i = 1; i < lines.length; i++) {
          const row = lines[i];
          if (row.length < 3) continue;
          const get = (name) => {
            const idx = headers.findIndex(h => h.includes(name));
            return idx >= 0 && row[idx] ? row[idx].trim().replace(/"/g, '') : '';
          };

          const cliente = get('cliente');
          if (!cliente) continue;

          const status = get('status');
          const flag = get('flag');

          // Detect if it's implementation or ongoing based on columns
          if (headers.some(h => h.includes('prazo') || h.includes('implementa'))) {
            this.store.projectsImpl.push({
              id: Date.now() + i,
              cliente, valor: parseFloat(get('valor')) || 0,
              tipo: get('projeto') || get('tipo') || get('produto'),
              responsavel: get('responsável') || get('responsavel'),
              status: status || 'A iniciar',
              dataInicio: get('data in') || get('inicio'),
              prazoOriginal: get('prazo original') || get('prazo'),
              prazoRevisado: get('prazo revisado') || get('prazo rev'),
              dataEntregaReal: get('data entrega') || get('entrega real'),
              motivoAtraso: get('motivo'),
              notaCsat: parseFloat(get('csat') || get('nota')) || 0,
              feedbackCsat: get('feedback'),
              quarter: get('quarter'),
              links: {}
            });
          } else {
            this.store.projectsOngoing.push({
              id: Date.now() + i,
              cliente, valor: parseFloat(get('valor')) || 0,
              tipo: get('projeto') || get('tipo') || get('produto'),
              responsavel: get('responsável') || get('responsavel'),
              status: status || 'Ativo',
              flag: flag || ''
            });
          }
          imported++;
        }

        this.store.saveProjectsImpl();
        this.store.saveProjectsOngoing();
        this.showToast(`✓ ${imported} projeto(s) importado(s)`, 'success');
        this.renderTorreDeComandoTab(document.getElementById('tab-content'));
      };
      reader.readAsText(file);
    };
    input.click();
  }

  renderMemoryTab(container) {
    container.innerHTML = `
      <div class="space-y-6">
        <div class="card">
          <h3 class="card-title">Sistema de Memória</h3>
          <p style="color: var(--color-text-secondary); margin-top: 0.375rem; font-size: 0.875rem;">
            Upload de documentos e busca em desenvolvimento.
            Documentos de transcrições serão salvos aqui automaticamente pelo Meet Agent.
          </p>
        </div>

        <!-- Projects List -->
        <div class="card">
          <h3 class="card-title">Projetos</h3>
          <div id="projects-list"></div>
        </div>
      </div>
    `;

    this.renderProjectsList();
  }

  renderProjectsList() {
    const container = document.getElementById('projects-list');
    if (!container) return;

    container.innerHTML = `
      <div class="projects-grid">
        ${this.store.projects.map(project => {
      const projectTasks = this.store.tasks.filter(t => t.project === project.name).length;

      const statusClass = {
        active: 'status-active',
        implementation: 'status-implementation',
        churned: 'status-churned'
      }[project.status];

      return `
            <div class="project-card">
              <div class="project-header">
                <h4>${this.escapeHtml(project.name)}</h4>
                <span class="status-badge ${statusClass}">${project.status}</span>
              </div>
              <div class="project-stats">
                <p>✓ ${projectTasks} tarefa(s)</p>
              </div>
            </div>
          `;
    }).join('')}
      </div>
    `;
  }

  renderConfigTab(container) {
    // Calculate statistics
    const completed = this.store.tasks.filter(t => t.completed).length;
    const total = this.store.tasks.length;
    const completionRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    const personCounts = {};
    this.store.tasks.forEach(task => {
      personCounts[task.person] = (personCounts[task.person] || 0) + 1;
    });
    const mostActive = Object.entries(personCounts).sort((a, b) => b[1] - a[1])[0];

    const today = new Date().toISOString().split('T')[0];
    const todayTasks = this.store.tasks.filter(t => t.date === today && !t.completed).length;
    const overdue = this.store.tasks.filter(t => t.date < today && !t.completed).length;

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Statistics -->
        <div class="card">
          <h3 class="card-title">Estatísticas</h3>

          <div class="stats-grid">
            <div class="stat-box stat-blue">
              <div class="stat-big">${total}</div>
              <div class="stat-label">Total de Tarefas</div>
            </div>

            <div class="stat-box stat-green">
              <div class="stat-big">${completed}</div>
              <div class="stat-label">Concluídas</div>
            </div>

            <div class="stat-box stat-purple">
              <div class="stat-big">${completionRate}%</div>
              <div class="stat-label">Taxa de Conclusão</div>
            </div>

            <div class="stat-box stat-yellow">
              <div class="stat-big">${mostActive ? mostActive[0] : 'N/A'}</div>
              <div class="stat-label">Mais Ativo</div>
            </div>

            <div class="stat-box stat-orange">
              <div class="stat-big">${todayTasks}</div>
              <div class="stat-label">Tarefas Hoje</div>
            </div>

            <div class="stat-box stat-red">
              <div class="stat-big">${overdue}</div>
              <div class="stat-label">Atrasadas</div>
            </div>

            <div class="stat-box stat-teal">
              <div class="stat-big">${this.store.projects.length}</div>
              <div class="stat-label">Projetos</div>
            </div>
          </div>
        </div>

        <!-- Duplicate Detection -->
        ${this.renderDuplicatesSection()}

        <!-- People Management -->
        <div class="card">
          <div class="card-header">
            <h3>Gestão de Pessoas</h3>
            <button id="btn-add-person" class="btn btn-primary btn-sm">+ Adicionar</button>
          </div>

          <div class="people-grid">
            ${this.store.people.map(person => `
              <div class="person-card">
                <span>${this.escapeHtml(person)}</span>
                <div>
                  <button class="person-edit btn-icon" data-person="${this.escapeHtml(person)}">✎</button>
                  <button class="person-remove btn-icon" data-person="${this.escapeHtml(person)}">✕</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Project Management -->
        <div class="card">
          <div class="card-header">
            <h3>Gestão de Projetos</h3>
            <button id="btn-add-project" class="btn btn-purple btn-sm">+ Adicionar</button>
          </div>

          <div class="projects-list">
            ${this.store.projects.map(project => `
              <div class="project-item">
                <div>
                  <span class="project-item-name">${this.escapeHtml(project.name)}</span>
                  <span class="project-item-status">(${project.status})</span>
                </div>
                <div>
                  <button class="project-edit btn-icon" data-project-id="${project.id}">✎</button>
                  <button class="project-remove btn-icon" data-project-id="${project.id}">🗑️</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Data Management -->
        <div class="card">
          <h3 class="card-title">Dados</h3>

          <div class="button-group">
            <button id="btn-export-data" class="btn btn-success">
              📥 Exportar Dados
            </button>
            <button id="btn-import-data" class="btn btn-primary">
              📤 Importar Dados
            </button>
            <button id="btn-clear-data" class="btn btn-danger" style="margin-left: auto;">
              🗑️ Limpar Dados
            </button>
          </div>
        </div>

        <!-- Keyboard Shortcuts -->
        <div class="card">
          <h3 class="card-title">Atalhos de Teclado</h3>

          <div class="shortcuts-grid">
            <div class="shortcut-item">
              <span>Focus comando rápido</span>
              <kbd>Ctrl+K</kbd>
            </div>
            <div class="shortcut-item">
              <span>Nova tarefa manual</span>
              <kbd>Ctrl+N</kbd>
            </div>
            <div class="shortcut-item">
              <span>Busca global</span>
              <kbd>Ctrl+F</kbd>
            </div>
            <div class="shortcut-item">
              <span>Fechar modals</span>
              <kbd>Esc</kbd>
            </div>
          </div>
        </div>
      </div>
    `;

    // this.attachConfigEventListeners(); // Removido em favor de listeners globais
  }


  // attachConfigEventListeners removido (substituído por attachGlobalListeners)
}


// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'k') {
      e.preventDefault();
      document.getElementById('command-input')?.focus();
    }
    if (e.key === 'n') {
      e.preventDefault();
      const form = document.getElementById('manual-form');
      if (form) form.style.display = 'block';
    }
    if (e.key === 'f') {
      e.preventDefault();
      document.getElementById('filter-search')?.focus();
    }
  }

  if (e.key === 'Escape') {
    const manualForm = document.getElementById('manual-form');
    if (manualForm) manualForm.style.display = 'none';
    document.querySelectorAll('.modal').forEach(modal => modal.remove());
  }
});

// ============================================================================
// INITIALIZE APP
// ============================================================================

console.log('🧠 Segundo Cérebro - Inicializando...');

// Inicialização assíncrona: carregar dados do servidor antes de renderizar
(async function init() {
  // Tentar carregar dados do servidor primeiro (para persistência no EasyPanel)
  await Storage.loadFromServer();

  const dataStore = new DataStore();
  const uiManager = new UIManager(dataStore);

  const doRender = () => {
    console.log('✓ Renderizando interface...');
    uiManager.render();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', doRender);
  } else {
    doRender();
  }

  window._uiManager = uiManager;
})();
