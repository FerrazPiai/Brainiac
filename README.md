# 🧠 Segundo Cérebro - Task Manager Desktop

Sistema completo de gerenciamento de tarefas com memória de contexto, desenvolvido como aplicação desktop com Electron.

## 📋 Funcionalidades

### 🎯 Sistema de Tarefas
- ✅ **Entrada Rápida de Comandos**: Adicione múltiplas tarefas rapidamente usando sintaxe simples
- 📝 **Formulário Manual**: Interface tradicional para adicionar tarefas individuais
- 📥 **Importador de Checklist**: Importe checklists markdown automaticamente
- 🔍 **Filtros Avançados**: Filtre por pessoa, data, prioridade e status
- 👥 **Gestão Dinâmica de Pessoas**: Adicione/remova pessoas do time
- 📁 **Projetos**: Associe tarefas a projetos específicos
- 🏷️ **Tags**: Organize tarefas com tags customizadas
- 🎨 **Prioridades Visuais**: Alta, Média e Normal com cores distintas
- 📊 **Dashboard**: Visualize tarefas de hoje, atrasadas e estatísticas de conclusão

### 📚 Sistema de Memória
- 📄 **Upload de Documentos**: Suporte para TXT, MD e PDF
- 🔎 **Busca em Documentos**: Busque em todo o conteúdo dos documentos
- 📁 **Organização por Projetos**: Associe documentos a projetos
- 🏷️ **Tags para Documentos**: Categorize e encontre documentos facilmente
- 👁️ **Preview e Visualização**: Veja o conteúdo completo dos documentos

### ⚙️ Configurações
- 📊 **Estatísticas Completas**: Acompanhe produtividade e métricas
- 👥 **Gestão de Pessoas**: Adicione/remova membros do time
- 📁 **Gestão de Projetos**: Crie e organize projetos
- 💾 **Export/Import**: Backup e restauração de dados em JSON
- ⌨️ **Atalhos de Teclado**: Produtividade máxima

## 🚀 Instalação

### Pré-requisitos
- Node.js instalado (versão 16 ou superior)
- npm ou yarn

### Passos

1. **Instalar dependências:**
   ```bash
   npm install
   ```

2. **Executar a aplicação:**
   ```bash
   npm start
   ```

3. **Compilar para produção (opcional):**
   ```bash
   npm run build
   ```
   O executável será gerado na pasta `dist/`

## 📖 Como Usar

### 1️⃣ Adicionando Tarefas via Comandos Rápidos

A forma mais rápida de adicionar tarefas é usando a **sintaxe de comandos**:

```
Pessoa Data - Descrição [Prioridade] @Projeto #tag
```

#### Exemplos:

```
Walter 09/02 - Adicionar dashboard [alta]
Pedro hoje - Enviar mensagem @Marthan #urgent
Paulo amanhã - Review de código
todos 15/02 - Reunião de review
```

#### Sintaxe:

**Pessoa:**
- Nome da pessoa (ex: `Walter`, `Pedro`, `Paulo`)
- Use `todos` para criar a tarefa para todas as pessoas

**Data:**
- `hoje` ou `today`
- `amanhã` ou `amanha` ou `tomorrow`
- `DD/MM` (ex: `09/02`)
- `DD/MM/YYYY` (ex: `09/02/2026`)

**Prioridade (opcional):**
- `[alta]` ou `[high]` → 🔴 Alta
- `[média]` ou `[media]` ou `[medium]` → 🟡 Média
- Sem especificar → 🔵 Normal

**Projeto (opcional):**
- Use `@NomeProjeto` (ex: `@Monnaie`, `@Marthan`)

**Tags (opcional):**
- Use `#tag` (ex: `#urgent`, `#backend`, `#review`)

### 2️⃣ Importando Checklist Markdown

Você pode importar checklists no formato markdown:

```markdown
## 🎯 WALTER - AÇÕES IMEDIATAS (HOJE)
- [ ] Adicionar 3 colunas no dashboard (prazo: 12/02) [alta]
- [ ] Conversar com time sobre taxa de conversão

## 🎯 PEDRO - AÇÕES IMEDIATAS (HOJE)
- [ ] Enviar mensagem sobre Marthan [alta]
- [x] Atualizar documentação (tarefa concluída)
```

**Como importar:**
1. Clique no botão "📥 Importar Checklist"
2. Selecione o arquivo `.md` ou `.txt`
3. As tarefas serão automaticamente criadas

### 3️⃣ Adicionando Tarefas Manualmente

Use o formulário manual para adicionar tarefas individuais:

1. Clique em "+ Formulário Manual"
2. Preencha os campos:
   - **Descrição** (obrigatório)
   - **Pessoa** (selecione da lista)
   - **Data**
   - **Prioridade** (Normal, Média, Alta)
   - **Projeto** (opcional)
   - **Tags** (opcional, separadas por vírgula)
3. Clique em "+ Adicionar Tarefa"

### 4️⃣ Filtrando Tarefas

Use os filtros para visualizar tarefas específicas:

- **Pessoa**: Filtre por membro do time
- **Data**: Hoje, Amanhã, Atrasadas, ou Todas
- **Prioridade**: Alta, Média, Normal, ou Todas
- **Status**: Pendentes, Concluídas, ou Todas
- **Buscar**: Pesquise em descrições, pessoas, projetos e tags

### 5️⃣ Gerenciando Documentos

**Upload de Documentos:**

1. Vá para a aba "📚 Memória"
2. (Opcional) Selecione um projeto
3. (Opcional) Adicione tags separadas por vírgula
4. Clique na área de upload
5. Selecione um ou mais arquivos (TXT, MD, PDF)

**Buscar Documentos:**

Use a barra de busca para encontrar documentos por:
- Nome do arquivo
- Conteúdo do documento
- Projeto associado
- Tags

**Visualizar Documento:**

Clique em "Ver completo →" para abrir o documento em modal.

### 6️⃣ Gestão de Pessoas e Projetos

**Adicionar Pessoa:**

1. Vá para "⚙️ Configurações"
2. Na seção "Gestão de Pessoas", clique em "+ Adicionar"
3. Digite o nome da pessoa
4. A pessoa estará disponível imediatamente em todos os formulários

**Adicionar Projeto:**

1. Vá para "⚙️ Configurações"
2. Na seção "Gestão de Projetos", clique em "+ Adicionar"
3. Digite o nome do projeto
4. Configure o status (active, implementation, churned)

### 7️⃣ Export e Import de Dados

**Exportar:**

1. Vá para "⚙️ Configurações"
2. Clique em "📥 Exportar Dados"
3. Escolha onde salvar o arquivo JSON
4. Todos os dados (tarefas, documentos, pessoas, projetos) serão salvos

**Importar:**

1. Vá para "⚙️ Configurações"
2. Clique em "📤 Importar Dados"
3. Selecione o arquivo JSON exportado anteriormente
4. Todos os dados serão restaurados

## ⌨️ Atalhos de Teclado

| Atalho | Ação |
|--------|------|
| `Ctrl+K` | Focus no campo de comandos rápidos |
| `Ctrl+N` | Abrir formulário manual de nova tarefa |
| `Ctrl+F` | Focus na busca/filtros |
| `Esc` | Fechar modals e formulários |

## 📊 Dashboard e Estatísticas

A aplicação fornece métricas em tempo real:

**Dashboard de Tarefas:**
- 📅 Tarefas de hoje
- ⚠️ Tarefas atrasadas
- ✅ Taxa de conclusão

**Estatísticas Gerais:**
- Total de tarefas criadas
- Tarefas concluídas
- Taxa de conclusão percentual
- Pessoa mais ativa
- Total de documentos
- Tarefas de hoje pendentes
- Tarefas atrasadas
- Total de projetos

## 💾 Persistência de Dados

Os dados são salvos automaticamente no localStorage do Electron, garantindo que:

- ✅ Dados persistem entre sessões
- ✅ Não há necessidade de banco de dados externo
- ✅ Backup simples via Export/Import
- ✅ Dados privados e locais

**Storage Keys:**
- `checklist-tasks` - Lista de tarefas
- `checklist-people` - Lista de pessoas
- `brain-documents` - Documentos armazenados
- `brain-projects` - Lista de projetos

## 🎨 Interface

A aplicação possui design moderno e intuitivo:

- 🎨 Gradiente de cores suave (azul/cinza)
- 📱 Responsivo (funciona em janelas pequenas)
- 🌈 Código de cores por prioridade
- 🔔 Notificações toast para feedback
- 🎭 Animações suaves
- 🌓 Interface clara e organizada

## 🏗️ Estrutura do Projeto

```
Braniac/
├── main.js              # Processo principal do Electron
├── index.html           # HTML base
├── renderer.js          # Lógica da aplicação (UI + Data)
├── styles.css           # Estilos completos
├── package.json         # Configuração do projeto
└── README.md           # Este arquivo
```

## 🔧 Tecnologias

- **Electron** - Framework para aplicações desktop
- **JavaScript Vanilla** - Sem frameworks pesados
- **CSS3** - Estilização moderna
- **localStorage** - Persistência de dados
- **Node.js** - Runtime e file system access

## 📝 Projetos Pré-configurados

A aplicação vem com os seguintes projetos já configurados:

1. **Monnaie** (Active)
2. **HS Golden** (Active)
3. **Marthan** (Active)
4. **Multimax** (Active)
5. **Big Credit** (Implementation)
6. **Ozox** (Implementation)

Você pode adicionar, editar ou remover projetos nas configurações.

## 🎯 Casos de Uso

### Gerenciamento de Sprint
```
Walter hoje - Setup do ambiente de desenvolvimento [alta]
Pedro 10/02 - Implementar API de autenticação @BackendAPI #urgent
Paulo 11/02 - Criar componentes de UI @Frontend
todos 12/02 - Reunião de review da sprint
```

### Acompanhamento de Cliente
```
Pedro hoje - Call com Monnaie sobre Dashboard [alta] @Monnaie
Walter 10/02 - Enviar proposta para HS Golden @HSGolden
Paulo 11/02 - Follow-up Marthan sobre integração @Marthan #followup
```

### Documentação de Projetos
1. Upload de transcrições de reuniões
2. Associar ao projeto correto
3. Adicionar tags relevantes (#review, #requirements, #design)
4. Buscar facilmente quando necessário

## 🆘 Solução de Problemas

**A aplicação não inicia:**
- Verifique se o Node.js está instalado
- Execute `npm install` novamente
- Verifique se não há erros no console

**Dados não estão salvando:**
- Verifique as permissões de escrita
- Tente fazer um Export manual dos dados
- Limpe o cache do Electron

**Importação de checklist não funciona:**
- Verifique o formato do arquivo markdown
- Certifique-se que os nomes das pessoas existem
- Veja o console para erros

## 🚀 Próximas Melhorias (Ideias)

- [ ] Sincronização em nuvem (Google Drive, Dropbox)
- [ ] Notificações de desktop para tarefas
- [ ] Lembretes e prazos com alarmes
- [ ] Tema escuro/claro
- [ ] Suporte a subtarefas
- [ ] Anexos de imagens
- [ ] Calendário visual
- [ ] Exportação para PDF
- [ ] Integração com Trello/Asana/Jira

## 📄 Licença

MIT License - Livre para uso pessoal e comercial.

## 👨‍💻 Autor

Pedro - Desenvolvido para aumentar a produtividade do time.

---

**Desenvolvido com ❤️ e ☕**

Para sugestões, bugs ou melhorias, entre em contato!
