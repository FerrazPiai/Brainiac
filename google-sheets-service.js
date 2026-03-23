// ============================================================================
// GOOGLE SHEETS SERVICE - Torre de Comando + Financeiro (Leitura e Escrita)
// ============================================================================

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

class GoogleSheetsService {
  constructor() {
    this.spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    this.financialSheetId = process.env.GOOGLE_SHEETS_FINANCIAL_ID;
    this.apiKey = process.env.GOOGLE_API_KEY;
    this.credentialsFile = process.env.GOOGLE_SERVICE_ACCOUNT_FILE || 'google-credentials.json';
    this.sheets = null;
    this.authMode = null;
  }

  async initialize() {
    if (this.sheets) return true;

    // Tenta Service Account primeiro (suporta escrita)
    // Aceita credenciais via: base64 (GOOGLE_CREDENTIALS_B64), JSON inline, ou arquivo
    const credentialsB64 = process.env.GOOGLE_CREDENTIALS_B64;
    const credentialsJson = process.env.GOOGLE_CREDENTIALS_JSON;
    const credPath = path.resolve(__dirname, this.credentialsFile);

    if (credentialsB64 || credentialsJson || fs.existsSync(credPath)) {
      try {
        let authOptions;
        if (credentialsB64) {
          // Base64 — mais seguro para painéis de deploy (sem problemas de escape)
          const decoded = Buffer.from(credentialsB64, 'base64').toString('utf8');
          const credentials = JSON.parse(decoded);
          authOptions = { credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] };
          console.log('  (auth via GOOGLE_CREDENTIALS_B64)');
        } else if (credentialsJson) {
          // JSON inline — fallback
          let raw = credentialsJson.trim();
          if (raw.startsWith("'") && raw.endsWith("'")) raw = raw.slice(1, -1);
          const credentials = JSON.parse(raw);
          if (credentials.private_key && !credentials.private_key.includes('\n')) {
            credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
          }
          authOptions = { credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] };
          console.log('  (auth via GOOGLE_CREDENTIALS_JSON)');
        } else {
          authOptions = { keyFile: credPath, scopes: ['https://www.googleapis.com/auth/spreadsheets'] };
          console.log('  (auth via arquivo', this.credentialsFile + ')');
        }
        const auth = new google.auth.GoogleAuth(authOptions);
        this.sheets = google.sheets({ version: 'v4', auth });
        this.authMode = 'serviceaccount';
        console.log('✓ Google Sheets conectado (Service Account - leitura/escrita)');
        return true;
      } catch (error) {
        const safeMsg = (credentialsB64 || credentialsJson)
          ? 'Falha ao parsear credenciais — verifique GOOGLE_CREDENTIALS_B64 ou GOOGLE_CREDENTIALS_JSON'
          : error.message;
        console.error('❌ Erro ao conectar com Service Account:', safeMsg);
        this.sheets = null;
      }
    }

    // Fallback: API Key (somente leitura)
    if (this.apiKey) {
      try {
        this.sheets = google.sheets({ version: 'v4', auth: this.apiKey });
        this.authMode = 'apikey';
        console.log('✓ Google Sheets conectado (API Key - somente leitura)');
        return true;
      } catch (error) {
        console.error('❌ Erro ao conectar com API Key:', error.message);
        this.sheets = null;
      }
    }

    console.warn('⚠ Nenhuma autenticação Google configurada');
    return false;
  }

  get canWrite() {
    return this.authMode === 'serviceaccount';
  }

  isConfigured() {
    const hasAuth = this.apiKey || process.env.GOOGLE_CREDENTIALS_B64 || process.env.GOOGLE_CREDENTIALS_JSON || fs.existsSync(path.resolve(__dirname, this.credentialsFile));
    return !!(this.spreadsheetId && hasAuth);
  }

  isFinancialConfigured() {
    return !!(this.financialSheetId && this.isConfigured());
  }

  getStatus() {
    return {
      configured: this.isConfigured(),
      financialConfigured: this.isFinancialConfigured(),
      connected: !!this.sheets,
      authMode: this.authMode,
      canWrite: this.canWrite,
      spreadsheetId: this.spreadsheetId ? true : false,
      financialSheetId: this.financialSheetId ? true : false
    };
  }

  // ============================================================================
  // DESCOBRIR NOMES DAS ABAS
  // ============================================================================

  async getSheetNames(sheetId = null) {
    if (!await this.initialize()) return [];
    const targetId = sheetId || this.spreadsheetId;
    try {
      const res = await this.sheets.spreadsheets.get({
        spreadsheetId: targetId,
        fields: 'sheets.properties.title'
      });
      const names = res.data.sheets.map(s => s.properties.title);
      console.log('📋 Abas encontradas:', names.join(', '));
      return names;
    } catch (error) {
      console.error('❌ Erro ao listar abas:', error.message);
      return [];
    }
  }

  findSheet(sheetNames, ...searchTerms) {
    for (const term of searchTerms) {
      const found = sheetNames.find(name =>
        name.toLowerCase().includes(term.toLowerCase())
      );
      if (found) return found;
    }
    return null;
  }

  // ============================================================================
  // PULL: Google Sheets → App (Torre de Comando)
  // ============================================================================

  async pullAll() {
    if (!await this.initialize()) {
      return { success: false, error: 'Não foi possível conectar ao Google Sheets' };
    }

    try {
      const sheetNames = await this.getSheetNames();
      if (sheetNames.length === 0) {
        return { success: false, error: 'Não foi possível ler as abas da planilha. Verifique permissões.' };
      }

      const implSheet = this.findSheet(sheetNames, 'Implementação', 'Implementacao', 'DB - Impl', 'Impl');
      const ongoingSheet = this.findSheet(sheetNames, 'On Going', 'OnGoing', 'Ongoing', 'Recorr');
      const npsSheet = this.findSheet(sheetNames, 'NPS', 'DB - NPS');

      console.log(`📊 Aba Implementação: "${implSheet || 'NÃO ENCONTRADA'}"`);
      console.log(`📊 Aba On Going: "${ongoingSheet || 'NÃO ENCONTRADA'}"`);
      console.log(`📊 Aba NPS: "${npsSheet || 'NÃO ENCONTRADA'}"`);

      let projectsImpl = [];
      let projectsOngoing = [];
      let npsData = [];
      const warnings = [];

      if (implSheet) {
        projectsImpl = await this.pullImplementacao(implSheet);
      } else {
        warnings.push('Aba de Implementação não encontrada');
      }

      if (ongoingSheet) {
        projectsOngoing = await this.pullOngoing(ongoingSheet);
      } else {
        warnings.push('Aba de On Going não encontrada');
      }

      if (npsSheet) {
        npsData = await this.pullNPS(npsSheet);
      } else {
        warnings.push('Aba de NPS não encontrada');
      }

      return {
        success: true,
        projectsImpl: projectsImpl || [],
        projectsOngoing: projectsOngoing || [],
        npsData: npsData || [],
        sheetNames,
        warnings
      };
    } catch (error) {
      console.error('❌ Erro geral no pull:', error.message);
      return { success: false, error: error.message };
    }
  }

  async pullImplementacao(sheetName) {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A1:S1000`
      });

      const rows = res.data.values;
      if (!rows || rows.length < 2) {
        console.log(`⚠ Aba "${sheetName}" vazia ou sem dados`);
        return [];
      }

      console.log(`📋 Headers "${sheetName}":`, rows[0].join(' | '));

      const projects = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;

        const get = (col) => (row[col] || '').trim();

        // Col A=0 vazia, B=1 Cliente, C=2 Valor...
        let cliente = get(1);
        if (!cliente) cliente = get(2);
        if (!cliente) continue;

        projects.push({
          id: Date.now() + i,
          _rowIndex: i + 1,
          _sheetName: sheetName,
          cliente: get(1) || get(0),
          valor: this.parseValor(get(2)),
          tipo: get(3),
          responsavel: get(4),
          email: get(5),
          status: get(6),
          dataInicio: this.parseSheetDate(get(7)),
          prazoOriginal: this.parseSheetDate(get(8)),
          prazoRevisado: this.parseSheetDate(get(9)),
          dataEntregaReal: this.parseSheetDate(get(10)),
          motivoAtraso: get(11),
          notaCsat: parseFloat(get(12)) || 0,
          feedbackCsat: get(13),
          links: {
            documento: get(14),
            ekyte: get(15),
            contrato: get(16),
            acessos: get(17)
          },
          quarter: get(18),
          _dirty: false
        });
      }

      console.log(`✓ Pull "${sheetName}": ${projects.length} projetos`);
      return projects;
    } catch (error) {
      console.error(`❌ Erro ao ler "${sheetName}":`, error.message);
      return [];
    }
  }

  async pullOngoing(sheetName) {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A1:N1000`
      });

      const rows = res.data.values;
      if (!rows || rows.length < 2) {
        console.log(`⚠ Aba "${sheetName}" vazia ou sem dados`);
        return [];
      }

      console.log(`📋 Headers "${sheetName}":`, rows[0].join(' | '));

      const projects = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;

        const get = (col) => (row[col] || '').trim();

        let cliente = get(1);
        if (!cliente) cliente = get(2);
        if (!cliente) continue;

        projects.push({
          id: Date.now() + i + 10000,
          _rowIndex: i + 1,
          _sheetName: sheetName,
          idCliente: get(0),
          cliente: get(1),
          valor: this.parseValor(get(2)),
          tipo: get(3),
          responsavel: get(4),
          email: get(5),
          status: get(6),
          flag: get(7),
          dataInicio: this.parseSheetDate(get(8)),
          dataFim: this.parseSheetDate(get(9)),
          notaCsat: parseFloat(get(10)) || 0,
          feedbackCsat: get(11),
          linkContrato: get(12),
          _dirty: false
        });
      }

      console.log(`✓ Pull "${sheetName}": ${projects.length} projetos`);
      return projects;
    } catch (error) {
      console.error(`❌ Erro ao ler "${sheetName}":`, error.message);
      return [];
    }
  }

  async pullNPS(sheetName) {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: `'${sheetName}'!A1:G500`
      });

      const rows = res.data.values;
      if (!rows || rows.length < 2) {
        console.log(`⚠ Aba "${sheetName}" vazia ou sem dados`);
        return [];
      }

      console.log(`📋 Headers "${sheetName}":`, rows[0].join(' | '));

      const npsData = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;

        const get = (col) => (row[col] || '').trim();

        const nota = parseFloat(get(4));
        if (isNaN(nota)) continue;

        npsData.push({
          id: Date.now() + i + 20000,
          _rowIndex: i + 1,
          date: get(0),
          nomeContato: get(1),
          empresa: get(2),
          escopo: get(3),
          nota: nota,
          feedback: get(5),
          termoAceite: get(6) === 'TRUE'
        });
      }

      console.log(`✓ Pull "${sheetName}": ${npsData.length} avaliações NPS`);
      return npsData;
    } catch (error) {
      console.error(`❌ Erro ao ler NPS "${sheetName}":`, error.message);
      return [];
    }
  }

  // ============================================================================
  // PUSH: App → Google Sheets (Torre de Comando)
  // ============================================================================

  async updateRow(sheetId, sheetName, rowIndex, values) {
    if (!this.canWrite) {
      throw new Error('Escrita requer Service Account. API Key é somente leitura.');
    }
    if (!await this.initialize()) {
      throw new Error('Não foi possível conectar ao Google Sheets');
    }

    const range = `'${sheetName}'!A${rowIndex}`;
    const res = await this.sheets.spreadsheets.values.update({
      spreadsheetId: sheetId || this.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [values] }
    });

    console.log(`✓ Atualizada linha ${rowIndex} em "${sheetName}"`);
    return res.data;
  }

  async appendRow(sheetId, sheetName, values) {
    if (!this.canWrite) {
      throw new Error('Escrita requer Service Account. API Key é somente leitura.');
    }
    if (!await this.initialize()) {
      throw new Error('Não foi possível conectar ao Google Sheets');
    }

    const range = `'${sheetName}'!A:Z`;
    const res = await this.sheets.spreadsheets.values.append({
      spreadsheetId: sheetId || this.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [values] }
    });

    console.log(`✓ Nova linha adicionada em "${sheetName}"`);
    return res.data;
  }

  projectImplToRow(project) {
    return [
      '',  // Col A vazia
      project.cliente || '',
      this.formatValorForSheet(project.valor),
      project.tipo || '',
      project.responsavel || '',
      project.email || '',
      project.status || '',
      this.formatDateForSheet(project.dataInicio),
      this.formatDateForSheet(project.prazoOriginal),
      this.formatDateForSheet(project.prazoRevisado),
      this.formatDateForSheet(project.dataEntregaReal),
      project.motivoAtraso || '',
      project.notaCsat || '',
      project.feedbackCsat || '',
      (project.links && project.links.documento) || '',
      (project.links && project.links.ekyte) || '',
      (project.links && project.links.contrato) || '',
      (project.links && project.links.acessos) || '',
      project.quarter || ''
    ];
  }

  projectOngoingToRow(project) {
    return [
      project.idCliente || '',
      project.cliente || '',
      this.formatValorForSheet(project.valor),
      project.tipo || '',
      project.responsavel || '',
      project.email || '',
      project.status || '',
      project.flag || '',
      this.formatDateForSheet(project.dataInicio),
      this.formatDateForSheet(project.dataFim),
      project.notaCsat || '',
      project.feedbackCsat || '',
      project.linkContrato || ''
    ];
  }

  async pushProject(projectType, project) {
    if (!this.canWrite) {
      return { success: false, error: 'Escrita requer Service Account' };
    }

    try {
      // Descobrir _sheetName se nao tem (projeto novo)
      let sheetName = project._sheetName;
      if (!sheetName) {
        const sheetNames = await this.getSheetNames();
        if (projectType === 'impl') {
          sheetName = this.findSheet(sheetNames, 'Implementação', 'Implementacao', 'DB - Impl', 'Impl');
        } else {
          sheetName = this.findSheet(sheetNames, 'On Going', 'OnGoing', 'Ongoing', 'Recorr');
        }
        if (!sheetName) {
          return { success: false, error: 'Aba da planilha nao encontrada' };
        }
      }

      const values = projectType === 'impl'
        ? this.projectImplToRow(project)
        : this.projectOngoingToRow(project);

      if (project._rowIndex) {
        await this.updateRow(this.spreadsheetId, sheetName, project._rowIndex, values);
      } else {
        await this.appendRow(this.spreadsheetId, sheetName, values);
      }

      return { success: true };
    } catch (error) {
      console.error(`❌ Erro ao push projeto "${project.cliente}":`, error.message);
      return { success: false, error: error.message };
    }
  }

  async pushAll(projectsImpl, projectsOngoing) {
    if (!this.canWrite) {
      return { success: false, error: 'Escrita requer Service Account' };
    }

    try {
      const sheetNames = await this.getSheetNames();
      const implSheet = this.findSheet(sheetNames, 'Implementação', 'Implementacao', 'DB - Impl', 'Impl');
      const ongoingSheet = this.findSheet(sheetNames, 'On Going', 'OnGoing', 'Ongoing', 'Recorr');

      let implUpdated = 0;
      let implAdded = 0;
      let ongoingUpdated = 0;
      let ongoingAdded = 0;
      const errors = [];

      // Push implementacao (somente dirty)
      if (implSheet) {
        const dirtyImpl = projectsImpl.filter(p => p._dirty);
        for (const project of dirtyImpl) {
          try {
            const values = this.projectImplToRow(project);
            if (project._rowIndex) {
              await this.updateRow(this.spreadsheetId, implSheet, project._rowIndex, values);
              implUpdated++;
            } else {
              await this.appendRow(this.spreadsheetId, implSheet, values);
              implAdded++;
            }
          } catch (err) {
            errors.push(`Impl "${project.cliente}": ${err.message}`);
          }
        }
      }

      // Push ongoing (somente dirty)
      if (ongoingSheet) {
        const dirtyOngoing = projectsOngoing.filter(p => p._dirty);
        for (const project of dirtyOngoing) {
          try {
            const values = this.projectOngoingToRow(project);
            if (project._rowIndex) {
              await this.updateRow(this.spreadsheetId, ongoingSheet, project._rowIndex, values);
              ongoingUpdated++;
            } else {
              await this.appendRow(this.spreadsheetId, ongoingSheet, values);
              ongoingAdded++;
            }
          } catch (err) {
            errors.push(`Ongoing "${project.cliente}": ${err.message}`);
          }
        }
      }

      const total = implUpdated + implAdded + ongoingUpdated + ongoingAdded;
      console.log(`✓ Push completo: ${total} projetos sincronizados (${errors.length} erros)`);

      return {
        success: errors.length === 0,
        implUpdated,
        implAdded,
        ongoingUpdated,
        ongoingAdded,
        errors
      };
    } catch (error) {
      console.error('❌ Erro geral no push:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // PULL: Financeiro (Squad TER - segunda planilha)
  // ============================================================================

  async pullFinancial() {
    if (!this.financialSheetId) {
      return { success: false, error: 'GOOGLE_SHEETS_FINANCIAL_ID não configurado' };
    }
    if (!await this.initialize()) {
      return { success: false, error: 'Não foi possível conectar ao Google Sheets' };
    }

    try {
      const sheetNames = await this.getSheetNames(this.financialSheetId);
      if (sheetNames.length === 0) {
        return { success: false, error: 'Não foi possível ler abas da planilha financeira' };
      }

      const controlesSheet = this.findSheet(sheetNames, 'Controles', 'Controle');
      const implSheet = this.findSheet(sheetNames, 'Implementação', 'Implementacao', 'DB - Impl');
      const ongoingSheet = this.findSheet(sheetNames, 'Ongoing', 'DB - Ongoing', 'On Going');

      console.log(`💰 Aba Controles: "${controlesSheet || 'NÃO ENCONTRADA'}"`);
      console.log(`💰 Aba Impl Fin: "${implSheet || 'NÃO ENCONTRADA'}"`);
      console.log(`💰 Aba Ongoing Fin: "${ongoingSheet || 'NÃO ENCONTRADA'}"`);

      let pnl = [];
      let implRevenue = [];
      let ongoingRevenue = [];
      const warnings = [];

      if (controlesSheet) {
        pnl = await this.pullFinancialControles(controlesSheet);
      } else {
        warnings.push('Aba Controles não encontrada');
      }

      if (implSheet) {
        implRevenue = await this.pullFinancialImpl(implSheet);
      } else {
        warnings.push('Aba DB - Implementação financeira não encontrada');
      }

      if (ongoingSheet) {
        ongoingRevenue = await this.pullFinancialOngoing(ongoingSheet);
      } else {
        warnings.push('Aba DB - Ongoing financeira não encontrada');
      }

      return {
        success: true,
        pnl,
        implRevenue,
        ongoingRevenue,
        sheetNames,
        warnings
      };
    } catch (error) {
      console.error('❌ Erro geral no pull financeiro:', error.message);
      return { success: false, error: error.message };
    }
  }

  async pullFinancialControles(sheetName) {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.financialSheetId,
        range: `'${sheetName}'!A1:AZ50`
      });

      const rows = res.data.values;
      if (!rows || rows.length < 4) return [];

      // A estrutura da aba Controles tem 4 blocos de produto lado a lado:
      // Colunas G-P: Site Institucional & E-commerce
      // Colunas T-AC: IA SDR
      // Colunas AG-AP: CRM Sales
      // Colunas AT-BC: CRM Marketing (vazio por enquanto)

      // Mapeamento real das colunas (month = startCol, R.Bruta = startCol+1, ...)
      const products = [
        { name: 'Site & E-commerce', startCol: 7 },  // Month col 7, R.Bruta col 8
        { name: 'IA SDR', startCol: 19 },             // Month col 19, R.Bruta col 20
        { name: 'CRM Sales', startCol: 31 },          // Month col 31, R.Bruta col 32
        { name: 'CRM Marketing', startCol: 43 }       // Month col 43, R.Bruta col 44
      ];

      const pnl = [];

      for (const product of products) {
        // Linhas 4-15 (indices 3-14) contem os meses Jan-Dec
        for (let i = 3; i <= 14; i++) {
          const row = rows[i];
          if (!row) continue;

          const get = (col) => (row[col] || '').trim();
          const sc = product.startCol;

          const month = get(sc);
          if (!month || month === '0' || month === '0.00') continue;

          const receitaBruta = this.parseValor(get(sc + 1));
          if (receitaBruta === 0 && this.parseValor(get(sc + 4)) === 0) continue;

          pnl.push({
            month: this.parseMonthLabel(month),
            product: product.name,
            receitaBruta: receitaBruta,
            royalties: this.parseValor(get(sc + 2)),
            impostos: this.parseValor(get(sc + 3)),
            receitaLiquida: this.parseValor(get(sc + 4)),
            csp: this.parseValor(get(sc + 5)),
            cspOverhead: this.parseValor(get(sc + 6)),
            lucroBruto: this.parseValor(get(sc + 7)),
            margemOps: this.parsePercentage(get(sc + 8)),
            pctFolha: this.parsePercentage(get(sc + 9))
          });
        }
      }

      console.log(`✓ Pull Controles: ${pnl.length} registros P&L`);
      return pnl;
    } catch (error) {
      console.error(`❌ Erro ao ler Controles:`, error.message);
      return [];
    }
  }

  async pullFinancialImpl(sheetName) {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.financialSheetId,
        range: `'${sheetName}'!A1:F200`
      });

      const rows = res.data.values;
      if (!rows || rows.length < 2) return [];

      console.log(`📋 Headers Fin Impl:`, rows[0].join(' | '));

      const implRevenue = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;

        const get = (col) => (row[col] || '').trim();

        const valor = this.parseValor(get(0));
        const cliente = get(4);
        if (!cliente) continue;

        implRevenue.push({
          valor: valor,
          produto: get(1),
          email: get(2),
          dataInicio: this.parseSheetDate(get(3)),
          cliente: cliente,
          mesInicio: get(5)
        });
      }

      console.log(`✓ Pull Fin Impl: ${implRevenue.length} projetos`);
      return implRevenue;
    } catch (error) {
      console.error(`❌ Erro ao ler Fin Impl:`, error.message);
      return [];
    }
  }

  async pullFinancialOngoing(sheetName) {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.financialSheetId,
        range: `'${sheetName}'!A1:F500`
      });

      const rows = res.data.values;
      if (!rows || rows.length < 2) return [];

      console.log(`📋 Headers Fin Ongoing:`, rows[0].join(' | '));

      const ongoingRevenue = [];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;

        const get = (col) => (row[col] || '').trim();

        const cliente = get(2);
        if (!cliente) continue;

        ongoingRevenue.push({
          mes: get(0),
          valor: this.parseValor(get(1)),
          cliente: cliente,
          produto: get(3),
          email: get(4),
          status: get(5)
        });
      }

      console.log(`✓ Pull Fin Ongoing: ${ongoingRevenue.length} registros`);
      return ongoingRevenue;
    } catch (error) {
      console.error(`❌ Erro ao ler Fin Ongoing:`, error.message);
      return [];
    }
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  parseValor(value) {
    if (!value) return 0;
    const clean = value.replace(/[R$\s.]/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  }

  parsePercentage(value) {
    if (!value) return 0;
    const clean = value.replace('%', '').replace(',', '.').trim();
    const num = parseFloat(clean);
    if (isNaN(num)) return 0;
    return num > 1 ? num / 100 : num;
  }

  parseMonthLabel(value) {
    if (!value) return '';
    // "January/2026" -> "2026-01"
    const months = {
      'january': '01', 'february': '02', 'march': '03', 'april': '04',
      'may': '05', 'june': '06', 'july': '07', 'august': '08',
      'september': '09', 'october': '10', 'november': '11', 'december': '12',
      'janeiro': '01', 'fevereiro': '02', 'marco': '03', 'março': '03', 'abril': '04',
      'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
      'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
    };
    const match = value.match(/^(.+)\/(\d{4})$/);
    if (match) {
      const normalized = match[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const monthNum = months[normalized] || months[match[1].toLowerCase()];
      if (monthNum) return `${match[2]}-${monthNum}`;
    }
    // MM/YYYY
    const match2 = value.match(/^(\d{1,2})\/(\d{4})$/);
    if (match2) return `${match2[2]}-${match2[1].padStart(2, '0')}`;
    return value;
  }

  parseSheetDate(value) {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
    const num = parseFloat(value);
    if (!isNaN(num) && num > 40000) {
      const d = new Date((num - 25569) * 86400000);
      return d.toISOString().split('T')[0];
    }
    return value;
  }

  formatValorForSheet(value) {
    if (!value || value === 0) return 0;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return 0;
    return num; // Envia numero puro - Google Sheets aplica a formatacao da coluna
  }

  formatDateForSheet(isoDate) {
    if (!isoDate) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return isoDate; // Google Sheets entende ISO
    }
    return isoDate;
  }
}

module.exports = GoogleSheetsService;
