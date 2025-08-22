// src/routes/interpret.js (CommonJS)
// POST /api/interpret
// Body: { text: string, lang?: 'pt-BR'|'en-US'|'es-ES'|'fr-FR' }
// Resposta SEMPRE: { result: { summary, analysis, psychoanalyticAnalysis, analysisText, longAnalysis, symbols[], themes[], associationPrompts[], language } }

const express = require('express');
const router = express.Router();

const SUPPORTED = new Set(['pt-BR', 'en-US', 'es-ES', 'fr-FR']);
const DEFAULT_LANG = 'pt-BR';
const TIMEOUT_MS = 12000; // 12s: se a IA não respondeu, devolvemos mock longo sem travar a UI

// ---------- helpers ----------
const wc = (s = '') => String(s).trim().split(/\s+/).filter(Boolean).length;

const withTimeout = (p, ms) =>
  Promise.race([
    p,
    new Promise(resolve => setTimeout(() => resolve({ __timeout: true }), ms)),
  ]);

function safeParse(maybe) {
  if (maybe && typeof maybe === 'object') return maybe;
  try {
    const cleaned = String(maybe || '').replace(/^[\s\S]*?({[\s\S]*})[\s\S]*$/m, '$1');
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function normalize(obj, lang) {
  const r = (obj && obj.result) || {};
  const base = {
    summary: (r.summary || '').trim(),
    analysis: (r.analysis || '').trim(),
    symbols: Array.isArray(r.symbols) ? r.symbols : [],
    themes: Array.isArray(r.themes) ? r.themes : [],
    associationPrompts: Array.isArray(r.associationPrompts) ? r.associationPrompts : [],
    language: SUPPORTED.has(lang) ? lang : DEFAULT_LANG,
  };
  // aliases para não quebrar front que espera nomes diferentes
  base.psychoanalyticAnalysis = base.analysis;
  base.analysisText = base.analysis;
  base.longAnalysis = base.analysis;
  return { result: base };
}

// ---------- conteúdo off-line (mock + parágrafos extras) ----------
function basePack(lang) {
  const L = SUPPORTED.has(lang) ? lang : DEFAULT_LANG;
  if (L === 'en-US') {
    return {
      summary:
        'Your dream stages a tug-of-war between desire and censorship: you flirt with transgression while trying to tame what wants to live.',
      paras: [
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
    };
  }
  // pt-BR (default)
  return {
    summary:
      'O sonho encena um vaivém entre desejo e censura: você flerta com a transgressão e, ao mesmo tempo, tenta domesticar o que insiste em viver.',
    paras: [
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
  };
}

function expandParas(lang) {
  // parágrafos extras para garantir 650–900 palavras quando necessário
  const L = SUPPORTED.has(lang) ? lang : DEFAULT_LANG;
  if (L === 'en-US') {
    return [
      'Clinically, the interplay between wish and defense often borrows familiar faces to make the scene bearable. A relative or partner may stand in for a rule, a fear, or a hope. Treat the cast as functions: who opens, who blocks, who watches? Naming functions disentangles people from projections and gives you room to act differently.',
      'A practical note: when a dream brings a strong object (a ring, a door, a bird), use it as a hinge for free association. Write three memories tied to it, then one bold, impossible sentence that liberates the scene. The point is not truth but elasticity — the ego discovering more moves on the board.',
    ];
  }
  return [
    'Clinicamente, o jogo entre desejo e defesa costuma emprestar rostos familiares para tornar a cena suportável. Um parente ou parceiro pode funcionar como regra, medo ou esperança. Trate o elenco como funções: quem abre, quem bloqueia, quem observa? Nomear funções descola pessoas de projeções e dá espaço para agir diferente.',
    'Dica prática: quando o sonho traz um objeto forte (aliança, porta, ave), use-o como dobradiça para associação livre. Escreva três memórias ligadas a ele e, depois, uma frase impossível que liberte a cena. O objetivo não é a “verdade”, e sim a elasticidade — o eu descobrindo mais lances no tabuleiro.',
  ];
}

function longMock(text, lang) {
  const pack = basePack(lang);
  const analysis = [...pack.paras, ...expandParas(lang)].join('\n\n');
  const r = {
    summary: pack.summary,
    analysis,
    symbols: pack.symbols,
    themes: pack.themes,
    associationPrompts: pack.prompts,
    language: SUPPORTED.has(lang) ? lang : DEFAULT_LANG,
  };
  // aliases para não quebrar front que espera outro nome
  r.psychoanalyticAnalysis = r.analysis;
  r.analysisText = r.analysis;
  r.longAnalysis = r.analysis;
  return { result: r };
}

function ensureLength(resultObj, lang) {
  // se a análise veio curta, completa com parágrafos extras
  const minWords = 650;
  if (wc(resultObj.result.analysis) >= minWords) return resultObj;

  const extras = expandParas(lang).join('\n\n');
  const combined = [resultObj.result.analysis, extras].filter(Boolean).join('\n\n');
  resultObj.result.analysis = combined;
  resultObj.result.psychoanalyticAnalysis = combined;
  resultObj.result.analysisText = combined;
  resultObj.result.longAnalysis = combined;
  return resultObj;
}

// ---------- rota principal ----------
router.post('/', async (req, res) => {
  const { text = '', lang = DEFAULT_LANG } = req.body || {};
  const L = SUPPORTED.has(lang) ? lang : DEFAULT_LANG;

  const key = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!key) {
    return res.json(longMock(text, L));
  }

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: key });

    const sys = {
      'pt-BR':
        'Você é um psicanalista espirituoso (vibe Freud leve), com precisão clínica e texto fluido, sem moralizar.',
      'en-US':
        'You are a witty psychoanalyst (light Freud vibe) with clinical precision and flowing prose, no moralizing.',
      'es-ES':
        'Eres un psicoanalista ingenioso (toque Freud), con precisión clínica y prosa fluida, sin moralizar.',
      'fr-FR':
        'Vous êtes un psychanalyste enlevé (vibe Freud légère), précis cliniquement, prose fluide, sans moralisme.',
    }[L];

    const prompt = `
Dream text:
${text || '(empty)'}

Write EVERYTHING in ${L}. Tone: playful-Freud + real psychoanalytic reading (displacement, condensation, compromise formation, ambivalence).
Return ONLY JSON:
{
  "result": {
    "summary": "1 paragraph (concise, hook)",
    "analysis": "4–6 paragraphs, 650–900 words, prose (no bullets)",
    "symbols": [{"name":"…","meaning":"…"}],   // >=5
    "themes": ["…"],                            // 3–6
    "associationPrompts": ["…"],                // 5–7
    "language": "${L}"
  }
}
No preamble. No markdown. No extra keys.`;

    const apiCall = client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.75,
      max_tokens: 1750,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: prompt },
      ],
    });

    const completion = await withTimeout(apiCall, TIMEOUT_MS);
    if (completion && completion.__timeout) {
      return res.json(longMock(text, L));
    }

    const raw = completion?.choices?.[0]?.message?.content || '';
    const parsed = safeParse(raw);
    let safe = normalize(parsed, L);

    // preencher símbolos/temas/perguntas mínimos
    if ((safe.result.symbols || []).length < 5 ||
        (safe.result.themes || []).length < 3 ||
        (safe.result.associationPrompts || []).length < 5 ||
        wc(safe.result.summary) < 12 ||
        wc(safe.result.analysis) < 300) {
      // mistura o que vier com mock para nunca ficar pobre
      const mock = longMock(text, L);
      safe.result.summary = wc(safe.result.summary) >= 12 ? safe.result.summary : mock.result.summary;
      safe.result.analysis = wc(safe.result.analysis) >= 300 ? safe.result.analysis : mock.result.analysis;
      safe.result.symbols = mock.result.symbols;
      safe.result.themes = mock.result.themes;
      safe.result.associationPrompts = mock.result.associationPrompts;
      safe.result.psychoanalyticAnalysis = safe.result.analysis;
      safe.result.analysisText = safe.result.analysis;
      safe.result.longAnalysis = safe.result.analysis;
    }

    // garante 650+ palavras no final
    safe = ensureLength(safe, L);

    return res.json(safe);
  } catch (err) {
    console.error('[INTERPRET ERROR]', err);
    return res.json(longMock(text, L));
  }
});

module.exports = router;
