// ============================================================================
// RENDERER-FINANCEIRO.JS - Tab Financeiro (P&L, Receita, Margens)
// Estende UIManager.prototype
// ============================================================================

UIManager.prototype.renderFinanceiroTab = function(container) {
  const pnl = this.store.financialPnL || [];
  const implRev = this.store.financialImplRevenue || [];
  const ongoingRev = this.store.financialOngoingRevenue || [];

  // Calcular KPIs
  const totalReceitaBruta = pnl.reduce((s, r) => s + r.receitaBruta, 0);
  const totalReceitaLiquida = pnl.reduce((s, r) => s + r.receitaLiquida, 0);
  const totalLucroBruto = pnl.reduce((s, r) => s + r.lucroBruto, 0);
  const avgMargemOps = pnl.length > 0
    ? pnl.filter(r => r.margemOps > 0).reduce((s, r) => s + r.margemOps, 0) / pnl.filter(r => r.margemOps > 0).length
    : 0;

  // MRR: ultimo mes de ongoing
  const meses = [...new Set(ongoingRev.map(r => r.mes))].sort().reverse();
  const lastMonth = meses[0] || '';
  const mrrTotal = ongoingRev.filter(r => r.mes === lastMonth && r.status === 'Ativo').reduce((s, r) => s + r.valor, 0);

  // Agrupar P&L por mes
  const monthsMap = {};
  pnl.forEach(r => {
    if (!monthsMap[r.month]) monthsMap[r.month] = {};
    monthsMap[r.month][r.product] = r;
  });
  const monthsSorted = Object.keys(monthsMap).sort();

  // Produtos unicos
  const products = [...new Set(pnl.map(r => r.product))];

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Financeiro - Squad TER</h3>
          <div style="display:flex;gap:0.5rem;align-items:center;">
            <button class="btn btn-secondary btn-sm" id="btn-fin-sync">Sincronizar Dados</button>
          </div>
        </div>
      </div>

      <!-- KPIs -->
      <div class="card-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
        <div class="stat-card">
          <div class="stat-label">Receita Bruta Total</div>
          <div class="stat-value" style="color:var(--gray-900);">R$ ${this.formatCurrency(totalReceitaBruta)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Receita Liquida</div>
          <div class="stat-value" style="color:var(--gray-900);">R$ ${this.formatCurrency(totalReceitaLiquida)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Lucro Bruto</div>
          <div class="stat-value" style="color:${totalLucroBruto >= 0 ? '#16a34a' : 'var(--red-600)'};">R$ ${this.formatCurrency(totalLucroBruto)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Margem Ops Media</div>
          <div class="stat-value" style="color:${avgMargemOps >= 0.5 ? '#16a34a' : avgMargemOps >= 0.3 ? '#d97706' : 'var(--red-600)'};">${(avgMargemOps * 100).toFixed(1)}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">MRR (${lastMonth || '-'})</div>
          <div class="stat-value" style="color:var(--gray-900);">R$ ${this.formatCurrency(mrrTotal)}</div>
        </div>
      </div>

      <!-- Margem por Produto -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Margem por Produto</h3>
        </div>
        <div class="card-grid" style="grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); margin-top:1rem;">
          ${products.map(prod => {
            const prodData = pnl.filter(r => r.product === prod);
            const prodReceita = prodData.reduce((s, r) => s + r.receitaBruta, 0);
            const prodLucro = prodData.reduce((s, r) => s + r.lucroBruto, 0);
            const prodMargem = prodReceita > 0 ? (prodLucro / prodReceita) * 100 : 0;
            return `
              <div class="stat-card" style="border-left:4px solid ${prodMargem >= 50 ? '#16a34a' : prodMargem >= 30 ? '#d97706' : 'var(--red-600)'};">
                <div class="stat-label">${this.escapeHtml(prod)}</div>
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:0.5rem;">
                  <div>
                    <div style="font-size:0.75rem;color:var(--gray-500);">Receita</div>
                    <div style="font-weight:600;">R$ ${this.formatCurrency(prodReceita)}</div>
                  </div>
                  <div>
                    <div style="font-size:0.75rem;color:var(--gray-500);">Lucro</div>
                    <div style="font-weight:600;color:${prodLucro >= 0 ? '#16a34a' : 'var(--red-600)'};">R$ ${this.formatCurrency(prodLucro)}</div>
                  </div>
                  <div>
                    <div style="font-size:0.75rem;color:var(--gray-500);">Margem</div>
                    <div style="font-weight:700;font-size:1.25rem;color:${prodMargem >= 50 ? '#16a34a' : prodMargem >= 30 ? '#d97706' : 'var(--red-600)'};">${prodMargem.toFixed(1)}%</div>
                  </div>
                </div>
                <div style="margin-top:0.5rem;background:var(--gray-200);border-radius:4px;height:6px;overflow:hidden;">
                  <div style="width:${Math.min(prodMargem, 100)}%;height:100%;background:${prodMargem >= 50 ? '#16a34a' : prodMargem >= 30 ? '#d97706' : 'var(--red-600)'};border-radius:4px;"></div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Grafico Tendencia -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Tendencia de Receita Mensal</h3>
        </div>
        <div style="padding:1rem;">
          <canvas id="fin-revenue-chart" width="800" height="300" style="width:100%;max-height:300px;"></canvas>
        </div>
      </div>

      <!-- Tabela P&L Mensal -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">P&L Mensal por Produto</h3>
        </div>
        <div style="overflow-x:auto;padding:0.5rem;">
          <table class="torre-table">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Produto</th>
                <th>R. Bruta</th>
                <th>Royalties</th>
                <th>Impostos</th>
                <th>R. Liquida</th>
                <th>CSP</th>
                <th>Lucro Bruto</th>
                <th>Margem Ops</th>
              </tr>
            </thead>
            <tbody>
              ${monthsSorted.map(month => {
                return products.map(prod => {
                  const r = monthsMap[month]?.[prod];
                  if (!r) return '';
                  const margemColor = r.margemOps >= 0.5 ? '#16a34a' : r.margemOps >= 0.3 ? '#d97706' : 'var(--red-600)';
                  return `<tr>
                    <td>${month}</td>
                    <td>${this.escapeHtml(prod)}</td>
                    <td>R$ ${this.formatCurrency(r.receitaBruta)}</td>
                    <td>R$ ${this.formatCurrency(r.royalties)}</td>
                    <td>R$ ${this.formatCurrency(r.impostos)}</td>
                    <td>R$ ${this.formatCurrency(r.receitaLiquida)}</td>
                    <td>R$ ${this.formatCurrency(r.csp)}</td>
                    <td style="color:${r.lucroBruto >= 0 ? '#16a34a' : 'var(--red-600)'};">R$ ${this.formatCurrency(r.lucroBruto)}</td>
                    <td><span class="torre-badge" style="background:${margemColor};color:#fff;">${(r.margemOps * 100).toFixed(1)}%</span></td>
                  </tr>`;
                }).join('');
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Receita Implementacao -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Receita de Implementacao (${implRev.length} projetos)</h3>
        </div>
        <div style="overflow-x:auto;padding:0.5rem;">
          <table class="torre-table">
            <thead>
              <tr><th>Cliente</th><th>Produto</th><th>Valor</th><th>Data Inicio</th></tr>
            </thead>
            <tbody>
              ${implRev.slice(0, 50).map(r => `
                <tr>
                  <td>${this.escapeHtml(r.cliente)}</td>
                  <td>${this.escapeHtml(r.produto)}</td>
                  <td>R$ ${this.formatCurrency(r.valor)}</td>
                  <td>${r.dataInicio || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Receita Recorrente -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Receita Recorrente - Ultimo Mes (${lastMonth || '-'})</h3>
        </div>
        <div style="overflow-x:auto;padding:0.5rem;">
          <table class="torre-table">
            <thead>
              <tr><th>Cliente</th><th>Produto</th><th>Valor Mensal</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${ongoingRev.filter(r => r.mes === lastMonth).map(r => `
                <tr>
                  <td>${this.escapeHtml(r.cliente)}</td>
                  <td>${this.escapeHtml(r.produto)}</td>
                  <td>R$ ${this.formatCurrency(r.valor)}</td>
                  <td><span class="torre-badge ${r.status === 'Ativo' ? 'torre-badge-green' : 'torre-badge-red'}">${this.escapeHtml(r.status)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      ${pnl.length === 0 ? `
        <div class="card" style="text-align:center;padding:3rem;">
          <p style="font-size:1.25rem;color:var(--gray-500);">Nenhum dado financeiro carregado</p>
          <p style="color:var(--gray-400);margin-top:0.5rem;">Configure GOOGLE_SHEETS_FINANCIAL_ID no .env e clique em "Sincronizar Dados"</p>
        </div>
      ` : ''}
    </div>
  `;

  this.attachFinanceiroListeners();

  // Desenhar grafico
  if (pnl.length > 0) {
    setTimeout(() => this.drawRevenueTrendChart(monthsSorted, monthsMap, products), 100);
  }
};

UIManager.prototype.attachFinanceiroListeners = function() {
  document.getElementById('btn-fin-sync')?.addEventListener('click', () => this.financialSync());
};

UIManager.prototype.financialSync = async function() {
  const btn = document.getElementById('btn-fin-sync');
  if (btn) { btn.disabled = true; btn.textContent = 'Sincronizando...'; }

  try {
    let result;
    if (window.FinancialBridge && window.FinancialBridge.isAvailable()) {
      result = await window.FinancialBridge.loadData();
    } else {
      const res = await fetch('/api/financial/load');
      result = await res.json();
    }

    if (result && result.success) {
      this.store.financialPnL = result.pnl || [];
      this.store.financialImplRevenue = result.implRevenue || [];
      this.store.financialOngoingRevenue = result.ongoingRevenue || [];
      this.store.saveFinancialPnL();
      this.store.saveFinancialImplRevenue();
      this.store.saveFinancialOngoingRevenue();
      this.showToast(`Dados financeiros sincronizados: ${result.pnl?.length || 0} P&L, ${result.implRevenue?.length || 0} impl, ${result.ongoingRevenue?.length || 0} ongoing`, 'success');
      this.renderFinanceiroTab(document.getElementById('tab-content'));
    } else {
      this.showToast('Erro: ' + (result?.error || 'Falha ao carregar'), 'error');
    }
  } catch (error) {
    this.showToast('Erro: ' + error.message, 'error');
  }

  if (btn) { btn.disabled = false; btn.textContent = 'Sincronizar Dados'; }
};

UIManager.prototype.formatCurrency = function(value) {
  if (!value && value !== 0) return '0,00';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

UIManager.prototype.drawRevenueTrendChart = function(months, monthsMap, products) {
  const canvas = document.getElementById('fin-revenue-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const padding = { top: 20, right: 30, bottom: 40, left: 80 };
  const chartW = w - padding.left - padding.right;
  const chartH = h - padding.top - padding.bottom;

  // Cores por produto
  const colors = ['#dc2626', '#2563eb', '#16a34a', '#d97706'];

  // Encontrar max receita
  let maxVal = 0;
  months.forEach(m => {
    products.forEach(p => {
      const r = monthsMap[m]?.[p];
      if (r && r.receitaBruta > maxVal) maxVal = r.receitaBruta;
    });
  });
  maxVal = maxVal * 1.1 || 1000;

  // Background
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();

    const val = maxVal - (maxVal / 4) * i;
    ctx.fillStyle = '#6b7280';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('R$ ' + (val / 1000).toFixed(0) + 'k', padding.left - 8, y + 4);
  }

  // Labels mes
  ctx.fillStyle = '#6b7280';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  months.forEach((m, i) => {
    const x = padding.left + (chartW / Math.max(months.length - 1, 1)) * i;
    ctx.fillText(m.substring(5), x, h - padding.bottom + 20);
  });

  // Linhas por produto
  products.forEach((prod, pi) => {
    ctx.strokeStyle = colors[pi % colors.length];
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    months.forEach((m, i) => {
      const r = monthsMap[m]?.[prod];
      const val = r ? r.receitaBruta : 0;
      const x = padding.left + (chartW / Math.max(months.length - 1, 1)) * i;
      const y = padding.top + chartH - (val / maxVal) * chartH;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Pontos
    months.forEach((m, i) => {
      const r = monthsMap[m]?.[prod];
      const val = r ? r.receitaBruta : 0;
      const x = padding.left + (chartW / Math.max(months.length - 1, 1)) * i;
      const y = padding.top + chartH - (val / maxVal) * chartH;

      ctx.fillStyle = colors[pi % colors.length];
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  // Legenda
  products.forEach((prod, pi) => {
    const lx = padding.left + pi * 160;
    const ly = h - 8;
    ctx.fillStyle = colors[pi % colors.length];
    ctx.fillRect(lx, ly - 8, 12, 12);
    ctx.fillStyle = '#374151';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(prod, lx + 16, ly + 2);
  });
};
