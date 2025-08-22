// src/routes/interpret.js
const express = require("express");
const router = express.Router();

/**
 * Esta rota aceita:
 * POST /api/interpret  (ou /interpret)
 * body: { title, description, lang, ... }
 * Retorna: { result: { summary, analysis, symbols[{symbol,meaning}], themes[], associationPrompts[], language } }
 *
 * - Usa OpenAI se OPENAI_API_KEY/OPENAI_KEY estiver presente
 * - Se faltar a chave, retorna um MOCK extenso (nunca 500)
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_URL =
  process.env.OPENAI_BASE_URL || "https://api.openai.com/v1/chat/completions";

/* ---------------- Helpers ---------------- */

function pickLang(lang) {
  const l = String(lang || "").toLowerCase();
  if (l.startsWith("pt")) return "pt-BR";
  if (l.startsWith("es")) return "es-ES";
  if (l.startsWith("fr")) return "fr-FR";
  return "en-US";
}

function safeParse(jsonText) {
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

function normalizePayload(p) {
  // Aceita chaves pt/en
  const out = {
    summary: p?.summary || p?.resumo || "",
    analysis: p?.analysis || p?.analise || p?.fullText || "",
    symbols: [],
    themes: Array.isArray(p?.themes || p?.temas) ? (p.themes || p.temas) : [],
    associationPrompts: Array.isArray(p?.associationPrompts || p?.perguntas)
      ? (p.associationPrompts || p.perguntas)
      : [],
    language: p?.language || null,
  };

  const rawSymbols = Array.isArray(p?.symbols || p?.simbolos)
    ? (p.symbols || p.simbolos)
    : [];

  out.symbols = rawSymbols.map((s) => {
    if (typeof s === "string") return { symbol: s, meaning: "" };
    if (Array.isArray(s)) return { symbol: s[0] || "", meaning: s[1] || "" };
    return { symbol: s?.symbol || "", meaning: s?.meaning || "" };
  });

  return out;
}

function mockLongResult(lang, title, description) {
  const language = pickLang(lang);
  const isPT = language === "pt-BR";
  const isES = language === "es-ES";
  const isFR = language === "fr-FR";

  const L = (en, pt, es, fr) => (isPT ? pt : isES ? es : isFR ? fr : en);

  const summary = L(
    `A concise synthesis suggests the dream reflects inner conflicts and cultural blends related to ${title || "the dream"}, hinting at desires for belonging and identity.`,
    `Uma síntese concisa sugere que o sonho reflete conflitos internos e mesclas culturais ligados a ${title || "o sonho"}, apontando para desejos de pertencimento e identidade.`,
    `Una síntesis concisa sugiere que el sueño refleja conflictos internos y mezclas culturales relacionados con ${title || "el sueño"}, insinuando deseos de pertenencia e identidad.`,
    `Une synthèse concise indique que le rêve reflète des conflits internes et des mélanges culturels liés à ${title || "le rêve"}, révélant des désirs d’appartenance et d’identité.`
  );

  const analysis = L(
    `In psychoanalytic terms, the dream functions as a scene where contradictory wishes emerge... (texto longo)`,
    `Em termos psicanalíticos, o sonho funciona como uma cena em que desejos contraditórios emergem... (texto longo com ~6–8 parágrafos descrevendo defesas, ambivalências, transferência, cenas oníricas e associações)`,
    `En términos psicoanalíticos, el sueño funciona como una escena donde surgen deseos contradictorios... (texto largo)`,
    `En termes psychanalytiques, le rêve fonctionne comme une scène où émergent des désirs contradictoires... (texte long)`
  );

  const symbols = [
    { symbol: L("Dance", "Dança", "Baile", "Danse"), meaning: L("Desire to express vitality", "Desejo de expressar vitalidade", "Deseo de expresar vitalidad", "Désir d’exprimer la vitalité") },
    { symbol: L("Night club", "Boate", "Club nocturno", "Boîte de nuit"), meaning: L("Seeking encounters/risks", "Busca por encontros/risco", "Búsqueda de encuentros/risgos", "Recherche de rencontres/risques") },
    { symbol: L("Foreign city", "Cidade estrangeira", "Ciudad extranjera", "Ville étrangère"), meaning: L("Identity in transition", "Identidade em transição", "Identidad en transición", "Identité en transition") },
    { symbol: L("Music", "Música", "Música", "Musique"), meaning: L("Affect regulation", "Regulação afetiva", "Regulación afectiva", "Régulation affective") },
    { symbol: L("Friends/people", "Pessoas/pares", "Personas/pares", "Pairs/personnes"), meaning: L("Belonging and recognition", "Pertencimento e reconhecimento", "Pertenencia y reconocimiento", "Appartenance et reconnaissance") },
  ];

  const themes = [
    L("Culture and belonging", "Cultura e pertencimento", "Cultura y pertenencia", "Culture et appartenance"),
    L("Ambivalence toward desire", "Ambivalência diante do desejo", "Ambivalencia ante el deseo", "Ambivalence face au désir"),
    L("Search for boundaries", "Busca de limites", "Búsqueda de límites", "Recherche de limites"),
  ];

  const questions = [
    L("What part of the scene felt most vivid?", "Qual parte da cena foi mais vívida?", "¿Qué parte de la escena fue más vívida?", "Quelle partie de la scène était la plus vive ?"),
    L("What feelings did you try to avoid?", "Quais sentimentos você tentou evitar?", "¿Qué sentimientos intentaste evitar?", "Quels sentiments avez-vous tenté d’éviter ?"),
    L("Where do you feel belonging lately?", "Onde você tem sentido pertencimento?", "¿Dónde sientes pertenencia últimamente?", "Où ressentez-vous l’appartenance récemment ?"),
    L("What would happen if you allowed more spontaneity?", "O que aconteceria se você permitisse mais espontaneidade?", "¿Qué pasaría si permites más espontaneidad?", "Que se passerait-il si vous autorisiez plus de spontanéité ?"),
    L("Which symbol resonates most with your current life?", "Qual símbolo mais ressoa com sua vida atual?", "¿Qué símbolo resuena más con tu vida actual?", "Quel symbole résonne le plus avec votre vie actuelle ?"),
  ];

  return {
    result: {
      summary,
      analysis,
      symbols,
      themes,
      associationPrompts: questions,
      language,
    },
  };
}

/* ---------------- OpenAI call ---------------- */

async function callOpenAI({ title, description, lang }) {
  const language = pickLang(lang);

  const sys = `You are a psychoanalytic dream interpreter. Always respond in ${language}.
Return ONLY a valid JSON object with keys:
{
  "summary": string,
  "analysis": string,          // 4–6 paragraphs, rich and specific (>= 600 words total)
  "symbols": [ {"symbol": string, "meaning": string}, ... ], // >=5
  "themes": [string],          // 3–6
  "associationPrompts": [string] // 5–7
}
Do not include any commentary outside JSON.`;

  const user = `Dream title: ${title || "(untitled)"}.
Description: ${description || "(no description)"}.
Language: ${language}.`;

  const r = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.7,
      max_tokens: 1600,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
    }),
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`openai_${r.status}: ${txt}`);
  }

  const json = await r.json();
  const content = json?.choices?.[0]?.message?.content || "";
  const parsed = safeParse(content);

  if (!parsed) throw new Error("openai_invalid_json");
  const normalized = normalizePayload(parsed);
  normalized.language = normalized.language || language;
  return { result: normalized };
}

/* ---------------- Route ---------------- */

router.post("/", async (req, res) => {
  const { title = "", description = "", lang = "" } = req.body || {};
  try {
    if (!OPENAI_API_KEY) {
      // Sem chave → devolve MOCK longo (nunca 500)
      return res.json(mockLongResult(lang, title, description));
    }

    const out = await callOpenAI({ title, description, lang });
    return res.json(out);
  } catch (e) {
    console.error("interpret_error:", e);
    // fallback: mock extenso para não quebrar UX
    try {
      return res.json(mockLongResult(lang, title, description));
    } catch {
      return res
        .status(500)
        .json({ error: "interpret_failed", detail: String(e.message || e) });
    }
  }
});

module.exports = router;
