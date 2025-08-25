// src/routes/interpret.js
const express = require("express");
const router = express.Router();

const OpenAI = (() => {
  try {
    // Biblioteca oficial "openai" (v4+)
    return require("openai");
  } catch {
    return null;
  }
})();

const API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_KEY ||
  process.env.OPENAI_TOKEN ||
  "";

const MODEL =
  process.env.OPENAI_MODEL ||
  process.env.OPENAI_MODEL_NAME ||
  process.env.MODEL ||
  "gpt-4o-mini";

/* Utilidades */
function pickLang(req) {
  const b = req.body || {};
  const q = req.query || {};
  const raw =
    b.language || b.lang || q.language || q.lang || (req.headers["x-lang"] || "");
  const s = String(raw || "").toLowerCase();
  if (s.startsWith("pt")) return "pt-BR";
  if (s.startsWith("es")) return "es-ES";
  if (s.startsWith("fr")) return "fr-FR";
  return "en-US";
}

function extractDreamPayload(req) {
  const ct = (req.headers["content-type"] || "").toLowerCase();
  const b = req.body || {};

  // Form-urlencoded já chega como objeto.
  // JSON "flat"
  if (typeof b.dream === "string") {
    return {
      dreamText: b.dream,
      mood: Number(b.mood || b.moodScore || 0),
      sleep: Number(b.sleep || b.sleepQuality || 0),
      title: b.title || "",
    };
  }

  // JSON aninhado { dream: { content, mood, sleepQuality } }
  if (b.dream && typeof b.dream === "object") {
    const d = b.dream;
    return {
      dreamText: d.content || d.text || d.description || "",
      mood: Number(d.mood || 0),
      sleep: Number(d.sleepQuality || d.sleep || 0),
      title: d.title || "",
    };
  }

  // Campos alternativos
  if (b.content || b.text || b.description) {
    return {
      dreamText: b.content || b.text || b.description,
      mood: Number(b.mood || 0),
      sleep: Number(b.sleep || 0),
      title: b.title || "",
    };
  }

  // Fallback vazio
  return {
    dreamText: "",
    mood: 0,
    sleep: 0,
    title: "",
  };
}

function buildSystemPrompt(lang) {
  const L = (k) => {
    const pt = {
      role: "Você é o Dr. Freud em 2025: erudito, acolhedor e lúdico.",
      style:
        "Escreva em tom envolvente, com humor leve e metáforas elegantes. Evite jargão excessivo; explique quando usar termos técnicos.",
      structure:
        "Produza: (1) summary (1 parágrafo), (2) analysis (4–6 parágrafos, 600–900 palavras), (3) symbols (≥5 itens com significado), (4) themes (3–6), (5) associationPrompts (5–7 perguntas).",
      rule:
        "Respeite o idioma solicitado; não mude de idioma. Não invente fatos biográficos do usuário.",
    };
    const es = {
      role: "Eres el Dr. Freud en 2025: erudito, acogedor y lúdico.",
      style:
        "Escribe con un tono cautivador, humor ligero y metáforas elegantes. Evita jerga excesiva; explica los términos técnicos cuando aparezcan.",
      structure:
        "Entrega: (1) summary (1 párrafo), (2) analysis (4–6 párrafos, 600–900 palabras), (3) symbols (≥5 ítems con significado), (4) themes (3–6), (5) associationPrompts (5–7 preguntas).",
      rule:
        "Respeta el idioma pedido; no cambies de idioma. No inventes hechos biográficos del usuario.",
    };
    const fr = {
      role: "Vous êtes le Dr Freud en 2025 : érudit, bienveillant et joueur.",
      style:
        "Rédigez sur un ton captivant, avec un humour léger et des métaphores élégantes. Évitez le jargon excessif ; explicitez les termes techniques.",
      structure:
        "Produisez : (1) summary (1 paragraphe), (2) analysis (4–6 paragraphes, 600–900 mots), (3) symbols (≥5 éléments avec signification), (4) themes (3–6), (5) associationPrompts (5–7 questions).",
      rule:
        "Respectez la langue demandée ; ne changez pas de langue. N'inventez pas de faits biographiques.",
    };
    const en = {
      role: "You are Dr. Freud in 2025: erudite, warm, and playful.",
      style:
        "Write in an engaging tone with light humor and elegant metaphors. Avoid heavy jargon; explain technical terms when used.",
      structure:
        "Produce: (1) summary (1 paragraph), (2) analysis (4–6 paragraphs, 600–900 words), (3) symbols (≥5 items with meaning), (4) themes (3–6), (5) associationPrompts (5–7 prompts).",
      rule:
        "Respect the requested language; do not switch languages. Do not invent biographical facts about the user.",
    };
    const map = { "pt-BR": pt, "es-ES": es, "fr-FR": fr, "en-US": en };
    return (map[lang] || en)[k];
  };

  return [
    `${L("role")}`,
    `${L("style")}`,
    `${L("structure")}`,
    `${L("rule")}`,
    "",
    "Responda **EXCLUSIVAMENTE** em JSON com o seguinte formato:",
    `{
  "summary": "string",
  "analysis": "string (600–900 palavras, 4–6 parágrafos, estilo Freud)",
  "symbols": [{"symbol":"string","meaning":"string"}, ...],
  "themes": ["string", ...],
  "associationPrompts": ["string", ...],
  "language": "pt-BR|en-US|es-ES|fr-FR"
}`,
  ].join("\n");
}

function buildUserPrompt(lang, dreamText, mood, sleep, title) {
  const header =
    lang === "pt-BR"
      ? "SONHO DO USUÁRIO (em português):"
      : lang === "es-ES"
      ? "SUEÑO DEL USUARIO (en español):"
      : lang === "fr-FR"
      ? "RÊVE DE L’UTILISATEUR (en français) :"
      : "USER DREAM (in English):";

  const ctx =
    lang === "pt-BR"
      ? `Contexto adicional: humor ${mood}/5, qualidade do sono ${sleep}/5. Título: ${title || "—"}.`
      : lang === "es-ES"
      ? `Contexto adicional: humor ${mood}/5, calidad del sueño ${sleep}/5. Título: ${title || "—"}.`
      : lang === "fr-FR"
      ? `Contexte supplémentaire : humeur ${mood}/5, qualité du sommeil ${sleep}/5. Titre : ${title || "—"}.`
      : `Extra context: mood ${mood}/5, sleep quality ${sleep}/5. Title: ${title || "—"}.`;

  return `${header}\n"""${dreamText || ""}"""\n\n${ctx}`;
}

function toResultObject(lang, json) {
  const safe = json || {};
  const summary = String(safe.summary || "").trim();
  const analysis = String(safe.analysis || safe.fullText || "").trim();
  const symbols = Array.isArray(safe.symbols) ? safe.symbols : [];
  const themes = Array.isArray(safe.themes) ? safe.themes : [];
  const associationPrompts = Array.isArray(safe.associationPrompts)
    ? safe.associationPrompts
    : [];
  const language = safe.language || lang;

  return {
    result: {
      summary,
      analysis,
      fullText: analysis, // compat com front antigo
      symbols,
      themes,
      associationPrompts,
      language,
    },
  };
}

function mockLongResult(lang, dreamText) {
  // Garante saída no mesmo shape, sem 500.
  const text =
    lang === "pt-BR"
      ? `Análise psicanalítica (mock): Este sonho condensa desejos, censuras e restos diurnos...`
      : lang === "es-ES"
      ? `Análisis psicoanalítico (mock): Este sueño condensa deseos, censuras y restos diurnos...`
      : lang === "fr-FR"
      ? `Analyse psychanalytique (factice) : Ce rêve condense des désirs, des censures et des restes diurnes...`
      : `Psychoanalytic analysis (mock): This dream condenses wishes, censorships, and day residues...`;

  const base = {
    summary:
      lang === "pt-BR"
        ? "Seu sonho revela um conflito entre desejo e censura, apresentado por símbolos do cotidiano."
        : lang === "es-ES"
        ? "Tu sueño revela un conflicto entre deseo y censura, presentado por símbolos cotidianos."
        : lang === "fr-FR"
        ? "Votre rêve révèle un conflit entre désir et censure, mis en scène par des symboles du quotidien."
        : "Your dream reveals a conflict between wish and censorship, staged by everyday symbols.",
    analysis: text.repeat(15), // bem longo
    symbols: [
      { symbol: "Casa", meaning: "Estrutura psíquica / Eu" },
      { symbol: "Água", meaning: "Inconsciente e afetos" },
      { symbol: "Chave", meaning: "Acesso ao reprimido" },
      { symbol: "Animais", meaning: "Impulsos primários" },
      { symbol: "Voar", meaning: "Transgressão / liberdade" },
    ],
    themes: ["Desejo x Censura", "Infância", "Ansiedade", "Mudança"],
    associationPrompts: [
      "Qual imagem ficou mais vívida ao acordar?",
      "Que lembrança infantil ressoa com esse sonho?",
      "Que proibição apareceu como metáfora?",
      "Onde você sentiu culpa ou alívio no sonho?",
      "Se o sonho pudesse falar, qual conselho daria?",
    ],
    language: lang,
  };

  return toResultObject(lang, base);
}

/* Handler principal */
async function handleInterpret(req, res) {
  try {
    const lang = pickLang(req); // pt-BR / en-US / es-ES / fr-FR
    const { dreamText, mood, sleep, title } = extractDreamPayload(req);

    if (!dreamText || typeof dreamText !== "string" || dreamText.trim().length < 3) {
      // Ainda assim devolvemos um mock útil
      return res.status(200).json(
        mockLongResult(lang, dreamText)
      );
    }

    // Se não houver chave, devolve mock extenso (nunca 500)
    if (!API_KEY || !OpenAI) {
      return res.status(200).json(mockLongResult(lang, dreamText));
    }

    const client = new OpenAI.OpenAI
      ? new OpenAI.OpenAI({ apiKey: API_KEY })
      : new OpenAI({ apiKey: API_KEY });

    const system = buildSystemPrompt(lang);
    const user = buildUserPrompt(lang, dreamText, mood, sleep, title);

    // Chat Completions
    const response = await client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 1600,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });

    const raw = response?.choices?.[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // tenta limpar cauda/trailing
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start >= 0 && end > start) {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } else {
        parsed = {};
      }
    }

    return res.status(200).json(toResultObject(lang, parsed));
  } catch (err) {
    console.error("interpret_error:", err);
    // Nunca 500 "seco": devolve mock extenso com detalhe no campo analysis
    const lang = pickLang(req);
    const { dreamText } = extractDreamPayload(req);
    const base = mockLongResult(lang, dreamText);
    base.result.analysis += `\n\n[DEBUG] Fallback mock devido a erro no servidor: ${String(
      err && err.message ? err.message : err
    )}`;
    return res.status(200).json(base);
  }
}

/* Rotas */
router.post("/", handleInterpret);
router.post("/freud", handleInterpret);

module.exports = router;

