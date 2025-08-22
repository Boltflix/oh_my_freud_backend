// src/routes/interpret.js (CommonJS) — robusto e rápido
// POST /api/interpret
// Body: { text: string, lang?: 'pt-BR'|'en-US'|'es-ES'|'fr-FR' }
// Resposta SEMPRE: { result: { summary, analysis, symbols[], themes[], associationPrompts[], language } }

const express = require('express');
const router = express.Router();

const SUPPORTED = new Set(['pt-BR', 'en-US', 'es-ES', 'fr-FR']);
const DEFAULT_LANG = 'pt-BR';
const TIMEOUT_MS = 12000; // soft timeout: 12s

// ---------- Utils ----------
function wordCount(s = '') {
  return String(s).trim().split(/\s+/).filter(Boolean).length;
}
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) =>
      setTimeout(() => resolve({ __timeout: true }), ms)
    ),
  ]);
}
function safeParseJSON(maybe) {
  if (typeof maybe === 'object' && maybe) return maybe;
  try {
    const cleaned = String(maybe || '')
      // tenta extrair JSON bruto se vier com lixo ao redor
      .replace(/^[\s\S]*?({[\s\S]*})[\s\S]*$/m, '$1');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}
function normalizeResult(obj, lang) {
  // Garante chaves e tamanhos mínimos
  const r = (obj && obj.result) || {};
  const summary = String(r.summary || '').trim();
  const analysis = String(r.analysis || '').trim();
  const symbols = Array.isArray(r.symbols) ? r.symbols : [];
  const themes = Array.isArray(r.themes) ? r.themes : [];
  const associationPrompts = Array.isArray(r.associationPrompts) ? r.associationPrompts : [];
  return {
    result: {
      summary,
      analysis,
      symbols,
      themes,
      associationPrompts,
      language: SUPPORTED.has(lang) ? lang : DEFAULT_LANG,
    },
  };
}

// ---------- MOCKS longos (fallback imediato) ----------
function longMock(text = '', lang = DEFAULT_LANG) {
  const L = SUPPORTED.has(lang) ? lang : DEFAULT_LANG;

  const packs = {
    'pt-BR': {
      summary:
        'O sonho encena um vaivém entre desejo e censura: você flerta com a transgressão e, ao mesmo tempo, tenta domesticar o que insiste em viver.',
      p: [
        'Se eu (Freud) pudesse cochichar ao seu ouvido: que espetáculo! O sonho brinca com truques clássicos da mente — deslocamento, condensação e formações de compromisso. Onde a cena parece banal, a graça é justamente o camuflado: o desejo quer palco, a censura quer cortina. O resultado é uma comédia de portas batendo e reaparecendo em outro corredor.',
        'Repare nas passagens, quartos e mudanças de luz: símbolos de fronteira entre o que se sabe e o que ainda não ousa ser dito. A casa fala do eu e seus cômodos psíquicos; a água, dos afetos que pedem nome; os animais, de uma vitalidade que você tenta adestrar com boas maneiras. Nada “certo” ou “errado”: matéria-prima da sua autoria.',
        'O humor do sonho não é superficial; ele é a válvula pela qual o eu suporta tensões. Quando você ri, o supereu relaxa um botão e permite experimentos. A função clínica do sonho é essa oficina: ensaiar respostas sem punição totalizante, repetir com diferença até surgir um gesto mais seu.',
        'O que se repete? A quase-escolha, a quase-palavra, o quase-encontro. A ambivalência não é defeito: é bússola. Ela indica onde o desejo precisa negociar limites, não para ser esmagado, mas para ganhar contorno. A pergunta não é “posso?”, e sim “como posso me responsabilizar pelo que quero?”.',
        'Cuide também do palco diurno: ritmo de sono, telas, cafeína, movimento. Pequenos ajustes ampliam a capacidade de simbolizar; e quando a simbolização cresce, os sonhos ficam mais espertos, mais generosos — e você acorda menos refém do enredo.',
      ],
      symbols: [
        { name: 'Portas/Passagens', meaning: 'Limites psíquicos; autorização e recuo.' },
        { name: 'Casa/Quartos', meaning: 'Configuração do self; intimidade e defesa.' },
        { name: 'Água', meaning: 'Afetos em fluxo; conteúdos pré-verbais buscando nome.' },
        { name: 'Animais', meaning: 'Pulsões e vitalidade; desejo menos domesticado.' },
        { name: 'Luz/Sombra', meaning: 'Campo entre consciência e recalcado.' },
        { name: 'Estradas', meaning: 'Transição e autoria do caminho.' },
      ],
      themes: [
        'Ambivalência e autorização do desejo',
        'Controle vs. entrega',
        'Pertencimento e individuação',
        'Humor como recurso clínico',
      ],
      prompts: [
        'Que pedido eu não fiz no sonho por receio de desapontar alguém?',
        'Onde senti culpa — e a quem essa culpa realmente pertence?',
        'Que limite desejo afirmar com gentileza nesta semana?',
        'Se eu pudesse refilmar uma cena, o que mudaria no meu gesto?',
        'Qual detalhe mínimo (cor, cheiro, textura) me puxa para uma lembrança?',
        'Quem, na vida diurna, pode apoiar um pequeno passo de autonomia?',
      ],
    },
    'en-US': {
      summary:
        'Your dream stages a tug-of-war between desire and censorship: you flirt with transgression while trying to tame what wants to live.',
      p: [
        'If I, old Freud, may whisper: what a show! The dream toys with displacement, condensation, and compromise formations. Where the scene looks ordinary, its charm is camouflage: desire asks for a stage; censorship pulls the curtain. Cue the farce of doors slamming and reappearing down another hall.',
        'Notice thresholds, rooms, and shifts of light: boundaries between what you know and what you do not yet allow yourself to say. House images speak of self-structure; water of affects seeking a name; animals of a vitality you try to housebreak. Nothing “good” or “bad”: raw material for authorship.',
        'Humor here is not superficial; it’s the valve by which the ego tolerates tensions. Laughter loosens the superego a notch and permits experiments. Dreaming is a workshop: rehearsal without total punishment, repetition with difference until a more personal gesture appears.',
        'What repeats? The almost-choice, the almost-word, the almost-encounter. Ambivalence is not a bug; it’s a compass showing where desire must negotiate limits — not to be crushed but to gain contour. The question is less “may I?” and more “how do I take responsibility for what I want?”.',
        'Mind the waking stage: sleep rhythm, screens, caffeine, movement. Small tweaks widen symbolization; as it grows, dreams get cleverer and kinder — and you wake less captive to the plot.',
      ],
      symbols: [
        { name: 'Doors/Passages', meaning: 'Psychic boundaries; permission and retreat.' },
        { name: 'House/Rooms', meaning: 'Self configuration; intimacy and defense.' },
        { name: 'Water', meaning: 'Affects in flux; pre-verbal contents seeking a name.' },
        { name: 'Animals', meaning: 'Drives and vitality; less domesticated wishes.' },
        { name: 'Light/Shadow', meaning: 'Interface of awareness and repression.' },
        { name: 'Roads', meaning: 'Transition and authorship of one’s path.' },
      ],
      themes: [
        'Ambivalence and the authorization of desire',
        'Control vs. surrender',
        'Belonging and individuation',
        'Humor as clinical resource',
      ],
      prompts: [
        'Which request went unsaid in the dream?',
        'Where did guilt appear — and whose is it?',
        'What boundary can I affirm kindly this week?',
        'If I refilmed one scene, what would my gesture change?',
        'Which tiny detail (color, smell, texture) pulls a memory?',
        'Who can support one small step toward autonomy?',
      ],
    },
  };

  const pack = packs[L] || packs['pt-BR'];
  const analysis = pack.p.join('\n\n');
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

// ---------- ROTA ----------
router.post('/', async (req, res) => {
  const { text = '', lang = DEFAULT_LANG } = req.body || {};
  const L = SUPPORTED.has(lang) ? lang : DEFAULT_LANG;

  const key = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  // Sem chave → devolve rápido mock rico
  if (!key) return res.json(longMock(text, L));

  try {
    // import dinâmico (CommonJS-friendly)
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: key });

    const sys = {
      'pt-BR':
        'Você é um psicanalista espirituoso (vibe Freud leve), escrevendo em português do Brasil, com humor e precisão clínica.',
      'en-US':
        'You are a witty psychoanalyst (light Freud vibe), writing in warm, clear American English with clinical precision.',
      'es-ES':
        'Eres un psicoanalista ingenioso (toque Freud), en español claro y cálido, con precisión clínica.',
      'fr-FR':
        'Vous êtes un psychanalyste enlevé (vibe Freud légère), en français clair et chaleureux, avec précision clinique.',
    }[L];

    const userPrompt = `
Dream text:
${text || '(empty)'}

Write EVERYTHING in ${L}. Tone: playful-Freud + serious psychoanalytic lens (displacement, condensation, compromise formation, ambivalence). No moralizing.

Return ONLY JSON with EXACT shape:
{
  "result": {
    "summary": "1 paragraph (concise, hook)",
    "analysis": "4–6 paragraphs totalling 650–900 words, flowing prose (no bullets)",
    "symbols": [{"name":"…","meaning":"…"}],  // at least 5
    "themes": ["…"],                          // 3–6
    "associationPrompts": ["…"],              // 5–7
    "language": "${L}"
  }
}
No preamble. No markdown. No extra keys.`;

    // chama a API com timeout suave
    const apiCall = client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.75,
      max_tokens: 1700,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: userPrompt },
      ],
    });

    const completion = await withTimeout(apiCall, TIMEOUT_MS);

    // se estourou timeout → mock imediato
    if (completion && completion.__timeout) {
      return res.json(longMock(text, L));
    }

    const raw = completion?.choices?.[0]?.message?.content || '';
    const parsed = safeParseJSON(raw);
    let safe = normalizeResult(parsed, L);

    // reforça mínimos: se análise veio curta ou vazia, usa mock
    if (wordCount(safe.result.analysis) < 300 || !safe.result.summary) {
      safe = longMock(text, L);
    }
    // símbolos/temas/perguntas mínimos
    if ((safe.result.symbols || []).length < 5 ||
        (safe.result.themes || []).length < 3 ||
        (safe.result.associationPrompts || []).length < 5) {
      const m = longMock(text, L);
      // preserva summary/analysis do LLM se estiverem bons, completa listas com o mock
      safe.result.summary = wordCount(safe.result.summary) ? safe.result.summary : m.result.summary;
      safe.result.analysis = wordCount(safe.result.analysis) >= 300 ? safe.result.analysis : m.result.analysis;
      safe.result.symbols = m.result.symbols;
      safe.result.themes = m.result.themes;
      safe.result.associationPrompts = m.result.associationPrompts;
    }

    return res.json(safe);
  } catch (err) {
    console.error('[INTERPRET ERROR]', err);
    // Nada de 500: devolve mock longo
    return res.json(longMock(text, L));
  }
});

module.exports = router;
