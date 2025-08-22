// src/routes/interpret.js (CommonJS)
// POST /api/interpret
// Body: { text: string, lang?: 'pt-BR'|'en-US'|'es-ES'|'fr-FR' }
// Resposta: { result: { summary, analysis, symbols[], themes[], associationPrompts[], language } }

const express = require('express');
const router = express.Router();

const SUPPORTED = new Set(['pt-BR', 'en-US', 'es-ES', 'fr-FR']);
const DEFAULT_LANG = 'pt-BR';

// MOCK longo se faltar OPENAI_API_KEY
function longMock(lang = DEFAULT_LANG) {
  const L = SUPPORTED.has(lang) ? lang : DEFAULT_LANG;
  const pack = {
    'pt-BR': {
      summary: 'O sonho encena uma travessia entre o riso e o assombro: desejo pedindo palco e limites pedindo direção.',
      analysis: [
        'Vamos por partes, com um pé na brincadeira e outro na clínica. Se eu — o velho Freud — pudesse sentar ao seu lado, eu diria: que imaginação vibrante! O sonho brinca de esconde-esconde com cenas de desejo e pequenas sabotagens. Há humor, e onde há humor, há engenho do eu para suportar tensões.',
        'No registro psicanalítico, aparecem deslocamentos (objetos trocando de lugar), condensações (duas ideias numa imagem) e compromissos entre o que você quer e o que teme querer. Portas que quase se abrem, caminhos que quase se tomam; o “quase” é o palco da ambivalência.',
        'A casa e a água sugerem contenção e fluxo afetivo. Animais e sombras apontam para pulsões menos domesticadas. Nada disso é “bom” ou “mau”: são pistas. O sonho serve para ensaiar — repetir com diferença — aquilo que, acordado, seria arriscado demais.',
        'Divertido? Sim — e justamente por isso terapêutico. O riso faz dobra com a seriedade: autoriza você a experimentar novas respostas sem culpa totalizante. Brincar com a imagem abre espaço para nomear o indizível.',
        'Tome como convite: que limites podem ser afirmados com gentileza? Em que cena você se calou? O que precisa de acolhimento antes de mudança?',
        'Por fim, cuide do cenário real: sono, telas, vínculos, ritmo. Pequenos ajustes aumentam a capacidade de simbolizar — e os sonhos ficam mais “espertos”, no melhor sentido.',
      ],
      symbols: [
        { name: 'Portas', meaning: 'Decisão/limite psíquico: abrir/fechar, permitir/adiar.' },
        { name: 'Casa', meaning: 'Configuração do self; intimidade e proteção.' },
        { name: 'Água', meaning: 'Afetos em fluxo; conteúdos primitivos buscando nome.' },
        { name: 'Animais', meaning: 'Pulsões e vigor; vitalidade não domesticada.' },
        { name: 'Luz/Sombra', meaning: 'Campo entre consciência e recalcado.' },
        { name: 'Estradas', meaning: 'Transição; autoria do próprio caminho.' },
      ],
      themes: [
        'Ambivalência e autorização do desejo',
        'Controle vs. entrega',
        'Pertencimento e individuação',
        'Reescrita de cenas internas',
      ],
      prompts: [
        'Que pedido ficou preso na garganta no sonho?',
        'Onde a culpa apareceu — e de quem é?',
        'Que limite posso afirmar com mais delicadeza hoje?',
        'Que cena repetiria de outro modo se pudesse?',
        'O que em mim precisa de colo antes de mudança?',
        'Quem, no sonho, aponta para apoio realista?',
      ],
    },
    'en-US': {
      summary: 'The dream stages a passage between play and awe: desire seeking a stage, limits seeking direction.',
      analysis: [
        'Let’s keep one foot in play and one in the clinic. If I — old Freud — sat beside you, I’d say: what a lively imagination! The dream plays hide-and-seek with desire and small self-sabotages. Humor appears, and where humor appears, the ego engineers relief for tension.',
        'Psychoanalytically we see displacement, condensation, and compromise formations between what you want and what you fear to want. Doors almost opening; paths almost taken — the “almost” is ambivalence’s theatre.',
        'House and water suggest containment and affective flow. Animals and shadows point to less domesticated drives. None of this is “good” or “bad”: they are clues. Dreaming rehearses — repeating with difference — what would feel risky by day.',
        'Is it entertaining? Yes — and precisely therapeutic. Laughter folds into seriousness, authorizing new responses without totalizing guilt. Playing with images creates room to name the unsayable.',
        'Take it as an invitation: which boundary can be affirmed kindly? Where did you fall silent? What needs holding before change?',
        'Mind the waking stage: sleep hygiene, screens, relationships, rhythm. Tiny tweaks enlarge symbolization — dreams become “clever” in the best sense.',
      ],
      symbols: [
        { name: 'Doors', meaning: 'Decisions/psychic limits: open/close, allow/delay.' },
        { name: 'House', meaning: 'Self configuration; intimacy and protection.' },
        { name: 'Water', meaning: 'Affects in flow; primitive contents seeking a name.' },
        { name: 'Animals', meaning: 'Drives and vitality; less domesticated wishes.' },
        { name: 'Light/Shadow', meaning: 'Interface of awareness and repression.' },
        { name: 'Roads', meaning: 'Transition; authorship of one’s path.' },
      ],
      themes: ['Ambivalence and desire', 'Control vs. surrender', 'Belonging and individuation', 'Rewriting inner scenes'],
      prompts: [
        'What request stayed unspoken in the dream?',
        'Where did guilt appear — and whose is it?',
        'Which boundary can you affirm kindly today?',
        'Which scene would you replay differently?',
        'What needs holding before change?',
        'Who mirrors realistic support?',
      ],
    },
    'es-ES': { /* similar ao acima, omitido por brevidade no mock */ },
    'fr-FR': { /* similar ao acima, omitido por brevidade no mock */ },
  }[L];

  const analysis = pack.analysis.join('\n\n');
  return {
    result: {
      summary: pack.summary,
      analysis,
      symbols: pack.symbols,
      themes: pack.themes,
      associationPrompts: pack.prompts,
      language: L,
    },
  };
}

router.post('/', async (req, res) => {
  const { text = '', lang = DEFAULT_LANG } = req.body || {};
  const L = SUPPORTED.has(lang) ? lang : DEFAULT_LANG;
  try {
    const key = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
    if (!key) return res.json(longMock(L));

    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: key });

    const sys = {
      'pt-BR': 'Você é um psicanalista com humor sutil, escrevendo em português do Brasil, acolhedor e claro.',
      'en-US': 'You are a psychoanalyst with gentle humor, writing in warm, clear American English.',
      'es-ES': 'Eres un psicoanalista con humor sutil, en español claro y cálido.',
      'fr-FR': 'Vous êtes un psychanalyste à l’humour discret, en français clair et chaleureux.',
    }[L];

    const userPrompt = `
Dream text (user): 
${text}

Write EVERYTHING in ${L}.
Style: entertaining, witty, **as if Freud himself were playfully commenting**, but grounded in psychoanalytic concepts (displacement, condensation, compromise formation, ambivalence). Blend charm + clinical depth. No moralizing.

Return ONLY JSON:
{
  "result": {
    "summary": "1 concise paragraph capturing desire/tension",
    "analysis": "4–6 cohesive paragraphs, 600–900 words, playful Freud-voice + real psychoanalytic reading (no bullet points)",
    "symbols": [{"name":"...","meaning":"..."}, ...] // >=5 items
    "themes": ["..."] // 3–6
    "associationPrompts": ["..."] // 5–7 reflective prompts
    "language": "${L}"
  }
}
No preamble, no markdown, no extra keys.
`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userPrompt },
      ],
    });

    let raw = completion.choices?.[0]?.message?.content || '';
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = longMock(L); }
    const safe = parsed?.result ? parsed : longMock(L);
    return res.json(safe);
  } catch (err) {
    console.error('[INTERPRET ERROR]', err);
    return res.json(longMock(L));
  }
});

module.exports = router;
