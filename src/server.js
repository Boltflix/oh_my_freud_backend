// src/server.js (CommonJS) — rota de interpretação inline, sem arquivos extras

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

/* -------------------- CORS (antes do json) -------------------- */
const allowed = new Set([
  'https://ohmyfreud.site',
  'https://www.ohmyfreud.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
app.use(
  cors({
    origin: (origin, cb) => (!origin || allowed.has(origin)) ? cb(null, true) : cb(null, false),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
);
app.options('*', cors());

/* -------------------- Stripe webhook (raw) -------------------- */
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

/* -------------------- Demais rotas em JSON -------------------- */
app.use(express.json());

/* -------------------- Helpers comuns -------------------- */
const SUPPORTED = new Set(['pt-BR', 'en-US', 'es-ES', 'fr-FR']);
const DEFAULT_LANG = 'pt-BR';
const TIMEOUT_MS = 12000;

const wc = (s = '') => String(s).trim().split(/\s+/).filter(Boolean).length;
const withTimeout = (p, ms) =>
  Promise.race([p, new Promise(r => setTimeout(() => r({ __timeout: true }), ms))]);

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
  const L = SUPPORTED.has(lang) ? lang : DEFAULT_LANG;
  if (L === 'en-US') {
    return [
      'Clinically, the interplay between wish and defense often borrows familiar faces to make the scene bearable. Treat the cast as functions: who opens, who blocks, who watches? Naming functions disentangles people from projections and gives you room to act differently.',
      'A practical note: when a dream brings a strong object (a ring, a door, a bird), use it as a hinge for free association. Write three memories tied to it, then one bold, impossible sentence that liberates the scene.',
    ];
  }
  return [
    'Clinicamente, o jogo entre desejo e defesa costuma emprestar rostos familiares para tornar a cena suportável. Trate o elenco como funções: quem abre, quem bloqueia, quem observa? Nomear funções descola pessoas de projeções e dá espaço para agir diferente.',
    'Dica prática: quando o sonho traz um objeto forte (aliança, porta, ave), use-o como dobradiça para associação livre. Escreva três memórias ligadas a ele e depois uma frase impossível que liberte a cena.',
  ];
}
function longMock(lang) {
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
  // aliases que seu front pode estar esperando
  r.psychoanalyticAnalysis = r.analysis;
  r.analysisText = r.analysis;
  r.longAnalysis = r.analysis;
  return { result: r };
}

/* -------------------- Health -------------------- */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'oh-my-freud-backend', ts: new Date().toISOString() });
});

/* -------------------- Interpret (inline) -------------------- */
app.post('/api/interpret', async (req, res) => {
  const { text = '', lang = DEFAULT_LANG } = req.body || {};
  const L = SUPPORTED.has(lang) ? lang : DEFAULT_LANG;
  const key = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;

  if (!key) return res.json(longMock(L));

  try {
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: key });

    const sys = {
      'pt-BR': 'Você é um psicanalista espirituoso (vibe Freud leve), com precisão clínica e prosa fluida.',
      'en-US': 'You are a witty psychoanalyst (light Freud vibe), with clinical precision and flowing prose.',
      'es-ES': 'Eres un psicoanalista ingenioso (toque Freud), con precisión clínica y prosa fluida.',
      'fr-FR': 'Vous êtes un psychanalyste enlevé (vibe Freud légère), précis et fluide.',
    }[L];

    const prompt = `
Dream text:
${text || '(empty)'}

Write EVERYTHING in ${L}. Tone: playful-Freud + real psychoanalytic reading (displacement, condensation, compromise formation, ambivalence).
Return ONLY JSON EXACTLY like:
{
  "result": {
    "summary": "1 paragraph (concise, hook)",
    "analysis": "4–6 paragraphs, 650–900 words, flowing prose (no bullets)",
    "symbols": [{"name":"…","meaning":"…"}],  // at least 5
    "themes": ["…"],                           // 3–6
    "associationPrompts": ["…"],               // 5–7
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

    const out = await withTimeout(apiCall, TIMEOUT_MS);
    if (out && out.__timeout) return res.json(longMock(L));

    const raw = out?.choices?.[0]?.message?.content || '';
    let parsed = null;
    try {
      const cleaned = String(raw).replace(/^[\s\S]*?({[\s\S]*})[\s\S]*$/m, '$1');
      parsed = JSON.parse(cleaned);
    } catch {}

    // fallback/normalização
    let result = parsed && parsed.result ? parsed.result : longMock(L).result;

    // reforço de tamanho/conteúdo
    if (wc(result.analysis || '') < 650) {
      result.analysis = [result.analysis || '', ...expandParas(L)].join('\n\n').trim();
    }
    if (!Array.isArray(result.symbols) || result.symbols.length < 5) {
      result.symbols = basePack(L).symbols;
    }
    if (!Array.isArray(result.themes) || result.themes.length < 3) {
      result.themes = basePack(L).themes;
    }
    if (!Array.isArray(result.associationPrompts) || result.associationPrompts.length < 5) {
      result.associationPrompts = basePack(L).prompts;
    }
    result.language = L;

    // aliases que o front pode usar
    result.psychoanalyticAnalysis = result.analysis;
    result.analysisText = result.analysis;
    result.longAnalysis = result.analysis;

    return res.json({ result });
  } catch (e) {
    console.error('[INTERPRET ERROR]', e);
    return res.json(longMock(L));
  }
});
// alias aceito pelo front
app.post('/interpret', (req, res) => app._router.handle({ ...req, url: '/api/interpret', method: 'POST' }, res, () => {}));

/* -------------------- Stripe (carrega sem quebrar se export variar) -------------------- */
function loadStripe() {
  try {
    const mod = require('./routes/stripe');
    const router =
      (mod && typeof mod === 'function' && typeof mod.use === 'function') ? mod
      : (mod && typeof mod.router === 'function' && typeof mod.router.use === 'function') ? mod.router
      : null;
    const createCheckout = typeof mod?.createCheckout === 'function' ? mod.createCheckout : null;
    return { router, createCheckout };
  } catch (e) {
    console.warn('[WARN] stripe router not loaded:', e.message);
    return { router: null, createCheckout: null };
  }
}
const { router: stripeRouter, createCheckout } = loadStripe();
if (stripeRouter) app.use('/api/stripe', stripeRouter);
if (createCheckout) {
  app.post('/api/premium', (req, res) => createCheckout(req, res));
  app.post('/premium', (req, res) => createCheckout(req, res));
}

/* -------------------- Health/erros -------------------- */
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'oh-my-freud-backend', ts: new Date().toISOString() });
});
app.use((err, req, res, next) => {
  console.error('[UNHANDLED]', err);
  res.status(500).json({ error: 'internal_error', detail: err?.message || 'unknown' });
});

/* -------------------- Start -------------------- */
const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}
module.exports = app;

