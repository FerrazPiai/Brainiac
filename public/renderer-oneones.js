// ============================================================================
// RENDERER-ONEONES.JS - Tab 1:1s (Transcricoes de One-on-One)
// Estende UIManager.prototype
// ============================================================================

UIManager.prototype._oneoneSelectedMember = 'all';

UIManager.prototype.renderOneOnesTab = function(container) {
  const sessions = this.store.oneOneSessions || [];
  const people = this.store.people || [];
  const selectedMember = this._oneoneSelectedMember || 'all';

  // Filtrar sessoes por membro
  const filtered = selectedMember === 'all'
    ? sessions
    : sessions.filter(s => s.teamMember === selectedMember);

  // Calcular stats
  const totalSessions = filtered.length;
  const lastSession = filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
  const openActions = filtered.reduce((count, s) => {
    return count + (s.actionItems || []).filter(a => !a.done).length;
  }, 0);

  // Sentimento geral
  const sentiments = filtered.filter(s => s.sentiment).map(s => s.sentiment);
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
  sentiments.forEach(s => { if (sentimentCounts[s] !== undefined) sentimentCounts[s]++; });
  const dominantSentiment = Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">1:1s - One-on-One Hub</h3>
          <button class="btn btn-primary btn-sm" id="btn-new-oneone">+ Nova 1:1</button>
        </div>
      </div>

      <!-- Seletor de Membro -->
      <div class="card" style="padding:0.75rem 1rem;">
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
          <span style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--gray-500);font-weight:600;">Membro:</span>
          <button class="oneone-member-pill ${selectedMember === 'all' ? 'active' : ''}" data-member="all">Todos</button>
          ${people.map(p => `
            <button class="oneone-member-pill ${selectedMember === p ? 'active' : ''}" data-member="${this.escapeHtml(p)}">${this.escapeHtml(p)}</button>
          `).join('')}
        </div>
      </div>

      ${selectedMember === 'all' ? this._renderOneOneOverview(sessions, people) : this._renderOneMemberView(filtered, selectedMember, totalSessions, lastSession, openActions, dominantSentiment)}
    </div>
  `;

  this.attachOneOnesListeners();
};

UIManager.prototype._renderOneOneOverview = function(sessions, people) {
  return `
    <div class="card-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));">
      ${people.map(person => {
        const personSessions = sessions.filter(s => s.teamMember === person);
        const lastS = personSessions.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
        const openActions = personSessions.reduce((c, s) => c + (s.actionItems || []).filter(a => !a.done).length, 0);
        const lastSentiment = lastS?.sentiment || 'none';

        const sentimentIcon = lastSentiment === 'positive' ? '🟢' : lastSentiment === 'negative' ? '🔴' : lastSentiment === 'neutral' ? '🟡' : '⚪';
        const sentimentLabel = lastSentiment === 'positive' ? 'Positivo' : lastSentiment === 'negative' ? 'Negativo' : lastSentiment === 'neutral' ? 'Neutro' : 'Sem dados';

        return `
          <div class="oneone-session-card" data-view-member="${this.escapeHtml(person)}" style="cursor:pointer;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="font-weight:600;font-size:0.9375rem;">${this.escapeHtml(person)}</div>
              <span class="oneone-sentiment-badge sentiment-${lastSentiment}">${sentimentIcon} ${sentimentLabel}</span>
            </div>
            <div style="margin-top:0.75rem;display:flex;gap:1.5rem;">
              <div>
                <div style="font-size:0.6875rem;color:var(--gray-500);text-transform:uppercase;">Sessoes</div>
                <div style="font-weight:600;font-size:1.125rem;">${personSessions.length}</div>
              </div>
              <div>
                <div style="font-size:0.6875rem;color:var(--gray-500);text-transform:uppercase;">Ultima</div>
                <div style="font-weight:500;">${lastS ? lastS.date : '-'}</div>
              </div>
              <div>
                <div style="font-size:0.6875rem;color:var(--gray-500);text-transform:uppercase;">Actions</div>
                <div style="font-weight:600;color:${openActions > 0 ? 'var(--red-600)' : '#16a34a'};">${openActions} abertos</div>
              </div>
            </div>
          </div>`;
      }).join('')}
    </div>`;
};

UIManager.prototype._renderOneMemberView = function(sessions, member, total, lastSession, openActions, dominantSentiment) {
  const sentimentIcon = dominantSentiment === 'positive' ? '🟢' : dominantSentiment === 'negative' ? '🔴' : '🟡';

  // Coletar todas as action items abertas
  const allOpenActions = [];
  sessions.forEach(s => {
    (s.actionItems || []).forEach(a => {
      if (!a.done) allOpenActions.push({ ...a, sessionId: s.id, sessionDate: s.date });
    });
  });

  // Areas de desenvolvimento recorrentes
  const devAreas = {};
  sessions.forEach(s => {
    (s.developmentAreas || []).forEach(area => {
      devAreas[area] = (devAreas[area] || 0) + 1;
    });
  });
  const sortedAreas = Object.entries(devAreas).sort((a, b) => b[1] - a[1]);

  return `
    <!-- Stats -->
    <div class="card-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
      <div class="stat-card">
        <div class="stat-label">Total Sessoes</div>
        <div class="stat-value">${total}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ultima Sessao</div>
        <div class="stat-value" style="font-size:1rem;">${lastSession ? lastSession.date : '-'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Sentimento</div>
        <div class="stat-value">${sentimentIcon} ${dominantSentiment === 'positive' ? 'Positivo' : dominantSentiment === 'negative' ? 'Negativo' : 'Neutro'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Actions Abertos</div>
        <div class="stat-value" style="color:${openActions > 0 ? 'var(--red-600)' : '#16a34a'};">${openActions}</div>
      </div>
    </div>

    <!-- Action Items Pendentes -->
    ${allOpenActions.length > 0 ? `
      <div class="card">
        <div class="card-header"><h3 class="card-title">Action Items Pendentes</h3></div>
        <div style="padding:0.5rem;">
          ${allOpenActions.map(a => `
            <div class="oneone-action-item" data-session-id="${a.sessionId}" data-action-text="${this.escapeHtml(a.text)}">
              <input type="checkbox" class="task-checkbox oneone-action-check" ${a.done ? 'checked' : ''}>
              <div style="flex:1;">
                <div style="font-size:0.875rem;">${this.escapeHtml(a.text)}</div>
                <div style="font-size:0.75rem;color:var(--gray-400);">${a.sessionDate || ''} ${a.owner ? '| ' + this.escapeHtml(a.owner) : ''} ${a.dueDate ? '| Prazo: ' + a.dueDate : ''}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Areas de Desenvolvimento -->
    ${sortedAreas.length > 0 ? `
      <div class="card">
        <div class="card-header"><h3 class="card-title">Areas de Desenvolvimento Recorrentes</h3></div>
        <div style="padding:0.75rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
          ${sortedAreas.map(([area, count]) => `
            <span class="oneone-dev-area-tag">${this.escapeHtml(area)} <span style="opacity:0.6;">(${count}x)</span></span>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- Timeline de Sessoes -->
    <div class="card">
      <div class="card-header"><h3 class="card-title">Historico de Sessoes</h3></div>
      <div style="padding:0.5rem;">
        ${sessions.length === 0 ? '<p style="text-align:center;color:var(--gray-400);padding:2rem;">Nenhuma sessao 1:1 registrada</p>' : ''}
        ${sessions.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(s => {
          const sentIcon = s.sentiment === 'positive' ? '🟢' : s.sentiment === 'negative' ? '🔴' : '🟡';
          const actionCount = (s.actionItems || []).length;
          const openCount = (s.actionItems || []).filter(a => !a.done).length;
          return `
            <div class="oneone-session-card" data-session-id="${s.id}" style="cursor:pointer;margin-bottom:0.5rem;">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <span style="font-weight:600;">${s.date || '-'}</span>
                  <span class="oneone-sentiment-badge sentiment-${s.sentiment}" style="margin-left:0.5rem;">${sentIcon}</span>
                  ${s.source === 'meet-agent' ? '<span class="tag" style="margin-left:0.5rem;font-size:0.625rem;background:#e0e7ff;color:#3730a3;">Meet</span>' : ''}
                </div>
                <div style="display:flex;gap:0.75rem;font-size:0.75rem;color:var(--gray-500);">
                  <span>Actions: ${actionCount} (${openCount} abertos)</span>
                  <span>${(s.keyTopics || []).length} topicos</span>
                </div>
              </div>
              ${s.summary ? `<div style="margin-top:0.5rem;font-size:0.8125rem;color:var(--gray-600);line-height:1.5;">${Array.isArray(s.summary) ? s.summary.slice(0, 2).map(p => this.escapeHtml(p)).join(' | ') : this.escapeHtml(String(s.summary).substring(0, 200))}</div>` : ''}
              ${(s.keyTopics || []).length > 0 ? `<div style="margin-top:0.375rem;display:flex;gap:0.25rem;flex-wrap:wrap;">${s.keyTopics.slice(0, 5).map(t => `<span class="tag tag-tag">${this.escapeHtml(t)}</span>`).join('')}</div>` : ''}
            </div>`;
        }).join('')}
      </div>
    </div>
  `;
};

UIManager.prototype.attachOneOnesListeners = function() {
  // Seletor de membro
  document.querySelectorAll('.oneone-member-pill').forEach(btn => {
    btn.addEventListener('click', (e) => {
      this._oneoneSelectedMember = e.target.dataset.member;
      this.renderOneOnesTab(document.getElementById('tab-content'));
    });
  });

  // Clicar no card de membro na overview
  document.querySelectorAll('[data-view-member]').forEach(card => {
    card.addEventListener('click', (e) => {
      this._oneoneSelectedMember = card.dataset.viewMember;
      this.renderOneOnesTab(document.getElementById('tab-content'));
    });
  });

  // Nova 1:1
  document.getElementById('btn-new-oneone')?.addEventListener('click', () => {
    this.showNewOneOneModal(this._oneoneSelectedMember !== 'all' ? this._oneoneSelectedMember : null);
  });

  // Clicar numa sessao
  document.querySelectorAll('[data-session-id]').forEach(card => {
    if (card.classList.contains('oneone-session-card')) {
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('oneone-action-check')) return;
        const session = this.store.oneOneSessions.find(s => s.id === card.dataset.sessionId);
        if (session) this.showOneOneDetailModal(session);
      });
    }
  });

  // Action item checkboxes
  document.querySelectorAll('.oneone-action-check').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const item = e.target.closest('.oneone-action-item');
      const sessionId = item?.dataset.sessionId;
      const actionText = item?.dataset.actionText;
      if (!sessionId || !actionText) return;

      const session = this.store.oneOneSessions.find(s => s.id === sessionId);
      if (session) {
        const action = session.actionItems.find(a => a.text === actionText);
        if (action) {
          action.done = e.target.checked;
          session.updatedAt = new Date().toISOString();
          this.store.saveOneOneSessions();
        }
      }
    });
  });
};

UIManager.prototype.showNewOneOneModal = function(preselectedMember) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="edit-modal-content" style="max-width:700px;">
      <div class="edit-modal-header">
        <h3>Nova Sessao 1:1</h3>
        <button class="edit-modal-close btn-icon">✕</button>
      </div>
      <div class="edit-modal-body">
        <div class="edit-modal-row">
          <div class="edit-modal-section edit-modal-half">
            <label class="edit-modal-label">Membro do Time</label>
            <select id="oneone-member" class="edit-modal-select">
              ${this.store.people.map(p => `<option value="${this.escapeHtml(p)}" ${p === preselectedMember ? 'selected' : ''}>${this.escapeHtml(p)}</option>`).join('')}
            </select>
          </div>
          <div class="edit-modal-section edit-modal-half">
            <label class="edit-modal-label">Data</label>
            <input type="date" id="oneone-date" class="edit-modal-input" value="${new Date().toISOString().split('T')[0]}">
          </div>
        </div>
        <div class="edit-modal-section">
          <label class="edit-modal-label">Transcricao / Anotacoes</label>
          <textarea id="oneone-transcript" class="edit-modal-input" rows="12" placeholder="Cole aqui a transcricao da reuniao ou suas anotacoes..."></textarea>
        </div>
        <div id="oneone-analysis-result" style="display:none;"></div>
      </div>
      <div class="edit-modal-footer">
        <button class="btn btn-secondary" id="oneone-cancel">Cancelar</button>
        <button class="btn btn-purple" id="oneone-analyze">Analisar com IA</button>
        <button class="btn btn-primary" id="oneone-save">Salvar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let analysisData = null;

  const close = () => overlay.remove();
  overlay.querySelector('.edit-modal-close').addEventListener('click', close);
  overlay.querySelector('#oneone-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Analisar com IA
  overlay.querySelector('#oneone-analyze').addEventListener('click', async () => {
    const transcript = overlay.querySelector('#oneone-transcript').value.trim();
    const member = overlay.querySelector('#oneone-member').value;
    if (!transcript) { this.showToast('Cole a transcricao antes de analisar', 'warning'); return; }

    const btn = overlay.querySelector('#oneone-analyze');
    btn.disabled = true;
    btn.textContent = 'Analisando...';

    const previousSessions = this.store.oneOneSessions
      .filter(s => s.teamMember === member)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 5);

    let result;
    if (window.OneOnOneBridge && window.OneOnOneBridge.isAvailable()) {
      result = await window.OneOnOneBridge.analyze(transcript, member, previousSessions);
    } else {
      try {
        const res = await fetch('/api/ai/analyze-oneone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, teamMember: member, previousSessions })
        });
        const json = await res.json();
        result = json.success ? json.analysis : null;
      } catch (e) { result = null; }
    }

    if (result) {
      analysisData = result;
      const resultDiv = overlay.querySelector('#oneone-analysis-result');
      resultDiv.style.display = 'block';
      resultDiv.innerHTML = `
        <div class="card" style="margin-top:1rem;background:var(--gray-50);">
          <div class="card-header"><h3 class="card-title">Resultado da Analise</h3></div>
          <div style="padding:0.75rem;">
            <div style="margin-bottom:0.75rem;">
              <strong>Sentimento:</strong>
              <span class="oneone-sentiment-badge sentiment-${result.sentiment}">
                ${result.sentiment === 'positive' ? '🟢 Positivo' : result.sentiment === 'negative' ? '🔴 Negativo' : '🟡 Neutro'}
              </span>
              ${result.sentimentDetails ? `<span style="margin-left:0.5rem;font-size:0.8125rem;color:var(--gray-500);">${this.escapeHtml(result.sentimentDetails)}</span>` : ''}
            </div>
            ${result.summary ? `<div style="margin-bottom:0.75rem;"><strong>Resumo:</strong><ul style="margin:0.25rem 0 0 1rem;">${(Array.isArray(result.summary) ? result.summary : [result.summary]).map(s => `<li style="font-size:0.8125rem;">${this.escapeHtml(s)}</li>`).join('')}</ul></div>` : ''}
            ${result.actionItems?.length ? `<div style="margin-bottom:0.75rem;"><strong>Action Items (${result.actionItems.length}):</strong><ul style="margin:0.25rem 0 0 1rem;">${result.actionItems.map(a => `<li style="font-size:0.8125rem;">${this.escapeHtml(a.text || a)} ${a.dueDate ? '<em>(' + a.dueDate + ')</em>' : ''}</li>`).join('')}</ul></div>` : ''}
            ${result.developmentAreas?.length ? `<div style="margin-bottom:0.75rem;"><strong>Areas de Desenvolvimento:</strong> ${result.developmentAreas.map(a => `<span class="oneone-dev-area-tag">${this.escapeHtml(a)}</span>`).join(' ')}</div>` : ''}
            ${result.keyTopics?.length ? `<div style="margin-bottom:0.5rem;"><strong>Topicos:</strong> ${result.keyTopics.map(t => `<span class="tag tag-tag">${this.escapeHtml(t)}</span>`).join(' ')}</div>` : ''}
            ${result.concerns ? `<div style="color:var(--red-600);font-size:0.8125rem;"><strong>Pontos de Atencao:</strong> ${this.escapeHtml(result.concerns)}</div>` : ''}
          </div>
        </div>
      `;
      this.showToast('Analise concluida', 'success');
    } else {
      this.showToast('Erro na analise de IA', 'error');
    }

    btn.disabled = false;
    btn.textContent = 'Analisar com IA';
  });

  // Salvar
  overlay.querySelector('#oneone-save').addEventListener('click', () => {
    const member = overlay.querySelector('#oneone-member').value;
    const date = overlay.querySelector('#oneone-date').value;
    const transcript = overlay.querySelector('#oneone-transcript').value.trim();

    if (!transcript) { this.showToast('Transcricao vazia', 'warning'); return; }

    const session = {
      id: 'oneone_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      teamMember: member,
      date: date,
      transcript: transcript,
      summary: analysisData?.summary || '',
      actionItems: (analysisData?.actionItems || []).map(a => ({
        text: a.text || a,
        done: false,
        dueDate: a.dueDate || null,
        owner: a.owner || member,
        priority: a.priority || 'normal'
      })),
      sentiment: analysisData?.sentiment || 'neutral',
      sentimentDetails: analysisData?.sentimentDetails || '',
      developmentAreas: analysisData?.developmentAreas || [],
      keyTopics: analysisData?.keyTopics || [],
      highlights: analysisData?.highlights || '',
      concerns: analysisData?.concerns || '',
      trends: analysisData?.trends || '',
      source: 'manual',
      meetingId: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.store.oneOneSessions.push(session);
    this.store.saveOneOneSessions();
    close();
    this.showToast(`1:1 com ${member} salvo`, 'success');
    this.renderOneOnesTab(document.getElementById('tab-content'));
  });
};

UIManager.prototype.showOneOneDetailModal = function(session) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const sentimentIcon = session.sentiment === 'positive' ? '🟢' : session.sentiment === 'negative' ? '🔴' : '🟡';

  overlay.innerHTML = `
    <div class="edit-modal-content" style="max-width:800px;max-height:90vh;overflow-y:auto;">
      <div class="edit-modal-header">
        <h3>1:1 com ${this.escapeHtml(session.teamMember)} - ${session.date || '-'}</h3>
        <button class="edit-modal-close btn-icon">✕</button>
      </div>
      <div class="edit-modal-body">
        <!-- Sentimento -->
        <div style="margin-bottom:1rem;">
          <span class="oneone-sentiment-badge sentiment-${session.sentiment}">${sentimentIcon} ${session.sentiment === 'positive' ? 'Positivo' : session.sentiment === 'negative' ? 'Negativo' : 'Neutro'}</span>
          ${session.sentimentDetails ? `<span style="margin-left:0.5rem;font-size:0.8125rem;color:var(--gray-500);">${this.escapeHtml(session.sentimentDetails)}</span>` : ''}
          ${session.source === 'meet-agent' ? '<span class="tag" style="margin-left:0.5rem;background:#e0e7ff;color:#3730a3;">Via Meet Agent</span>' : ''}
        </div>

        <!-- Resumo -->
        ${session.summary ? `
          <div class="card" style="margin-bottom:1rem;background:var(--gray-50);">
            <div style="padding:0.75rem;">
              <strong style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--gray-500);">Resumo</strong>
              <div style="margin-top:0.375rem;font-size:0.875rem;line-height:1.6;">
                ${Array.isArray(session.summary) ? '<ul style="margin:0;padding-left:1.25rem;">' + session.summary.map(s => `<li>${this.escapeHtml(s)}</li>`).join('') + '</ul>' : this.escapeHtml(String(session.summary))}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Action Items -->
        ${(session.actionItems || []).length > 0 ? `
          <div class="card" style="margin-bottom:1rem;">
            <div style="padding:0.75rem;">
              <strong style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--gray-500);">Action Items</strong>
              <div style="margin-top:0.5rem;">
                ${session.actionItems.map((a, i) => `
                  <div class="oneone-action-item" style="margin-bottom:0.375rem;">
                    <input type="checkbox" class="task-checkbox detail-action-check" data-idx="${i}" ${a.done ? 'checked' : ''}>
                    <div style="flex:1;">
                      <div style="font-size:0.875rem;${a.done ? 'text-decoration:line-through;opacity:0.5;' : ''}">${this.escapeHtml(a.text)}</div>
                      <div style="font-size:0.6875rem;color:var(--gray-400);">${a.owner || ''} ${a.dueDate ? '| Prazo: ' + a.dueDate : ''}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Topicos e Areas -->
        <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1rem;">
          ${(session.keyTopics || []).length > 0 ? `
            <div>
              <strong style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--gray-500);">Topicos</strong>
              <div style="margin-top:0.25rem;display:flex;gap:0.25rem;flex-wrap:wrap;">
                ${session.keyTopics.map(t => `<span class="tag tag-tag">${this.escapeHtml(t)}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          ${(session.developmentAreas || []).length > 0 ? `
            <div>
              <strong style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--gray-500);">Areas de Desenvolvimento</strong>
              <div style="margin-top:0.25rem;display:flex;gap:0.25rem;flex-wrap:wrap;">
                ${session.developmentAreas.map(a => `<span class="oneone-dev-area-tag">${this.escapeHtml(a)}</span>`).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        ${session.concerns ? `<div style="margin-bottom:1rem;padding:0.75rem;background:#fef2f2;border-radius:8px;border-left:3px solid var(--red-600);"><strong style="color:var(--red-600);font-size:0.75rem;text-transform:uppercase;">Pontos de Atencao</strong><div style="font-size:0.875rem;margin-top:0.25rem;">${this.escapeHtml(session.concerns)}</div></div>` : ''}

        ${session.trends ? `<div style="margin-bottom:1rem;padding:0.75rem;background:#eff6ff;border-radius:8px;border-left:3px solid #2563eb;"><strong style="color:#2563eb;font-size:0.75rem;text-transform:uppercase;">Tendencias</strong><div style="font-size:0.875rem;margin-top:0.25rem;">${this.escapeHtml(session.trends)}</div></div>` : ''}

        <!-- Transcricao -->
        <div class="card" style="background:var(--gray-50);">
          <div style="padding:0.75rem;">
            <strong style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--gray-500);">Transcricao Completa</strong>
            <pre style="margin-top:0.5rem;font-size:0.8125rem;line-height:1.6;white-space:pre-wrap;font-family:inherit;max-height:400px;overflow-y:auto;">${this.escapeHtml(session.transcript)}</pre>
          </div>
        </div>
      </div>
      <div class="edit-modal-footer">
        <button class="btn btn-danger btn-sm" id="oneone-delete">Excluir</button>
        <button class="btn btn-secondary" id="oneone-detail-close">Fechar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('.edit-modal-close').addEventListener('click', close);
  overlay.querySelector('#oneone-detail-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  // Action item checkboxes no detail
  overlay.querySelectorAll('.detail-action-check').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const idx = parseInt(e.target.dataset.idx);
      if (session.actionItems[idx]) {
        session.actionItems[idx].done = e.target.checked;
        session.updatedAt = new Date().toISOString();
        this.store.saveOneOneSessions();
      }
    });
  });

  // Delete
  overlay.querySelector('#oneone-delete').addEventListener('click', () => {
    if (confirm(`Excluir sessao 1:1 com ${session.teamMember} de ${session.date}?`)) {
      this.store.oneOneSessions = this.store.oneOneSessions.filter(s => s.id !== session.id);
      this.store.saveOneOneSessions();
      close();
      this.showToast('Sessao excluida', 'success');
      this.renderOneOnesTab(document.getElementById('tab-content'));
    }
  });
};
