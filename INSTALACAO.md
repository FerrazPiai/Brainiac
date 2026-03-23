# 🚀 Guia Rápido de Instalação - Segundo Cérebro

## ⚡ Instalação Rápida (3 minutos)

### 1️⃣ Pré-requisitos

Você precisa ter instalado:
- **Node.js** (versão 16 ou superior)
  - [Download Node.js](https://nodejs.org/)
  - Para verificar se está instalado: `node --version`

### 2️⃣ Instalar Dependências

Abra o terminal/prompt de comando nesta pasta e execute:

```bash
npm install
```

Isso vai instalar:
- Electron (framework desktop)
- Electron Builder (para criar executáveis)

### 3️⃣ Executar a Aplicação

Depois que a instalação terminar, execute:

```bash
npm start
```

A aplicação abrirá automaticamente! 🎉

---

## 📦 Criar Executável (Opcional)

Se quiser criar um arquivo `.exe` para distribuir:

```bash
npm run build
```

O executável estará em: `dist/Segundo Cérebro Setup.exe`

---

## 🆘 Problemas Comuns

### ❌ "node não é reconhecido como comando"

**Solução:** Node.js não está instalado ou não está no PATH.
1. Baixe e instale o Node.js: https://nodejs.org/
2. Reinicie o terminal
3. Verifique: `node --version`

### ❌ "Erro ao instalar dependências"

**Solução:**
```bash
# Limpe o cache e tente novamente
npm cache clean --force
npm install
```

### ❌ "Aplicação não abre"

**Solução:**
```bash
# Reinstale as dependências
rm -rf node_modules
npm install
npm start
```

### ❌ "Erro de permissão"

**Solução (Windows):**
Execute o terminal como Administrador

**Solução (Linux/Mac):**
```bash
sudo npm install
```

---

## 📁 Estrutura de Arquivos

```
Braniac/
├── main.js                    # ⚙️ Electron main process
├── index.html                 # 📄 HTML base
├── renderer.js                # 🎨 Lógica da UI
├── styles.css                 # 💅 Estilos CSS
├── package.json               # 📦 Config do projeto
├── README.md                  # 📖 Documentação completa
├── INSTALACAO.md             # 🚀 Este arquivo
├── exemplo-checklist.md       # 📋 Exemplo de checklist
└── exemplos-comandos.txt      # ⚡ Exemplos de comandos
```

---

## ✅ Verificação de Instalação

Após executar `npm start`, você deve ver:

1. ✅ Uma janela do Electron abrindo
2. ✅ Interface com 3 abas: Tarefas, Memória, Configurações
3. ✅ Dashboard mostrando "0 tarefas pendentes"
4. ✅ Pessoas pré-cadastradas: Walter, Pedro, Paulo
5. ✅ Projetos pré-cadastrados: Monnaie, HS Golden, etc.

---

## 🎯 Primeiros Passos

### Teste 1: Adicionar tarefa via comando
1. Na aba "Tarefas"
2. Digite no campo de comandos:
   ```
   Walter hoje - Testar a aplicação [alta]
   ```
3. Clique em "⚡ Processar Comandos"
4. ✅ Tarefa deve aparecer na lista

### Teste 2: Importar checklist
1. Clique em "📥 Importar Checklist"
2. Selecione o arquivo `exemplo-checklist.md`
3. ✅ Múltiplas tarefas devem ser criadas

### Teste 3: Upload de documento
1. Vá para aba "📚 Memória"
2. Clique na área de upload
3. Selecione um arquivo `.txt` ou `.md`
4. ✅ Documento deve aparecer na lista

---

## 🔧 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `npm start` | Inicia a aplicação em modo desenvolvimento |
| `npm run build` | Cria executável para distribuição |
| `npm install` | Instala/reinstala dependências |

---

## 💡 Dicas

1. **Atalhos de Teclado:**
   - `Ctrl+K` - Focus no campo de comandos
   - `Ctrl+N` - Abrir formulário manual
   - `Ctrl+F` - Buscar
   - `Esc` - Fechar modals

2. **Backup de Dados:**
   - Vá em Configurações → Exportar Dados
   - Salve o arquivo JSON em local seguro
   - Para restaurar: Configurações → Importar Dados

3. **Performance:**
   - Dados são salvos no localStorage (rápido!)
   - Sem necessidade de internet
   - Sem banco de dados externo

---

## 📞 Suporte

Se tiver problemas:

1. ✅ Verifique se o Node.js está instalado: `node --version`
2. ✅ Reinstale as dependências: `npm install`
3. ✅ Veja o console para erros (F12 na aplicação)
4. ✅ Leia o README.md completo para mais detalhes

---

## 🎉 Pronto!

Sua aplicação está instalada e funcionando!

**Próximos passos:**
1. Leia o `README.md` para documentação completa
2. Veja `exemplos-comandos.txt` para aprender a sintaxe
3. Importe o `exemplo-checklist.md` para testar
4. Configure suas pessoas e projetos
5. Comece a usar! 🚀

---

**Desenvolvido com ❤️ para aumentar sua produtividade!**
