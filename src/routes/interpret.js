// src/routes/interpret.js
const express = require("express");
const router = express.Router();

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "";

function normalizeLang(langRaw) {
  const v = (langRaw || "").toLowerCase();
  if (v.startsWith("pt")) return "pt-BR";
  if (v.startsWith("es")) return "es-ES";
  if (v.startsWith("fr")) return "fr-FR";
  return "en-US";
}

function systemPrompt(lang) {
  const base =
    "You are a witty, empathic psychoanalyst channeling Sigmund Freud. Write vivid, entertaining yet respectful analyses grounded in classical psychoanalytic theory (wish-fulfillment, dream-work, displacement, condensation, primary/secondary process). Always return JSON with keys: summary, analysis, symbols, themes, associationPrompts.";
  const map = {
    "pt-BR":
      "Você é um psicanalista espirituoso e empático, canalizando Sigmund Freud. Escreva análises vívidas, envolventes e respeitosas, com base na teoria clássica (realização de desejo, trabalho do sonho, deslocamento, condensação, processos primário/secundário). Retorne SEMPRE JSON com as chaves: summary, analysis, symbols, themes, associationPrompts.",
    "es-ES":
      "Eres un psicoanalista ingenioso y empático, canalizando a Sigmund Freud. Escribe análisis vívidos, entretenidos y respetuosos, basados en la teoría clásica (satisfacción del deseo, trabajo onírico, desplazamiento, condensación, proceso primario/secundario). Devuelve SIEMPRE JSON con: summary, analysis, symbols, themes, associationPrompts.",
    "fr-FR":
      "Vous êtes un psychanalyste spirituel et empathique, canalisant Sigmund Freud. Rédigez des analyses vives et respectueuses, ancrées dans la théorie classique (réalisation du désir, travail du rêve, déplacement, condensation, processus primaire/secondaire). Retournez TOUJOURS un JSON avec : summary, analysis, symbols, themes, associationPrompts.",
    "en-US": base,
  };
  return map[lang] || base;
}

function userPrompt({ title, text, mood, sleepQuality, isRecurring, lang }) {
  const note = `LANG=${lang}`;
  return `
${note}
TITLE: ${title || "(untitled)"}
DREAM_TEXT:
${text || "(empty)"}

CONTEXT:
- Mood (1-5): ${mood || "-"}
- Sleep quality (1-5): ${sleepQuality || "-"}
- Recurring: ${isRecurring ? "yes" : "no"}

TASK:
1) 1-paragraph SUMMARY (2–4 sentences).
2) Deep PSYCHOANALYTIC ANALYSIS of 600–900+ words in 4–6 paragraphs using Freud concepts (wish-fulfillment, dream-work, censorship, displacement, condensation, manifest vs latent content, primary/secondary processes), balancing rigor and entertaining tone.
3) At least 5 SYMBOLS with short meanings (array of {symbol, meaning}).
4) 3–6 THEMES (short strings).
5) 5–7 ASSOCIATION PROMPTS (questions to spark free association).

STRICT JSON ONLY:
{
  "summary": "...",
  "analysis": "...",
  "symbols": [{"symbol":"...", "meaning":"..."}],
  "themes": ["...", "..."],
  "associationPrompts": ["...", "...", "..."]
}
`;
}

async function callOpenAI({ system, user, max_tokens = 1600, temperature = 0.7 }) {
  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature,
      max_tokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI HTTP ${resp.status}: ${txt}`);
  }
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}

function mockLong(lang) {
  const isPT = lang === "pt-BR";
  const isES = lang === "es-ES";
  const isFR = lang === "fr-FR";
  return {
    summary: isPT
      ? "Este sonho encena um desejo disfarçado e a fricção entre censura e expressão."
      : isES
      ? "Este sueño escenifica un deseo disfrazado y la fricción entre censura y expresión."
      : isFR
      ? "Ce rêve met en scène un désir déguisé et la friction entre censure et expression."
      : "This dream stages a disguised wish and the friction between censorship and expression.",
    analysis:
      (isPT
        ? "Análise longa (~800+ palavras) descrevendo deslocamento, condensação, censura onírica, conteúdo manifesto vs. latente, etc., em tom envolvente..."
        : isES
        ? "Análisis largo (~800+ palabras) con desplazamiento, condensación, censura onírica, contenido manifiesto vs. latente, etc., con tono ameno..."
        : isFR
        ? "Analyse longue (~800+ mots) avec déplacement, condensation, censure onirique, contenu manifeste vs. latent, etc., un ton vivant..."
        : "Long analysis (~800+ words) with displacement, condensation, dream censorship, manifest vs latent content, etc., entertaining tone..."),
    symbols: [
      { symbol: isPT ? "Porta" : isES ? "Puerta" : isFR ? "Porte" : "Door", meaning: isPT ? "limiar psíquico" : isES ? "umbral psíquico" : isFR ? "seuil psychique" : "psychic threshold" },
      { symbol: isPT ? "Água" : isES ? "Agua" : isFR ? "Eau" : "Water", meaning: isPT ? "afeto profundo" : isES ? "afecto profundo" : isFR ? "affect profond" : "deep affect" },
      { symbol: isPT ? "Casa" : isES ? "Casa" : isFR ? "Maison" : "House", meaning: isPT ? "estrutura do self" : isES ? "estructura del yo" : isFR ? "structure du soi" : "structure of the self" },
      { symbol: isPT ? "Chave" : isES ? "Llave" : isFR ? "Clé" : "Key", meaning: isPT ? "acesso ao reprimido" : isES ? "acceso a lo reprimido" : isFR ? "accès au refoulé" : "access to the repressed" },
      { symbol: isPT ? "Escada" : isES ? "Escalera" : isFR ? "Escalier" : "Stairs", meaning: isPT ? "níveis psíquicos" : isES ? "niveles psíquicos" : isFR ? "niveaux psychiques" : "psychic levels" },
    ],
    themes: isPT
      ? ["Desejo disfarçado", "Conflito interno", "Busca de identidade"]
      : isES
      ? ["Deseo disfrazado", "Conflicto interno", "Búsqueda de identidad"]
      : isFR
      ? ["Désir déguisé", "Conflit interne", "Quête d'identité"]
      : ["Disguised wish", "Inner conflict", "Search for identity"],
    associationPrompts: isPT
      ? [
          "Qual cena mais tocou você e por quê?",
          "Que lembrança infantil ressoa aqui?",
          "Se fosse uma peça, qual seria o título?",
          "Que desejo plausível se insinua por trás do enredo?",
          "O que você evita de dia que retorna à noite?",
        ]
      : isES
      ? [
          "¿Qué escena te tocó más y por qué?",
          "¿Qué recuerdo infantil resuena aquí?",
          "Si fuera una obra, ¿cuál sería el título?",
          "¿Qué deseo plausible se insinúa tras la trama?",
          "¿Qué evitas de día que vuelve de noche?",
        ]
      : isFR
      ? [
          "Quelle scène vous a le plus touché et pourquoi ?",
          "Quel souvenir d’enfance résonne ici ?",
          "Si c’était une pièce, quel serait le titre ?",
          "Quel désir plausible se glisse derrière l’intrigue ?",
          "Que fuyez-vous le jour qui revient la nuit ?",
        ]
      : [
          "Which scene touched you most and why?",
          "What childhood memory resonates here?",
          "If it were a play, what would its title be?",
          "What plausible wish sneaks behind the plot?",
          "What do you avoid by day that returns at night?",
        ],
  };
}

router.post("/", async (req, res) => {
  try {
    const {
      text = "",
      title = "",
      mood = null,
      sleepQuality = null,
      isRecurring = false,
      lang: rawLang = "pt-BR",
    } = req.body || {};
    const lang = normalizeLang(rawLang);

    let payload;
    if (OPENAI_KEY) {
      try {
        payload = await callOpenAI({
          system: systemPrompt(lang),
          user: userPrompt({ title, text, mood, sleepQuality, isRecurring, lang }),
          max_tokens: 1600,
          temperature: 0.7,
        });
      } catch (e) {
        console.error("openai_error:", e?.message || e);
        payload = mockLong(lang);
      }
    } else {
      payload = mockLong(lang);
    }

    return res.json({
      result: {
        summary: payload.summary || "",
        analysis: payload.analysis || "",
        fullText: payload.analysis || "",
        symbols: Array.isArray(payload.symbols) ? payload.symbols : [],
        themes: Array.isArray(payload.themes) ? payload.themes : [],
        associationPrompts: Array.isArray(payload.associationPrompts)
          ? payload.associationPrompts
          : [],
        language: lang,
      },
    });
  } catch (err) {
    console.error("interpret_error:", err);
    const lang = normalizeLang(req?.body?.lang || "pt-BR");
    const payload = mockLong(lang);
    return res.json({
      result: {
        summary: payload.summary,
        analysis: payload.analysis,
        fullText: payload.analysis,
        symbols: payload.symbols,
        themes: payload.themes,
        associationPrompts: payload.associationPrompts,
        language: lang,
      },
    });
  }
});

module.exports = router;
