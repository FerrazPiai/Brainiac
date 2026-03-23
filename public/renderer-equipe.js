// ============================================================================
// RENDERER-EQUIPE.JS - Tab Equipe (Team Health Dashboard)
// Estende UIManager.prototype
// ============================================================================

UIManager.prototype.renderEquipeTab = function(container) {
  const people = this.store.people || [];
  const tasks = this.store.tasks || [];
  const sessions = this.store.oneOneSessions || [];
  const projectsImpl = this.store.projectsImpl || [];
  const projectsOngoing = this.store.projectsOngoing || [];

  // Gerar metricas por pessoa
  const memberMetrics = people.map(person => {
    // Tarefas
    const personTasks = tasks.filter(t =>
      (t.people && t.people.includes(person)) || t.person === person
    );
    const activeTasks = personTasks.filter(t => !t.completed);
    const completedTasks = personTasks.filter(t => t.completed);
    const overdueTasks = activeTasks.filter(t => {
      if (!t.date) return false;
      return t.date < new Date().toISOString().split('T')[0];
    });

    // Delivery rate
    const totalWithDate = personTasks.filter(t => t.date && t.completed);
    const deliveredOnTime = totalWithDate.filter(t => {
      if (!t.completedAt || !t.date) return true; // assume on-time se sem data
      return t.completedAt <= t.date + 'T23:59:59';
    });
    const deliveryRate = totalWithDate.length > 0
      ? Math.round((deliveredOnTime.length / totalWithDate.length) * 100)
      : 100;

    // Projetos
    const personProjects = projectsImpl.filter(p =>
      p.responsavel && p.responsavel.toLowerCase() === person.toLowerCase()
    );
    const activeProjects = personProjects.filter(p =>
      p.status === 'Em andamento' || p.status === 'A iniciar'
    );
    const delayedProjects = personProjects.filter(p => p.status === 'Atrasado');

    // Ongoing com flags
    const personOngoing = projectsOngoing.filter(p =>
      p.responsavel && p.responsavel.toLowerCase() === person.toLowerCase()
    );
    const criticalOngoing = personOngoing.filter(p => p.flag === 'Critical' || p.flag === 'Danger');

    // 1:1s
    const personSessions = sessions.filter(s => s.teamMember === person);
    const lastSession = personSessions.sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    const lastSentiment = lastSession?.sentiment || 'none';
    const openActions = personSessions.reduce((c, s) =>
      c + (s.actionItems || []).filter(a => !a.done).length, 0
    );

    // Score geral (0-100)
    const workloadScore = Math.max(0, 100 - activeTasks.length * 10 - overdueTasks.length * 20);
    const deliveryScore = deliveryRate;
    const projectScore = Math.max(0, 100 - delayedProjects.length * 25);
    const sentimentScore = lastSentiment === 'positive' ? 100 : lastSentiment === 'neutral' ? 60 : lastSentiment === 'negative' ? 20 : 50;
    const healthScore = Math.round((workloadScore + deliveryScore + projectScore + sentimentScore) / 4);

    return {
      person,
      activeTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      overdueTasks: overdueTasks.length,
      deliveryRate,
      activeProjects: activeProjects.length,
      delayedProjects: delayedProjects.length,
      ongoingClients: personOngoing.filter(p => p.status === 'Ativo').length,
      criticalClients: criticalOngoing.length,
      lastSessionDate: lastSession?.date || null,
      lastSentiment,
      openActions,
      healthScore,
      totalSessions: personSessions.length
    };
  });

  // KPIs do time
  const totalActiveTasks = memberMetrics.reduce((s, m) => s + m.activeTasks, 0);
  const totalOverdue = memberMetrics.reduce((s, m) => s + m.overdueTasks, 0);
  const avgDelivery = memberMetrics.length > 0
    ? Math.round(memberMetrics.reduce((s, m) => s + m.deliveryRate, 0) / memberMetrics.length)
    : 0;
  const avgHealth = memberMetrics.length > 0
    ? Math.round(memberMetrics.reduce((s, m) => s + m.healthScore, 0) / memberMetrics.length)
    : 0;

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Equipe - Team Health Dashboard</h3>
          <button class="btn btn-purple btn-sm" id="btn-weekly-report">Gerar Relatorio Semanal</button>
        </div>
      </div>

      <!-- KPIs do Time -->
      <div class="card-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
        <div class="stat-card">
          <div class="stat-label">Membros</div>
          <div class="stat-value">${people.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Tarefas Ativas</div>
          <div class="stat-value">${totalActiveTasks}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Atrasadas</div>
          <div class="stat-value" style="color:${totalOverdue > 0 ? 'var(--red-600)' : '#16a34a'};">${totalOverdue}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Delivery Rate</div>
          <div class="stat-value" style="color:${avgDelivery >= 80 ? '#16a34a' : avgDelivery >= 60 ? '#d97706' : 'var(--red-600)'};">${avgDelivery}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Health Score</div>
          <div class="stat-value" style="color:${avgHealth >= 70 ? '#16a34a' : avgHealth >= 40 ? '#d97706' : 'var(--red-600)'};">${avgHealth}/100</div>
        </div>
      </div>

      <!-- Cards por Membro -->
      <div class="card-grid" style="grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));">
        ${memberMetrics.sort((a, b) => a.healthScore - b.healthScore).map(m => {
          const healthColor = m.healthScore >= 70 ? '#16a34a' : m.healthScore >= 40 ? '#d97706' : 'var(--red-600)';
          const sentimentIcon = m.lastSentiment === 'positive' ? '🟢' : m.lastSentiment === 'negative' ? '🔴' : m.lastSentiment === 'neutral' ? '🟡' : '⚪';

          return `
            <div class="card" style="border-left:4px solid ${healthColor};">
              <div style="padding:1rem;">
                <!-- Header do membro -->
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
                  <div style="font-weight:600;font-size:1rem;">${this.escapeHtml(m.person)}</div>
                  <div style="display:flex;align-items:center;gap:0.5rem;">
                    <span>${sentimentIcon}</span>
                    <span style="font-weight:700;font-size:1.25rem;color:${healthColor};">${m.healthScore}</span>
                  </div>
                </div>

                <!-- Metricas grid -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.625rem;">
                  <!-- Tarefas -->
                  <div style="background:var(--gray-50);border-radius:8px;padding:0.5rem 0.625rem;">
                    <div style="font-size:0.6875rem;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.04em;">Tarefas</div>
                    <div style="font-weight:600;">${m.activeTasks} ativas</div>
                    ${m.overdueTasks > 0 ? `<div style="font-size:0.75rem;color:var(--red-600);">${m.overdueTasks} atrasadas</div>` : ''}
                  </div>

                  <!-- Delivery -->
                  <div style="background:var(--gray-50);border-radius:8px;padding:0.5rem 0.625rem;">
                    <div style="font-size:0.6875rem;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.04em;">Delivery</div>
                    <div style="font-weight:600;color:${m.deliveryRate >= 80 ? '#16a34a' : m.deliveryRate >= 60 ? '#d97706' : 'var(--red-600)'};">${m.deliveryRate}%</div>
                    <div style="background:var(--gray-200);height:4px;border-radius:2px;margin-top:0.25rem;"><div style="width:${m.deliveryRate}%;height:100%;background:${m.deliveryRate >= 80 ? '#16a34a' : m.deliveryRate >= 60 ? '#d97706' : 'var(--red-600)'};border-radius:2px;"></div></div>
                  </div>

                  <!-- Projetos -->
                  <div style="background:var(--gray-50);border-radius:8px;padding:0.5rem 0.625rem;">
                    <div style="font-size:0.6875rem;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.04em;">Projetos</div>
                    <div style="font-weight:600;">${m.activeProjects} ativos</div>
                    ${m.delayedProjects > 0 ? `<div style="font-size:0.75rem;color:var(--red-600);">${m.delayedProjects} atrasados</div>` : ''}
                    ${m.criticalClients > 0 ? `<div style="font-size:0.75rem;color:var(--red-600);">${m.criticalClients} clientes criticos</div>` : ''}
                  </div>

                  <!-- 1:1s -->
                  <div style="background:var(--gray-50);border-radius:8px;padding:0.5rem 0.625rem;">
                    <div style="font-size:0.6875rem;color:var(--gray-500);text-transform:uppercase;letter-spacing:0.04em;">1:1s</div>
                    <div style="font-weight:500;font-size:0.8125rem;">${m.lastSessionDate || 'Nenhuma'}</div>
                    ${m.openActions > 0 ? `<div style="font-size:0.75rem;color:var(--red-600);">${m.openActions} actions abertos</div>` : '<div style="font-size:0.75rem;color:#16a34a;">Em dia</div>'}
                  </div>
                </div>

                <!-- Ongoing -->
                <div style="margin-top:0.625rem;font-size:0.75rem;color:var(--gray-500);">
                  ${m.ongoingClients} clientes recorrentes
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>

      <!-- Modal result placeholder -->
      <div id="weekly-report-result"></div>
    </div>
  `;

  this.attachEquipeListeners();
};

UIManager.prototype.attachEquipeListeners = function() {
  document.getElementById('btn-weekly-report')?.addEventListener('click', () => this.generateWeeklyReport());
};

UIManager.prototype.generateWeeklyReport = async function() {
  const btn = document.getElementById('btn-weekly-report');
  if (btn) { btn.disabled = true; btn.textContent = 'Gerando...'; }

  try {
    const tasks = this.store.tasks || [];
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    const weekTasks = tasks.filter(t => t.createdAt >= weekAgo);
    const completedThisWeek = tasks.filter(t => t.completed && t.completedAt >= weekAgo);
    const overdue = tasks.filter(t => !t.completed && t.date && t.date < today);

    const byPerson = {};
    tasks.filter(t => !t.completed).forEach(t => {
      (t.people || [t.person]).filter(Boolean).forEach(p => {
        byPerson[p] = (byPerson[p] || 0) + 1;
      });
    });

    const impl = this.store.projectsImpl || [];
    const ongoing = this.store.projectsOngoing || [];
    const sessions = this.store.oneOneSessions || [];
    const weekSessions = sessions.filter(s => s.date >= weekAgo);
    const nps = this.store.npsData || [];

    const sentimentSummary = weekSessions.length > 0
      ? weekSessions.map(s => s.sentiment).join(', ')
      : 'Sem sessoes esta semana';

    const data = {
      tasks: {
        created: weekTasks.length,
        completed: completedThisWeek.length,
        overdue: overdue.length,
        byPerson
      },
      projects: {
        activeImpl: impl.filter(p => p.status === 'Em andamento').length,
        completedImpl: impl.filter(p => p.status === 'Concluido' && p.dataEntregaReal >= weekAgo).length,
        atRisk: impl.filter(p => p.status === 'Atrasado').length,
        activeOngoing: ongoing.filter(p => p.status === 'Ativo').length,
        churn: ongoing.filter(p => p.status === 'Churn').length,
        criticalFlags: ongoing.filter(p => p.flag === 'Critical').length
      },
      financial: {
        mrrTotal: this.store.financialOngoingRevenue?.filter(r => r.status === 'Ativo').reduce((s, r) => s + r.valor, 0) || 0,
        marginAvg: this.store.financialPnL?.length > 0
          ? Math.round(this.store.financialPnL.filter(r => r.margemOps > 0).reduce((s, r) => s + r.margemOps, 0) / this.store.financialPnL.filter(r => r.margemOps > 0).length * 100)
          : 0
      },
      oneones: {
        conducted: weekSessions.length,
        sentimentSummary,
        openActionItems: sessions.reduce((c, s) => c + (s.actionItems || []).filter(a => !a.done).length, 0)
      },
      nps: {
        currentScore: nps.length > 0 ? (nps.reduce((s, n) => s + n.nota, 0) / nps.length).toFixed(1) : 'N/A',
        recentFeedback: nps.slice(-3).map(n => ({ cliente: n.empresa, nota: n.nota, feedback: (n.feedback || '').substring(0, 100) }))
      }
    };

    let report;
    if (window.ReportBridge && window.ReportBridge.isAvailable()) {
      report = await window.ReportBridge.generateWeeklyReport(data);
    } else {
      try {
        const res = await fetch('/api/ai/weekly-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        const json = await res.json();
        report = json.success ? json.report : null;
      } catch (e) { report = null; }
    }

    if (report) {
      const resultDiv = document.getElementById('weekly-report-result');
      if (resultDiv) {
        resultDiv.innerHTML = `
          <div class="card" style="margin-top:1rem;">
            <div class="card-header">
              <h3 class="card-title">Relatorio Semanal</h3>
              <button class="btn btn-secondary btn-sm" id="btn-copy-report">Copiar</button>
            </div>
            <div style="padding:1rem;" id="report-content">
              <div style="white-space:pre-wrap;font-size:0.875rem;line-height:1.7;font-family:inherit;">${this.escapeHtml(report)}</div>
            </div>
          </div>
        `;
        document.getElementById('btn-copy-report')?.addEventListener('click', () => {
          navigator.clipboard.writeText(report).then(() => {
            this.showToast('Relatorio copiado', 'success');
          });
        });
      }
      this.showToast('Relatorio semanal gerado', 'success');
    } else {
      this.showToast('Erro ao gerar relatorio', 'error');
    }
  } catch (error) {
    this.showToast('Erro: ' + error.message, 'error');
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Gerar Relatorio Semanal'; }
};
