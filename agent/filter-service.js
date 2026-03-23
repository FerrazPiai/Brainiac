// ============================================================================
// FILTER-SERVICE.JS — Processa transcrição via Claude API (Filtro Inteligente)
// ============================================================================

const Anthropic = require('@anthropic-ai/sdk');
const config = require('./config');

const client = new Anthropic({ apiKey: config.anthropic.apiKey });

/**
 * Gera o system prompt para o filtro inteligente.
 */
function buildSystemPrompt(people, projects, meetingDate) {
  return `Você é um assistente especializado em processar transcrições de reuniões e extrair informações estruturadas. Sua tarefa é analisar a transcrição fornecida e retornar EXCLUSIVAMENTE um JSON válido, sem nenhum texto adicional, sem markdown, sem backticks.

## Contexto da equipe

Pessoas disponíveis no sistema: ${JSON.stringify(people)}
Projetos disponíveis no sistema: ${JSON.stringify(projects)}

## Regras de processamento

### 1. Classificação do tipo de call
Classifique a reunião em uma das categorias:
- "call_cliente": reunião com cliente externo (identificável por nomes de empresas, discussão de entregas, propostas, contratos)
- "call_interna": reunião apenas entre membros do time (dailies, planning, retrospectivas, 1:1)
- "call_parceiro": reunião com parceiros ou fornecedores
- "call_outro": não se encaixa nas categorias acima

### 2. Extração de action items
Extraia APENAS compromissos concretos e acionáveis mencionados na reunião. Exemplos do que É action item:
- "Pedro, manda a proposta atualizada até sexta" → action item
- "Walter vai configurar o ambiente de staging" → action item
- "Precisamos agendar uma call com o time de vendas" → action item

Exemplos do que NÃO É action item:
- Opiniões ou comentários ("Acho que o design ficou bom")
- Informações compartilhadas ("A taxa de conversão está em 3%")
- Perguntas sem resolução ("Será que devemos mudar a abordagem?")

### 3. Atribuição de pessoa
Para cada action item, identifique quem é o responsável:
- Se alguém disser "eu vou fazer X", o responsável é quem disse
- Se alguém disser "Pedro, faz X", o responsável é Pedro
- Se ninguém for explicitamente atribuído, use "não_definido"
- O nome da pessoa DEVE existir na lista de pessoas disponíveis (case-insensitive). Se o nome mencionado não existir na lista, use o mais próximo. Se não houver correspondência, use "não_definido"

### 4. Classificação de prioridade
Para cada action item, classifique a prioridade:
- "alta": menções explícitas de urgência ("urgente", "pra ontem", "antes de tudo", "prioridade máxima"), bloqueadores de outras tarefas, promessas a clientes com prazo apertado
- "média": tem prazo definido mas não é urgente, ou foi enfatizado como importante
- "normal": tarefas mencionadas sem ênfase de urgência ou prazo apertado

### 5. Identificação de projeto
Se a reunião mencionou um projeto específico da lista disponível, associe. Se não, deixe null.

### 6. Inferência de data
- Se um prazo foi mencionado explicitamente ("até sexta", "semana que vem"), calcule a data a partir da data da reunião: ${meetingDate}
- "Hoje" = data da reunião
- "Amanhã" = data da reunião + 1 dia
- "Sexta" = próxima sexta-feira a partir da data da reunião
- "Semana que vem" = segunda-feira da próxima semana
- Se nenhum prazo foi mencionado, use a data da reunião + 3 dias úteis como default

## Formato de saída OBRIGATÓRIO

Retorne APENAS este JSON, sem nenhum texto antes ou depois:

{
  "meeting_type": "call_cliente",
  "meeting_summary": "Resumo de 1-2 frases do que foi discutido",
  "project": "NomeDoProjeto",
  "tasks": [
    {
      "description": "Descrição clara e concisa do action item",
      "person": "Pedro",
      "date": "2026-03-20",
      "priority": "alta",
      "tags": ["follow-up"],
      "context": "Trecho ou momento relevante da transcrição que originou esta tarefa"
    }
  ],
  "insights": {
    "decisions_made": ["Lista de decisões tomadas na reunião"],
    "open_questions": ["Perguntas que ficaram sem resposta"],
    "next_meeting_suggested": true
  }
}

Se não houver nenhum action item na transcrição, retorne o JSON com "tasks" como array vazio.
Nunca invente tarefas que não foram mencionadas.
Nunca atribua tarefas a pessoas que não foram mencionadas como responsáveis.`;
}

/**
 * Processa uma transcrição usando a Claude API.
 *
 * @param {string} transcript - Texto completo da transcrição
 * @param {object} meetingInfo - Informações do meeting
 * @param {string} meetingInfo.date - Data da reunião (YYYY-MM-DD)
 * @param {string} meetingInfo.title - Título do evento
 * @param {Array} meetingInfo.attendees - Lista de participantes
 * @param {string[]} people - Lista de pessoas disponíveis no Brainiac
 * @param {string[]} projects - Lista de projetos disponíveis no Brainiac
 * @returns {object} - JSON estruturado com tarefas e insights
 */
async function processTranscript(transcript, meetingInfo, people, projects) {
  const systemPrompt = buildSystemPrompt(people, projects, meetingInfo.date);

  const attendeesList = meetingInfo.attendees
    ? meetingInfo.attendees.map(a => a.name || a.email).join(', ')
    : 'Não disponível';

  const userMessage = `Data da reunião: ${meetingInfo.date}
Título do evento: ${meetingInfo.title}
Participantes: ${attendeesList}

--- TRANSCRIÇÃO ---

${transcript}`;

  console.log(`   🤖 Enviando transcrição para Claude API (${transcript.length} caracteres)...`);

  const response = await client.messages.create({
    model: config.anthropic.model,
    max_tokens: config.anthropic.maxTokens,
    temperature: config.anthropic.temperature,
    system: systemPrompt,
    messages: [
      { role: 'user', content: userMessage }
    ]
  });

  const rawText = response.content[0].text;

  // Tentar fazer parse do JSON
  try {
    return JSON.parse(rawText);
  } catch (e) {
    // Tentar remover possíveis backticks/markdown
    const cleaned = rawText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      console.error('   ❌ Claude retornou JSON inválido:');
      console.error('   ', rawText.substring(0, 200));
      throw new Error('Claude API retornou JSON inválido');
    }
  }
}

module.exports = { processTranscript };
