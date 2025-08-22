// src/routes/wellness.js (CommonJS)
// POST /api/wellness/sleep-hygiene
// POST /api/wellness/free-association
// Ambas respeitam lang e devolvem blocos prontos pra renderizar.

const express = require('express');
const router = express.Router();

const SUP = new Set(['pt-BR','en-US','es-ES','fr-FR']);
const DEF = 'pt-BR';

function mockSleep(lang=DEF){
  const L = SUP.has(lang)?lang:DEF;
  const t = {
    'pt-BR': {
      overview: 'Plano prático de 7 dias com rotinas simples, micro-hábitos e checkpoints para melhorar qualidade e continuidade do sono.',
      exercises: [
        { title: 'Ritual Noturno 20-20-20', duration: '20+20+20 min', steps: ['Desacelerar telas/estímulos', 'Higiene básica + luz baixa', 'Leitura leve/respiração 4-7-8'] },
        { title: 'Manhã Luz & Ritmo', duration: '10–15 min', steps: ['Luz natural na 1ª hora', 'Hidratar', 'Movimento leve'] },
        { title: 'Corte de Estímulos', duration: '2–3h antes de dormir', steps: ['Cafeína/álcool: evitar', 'Janta leve', 'Tela com filtro quente'] },
      ],
      weeklyPlan: [
        { day: 'Dia 1', focus: 'Diagnóstico', actions: ['Registrar horários', 'Anotar despertares'] },
        { day: 'Dia 2', focus: 'Ambiente', actions: ['Quarto escuro e fresco', 'Travesseiro adequado'] },
        { day: 'Dia 3', focus: 'Ritual', actions: ['Aplicar 20-20-20', 'Respiração 4-7-8'] },
        { day: 'Dia 4', focus: 'Consistência', actions: ['Mesma janela de sono', 'Cafeína até 14h'] },
        { day: 'Dia 5', focus: 'Movimento', actions: ['Caminhada leve', 'Alongamento noturno'] },
        { day: 'Dia 6', focus: 'Nutrição', actions: ['Janta cedo', 'Evitar ultraprocessados'] },
        { day: 'Dia 7', focus: 'Revisão', actions: ['Ajustar horários', 'Planejar próxima semana'] },
      ],
      cautions: ['Se ronco/apneia: procurar avaliação médica', 'Evitar telas na cama', 'Se insônia persistente: procurar especialista'],
    },
    'en-US': {
      overview: 'A 7-day practical plan with simple routines, micro-habits, and checkpoints to improve sleep quality and continuity.',
      exercises: [
        { title: 'Night Ritual 20-20-20', duration: '20+20+20 min', steps: ['Wind-down screens/stimuli', 'Hygiene + dim lights', 'Light reading / 4-7-8 breathing'] },
        { title: 'Morning Light & Rhythm', duration: '10–15 min', steps: ['Natural light in first hour', 'Hydrate', 'Gentle movement'] },
        { title: 'Stimulus Cutoff', duration: '2–3h pre-bed', steps: ['Avoid caffeine/alcohol', 'Light dinner', 'Warm color temperature on screens'] },
      ],
      weeklyPlan: [
        { day: 'Day 1', focus: 'Baseline', actions: ['Log bed/wake times', 'Note awakenings'] },
        { day: 'Day 2', focus: 'Environment', actions: ['Dark/cool room', 'Supportive pillow'] },
        { day: 'Day 3', focus: 'Ritual', actions: ['Apply 20-20-20', 'Do 4-7-8 breathing'] },
        { day: 'Day 4', focus: 'Consistency', actions: ['Fixed sleep window', 'Caffeine before 2pm'] },
        { day: 'Day 5', focus: 'Movement', actions: ['Light walk', 'Evening stretch'] },
        { day: 'Day 6', focus: 'Nutrition', actions: ['Early dinner', 'Avoid ultra-processed'] },
        { day: 'Day 7', focus: 'Review', actions: ['Adjust timings', 'Plan next week'] },
      ],
      cautions: ['Snoring/apnea → medical eval', 'No screens in bed', 'Persistent insomnia → specialist'],
    },
    'es-ES': { /* similar */ },
    'fr-FR': { /* similar */ },
  }[L];
  return { result: { ...t, language: L } };
}

function mockAssoc(lang=DEF){
  const L = SUP.has(lang)?lang:DEF;
  const t = {
    'pt-BR': {
      guidance: 'Sente-se confortável, cronometre 10–12 minutos. Escreva sem censura; se travar, descreva o travamento.',
      session: [
        'Comece com a primeira imagem do sonho. O que veio em seguida, sem filtro?',
        'Troque a imagem por uma palavra. Que lembrança recente cola nessa palavra?',
        'Se esse sonho fosse um meme, qual seria a legenda?',
        'Que parte de você pediu voz aí? Onde essa voz aparece na vida diurna?',
        'Escreva uma frase impossível sobre o sonho. O que ela libera?',
        'Volte a um detalhe mínimo (cor, cheiro, textura). O que ele te lembra?',
        'Crie um final alternativo corajoso. O que muda em você?',
        'Liste 3 culpas que não te pertencem.',
        'Qual limite pode ser afirmado com gentileza amanhã?',
        'Feche com uma linha: “Hoje eu autorizo…”',
      ],
      cautions: ['Se surgir sofrimento intenso, pare e procure suporte qualificado.'],
    },
    'en-US': {
      guidance: 'Sit comfortably, set a 10–12 min timer. Write without censorship; if you stall, describe the stall.',
      session: [
        'Start from the dream’s first image. What came next, unfiltered?',
        'Swap the image for a word. Which recent memory sticks to it?',
        'If this dream were a meme, what’s the caption?',
        'Which part of you asked for voice there? Where does it show up by day?',
        'Write one impossible sentence about the dream. What does it unlock?',
        'Return to a tiny detail (color, smell, texture). What does it recall?',
        'Invent a brave alternate ending. What shifts in you?',
        'List 3 guilts that are not yours.',
        'Which boundary can you assert kindly tomorrow?',
        'Close with one line: “Today I authorize…”',
      ],
      cautions: ['If intense distress arises, pause and seek qualified support.'],
    },
    'es-ES': { /* similar */ },
    'fr-FR': { /* similar */ },
  }[L];
  return { result: { ...t, language: L } };
}

router.post('/sleep-hygiene', async (req, res) => {
  const { lang = DEF, preferences = {} } = req.body || {};
  const L = SUP.has(lang) ? lang : DEF;

  try {
    const key = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
    if (!key) return res.json(mockSleep(L));

    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: key });

    const prompt = `
Write EVERYTHING in ${L}.
Create a practical sleep-hygiene kit tailored for a busy adult:
- "overview": 2–3 sentences.
- "exercises": array of 3–5 items {title, duration, steps[3–5]}.
- "weeklyPlan": 7 items {day, focus, actions[2–3]}.
- "cautions": 2–4 succinct notes.
Return ONLY JSON with { "result": { overview, exercises, weeklyPlan, cautions, language:"${L}" } }.
No markdown.
User preferences (optional): ${JSON.stringify(preferences)}
`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.6,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are a concise behavioral sleep coach with evidence-informed advice.' },
        { role: 'user', content: prompt },
      ],
    });

    let raw = completion.choices?.[0]?.message?.content || '';
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = mockSleep(L); }
    const safe = parsed?.result ? parsed : mockSleep(L);
    res.json(safe);
  } catch (e) {
    console.error('[SLEEP HYGIENE ERROR]', e);
    res.json(mockSleep(L));
  }
});

router.post('/free-association', async (req, res) => {
  const { lang = DEF, mode = 'freud' } = req.body || {};
  const L = SUP.has(lang) ? lang : DEF;

  try {
    const key = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
    if (!key) return res.json(mockAssoc(L));

    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: key });

    const sys =
      mode === 'freud'
        ? 'You are a playful, precise psychoanalyst channeling a light Freud vibe, without moralizing.'
        : 'You are a neutral, supportive journaling coach.';

    const prompt = `
Write EVERYTHING in ${L}.
Provide:
- "guidance": 1–2 sentences for setup (timer, no censorship).
- "session": 10 numbered prompts (short, lively, safe).
- "cautions": 1–2 brief safety notes.
Return ONLY JSON { "result": { guidance, session, cautions, language: "${L}" } }.
No markdown.
`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: prompt },
      ],
    });

    let raw = completion.choices?.[0]?.message?.content || '';
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = mockAssoc(L); }
    const safe = parsed?.result ? parsed : mockAssoc(L);
    res.json(safe);
  } catch (e) {
    console.error('[FREE ASSOCIATION ERROR]', e);
    res.json(mockAssoc(L));
  }
});

module.exports = router;
