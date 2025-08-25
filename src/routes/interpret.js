// src/routes/interpret.js
const express = require("express");
const router = express.Router();

const OPENAI_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "";

/* ---------------- Helpers ---------------- */
function normalizeLang(langRaw) {
  const v = (langRaw || "").toLowerCase();
  if (v.startsWith("pt")) return "pt-BR";
  if (v.startsWith("es")) return "es-ES";
  if (v.startsWith("fr")) return "fr-FR";
  return "en-US";
}

function buildSystem(lang) {
  const base =
    "You are a witty, empathic psychoanalyst channeling Sigmund Freud. Write vivid, entertaining yet respectful analyses grounded in classical psychoanalytic theory (wish-fulfillment, dream-work, displacement, condensation, primary/secondary processes). Always return STRICT JSON with keys: summary, analysis, symbols, themes, associationPrompts.";
  const map = {
    "pt-BR":
      "Você é um psicanalista espirituoso e empático, canalizando Sigmund Freud. Faça análises vívidas, envolventes e respeitosas, fundamentadas na teoria clássica (realização de desejo, trabalho do sonho, deslocamento, condensação, processos primário/secundário). Retorne SEMPRE JSON ESTRITO com: summary, analysis, symbols, themes, associationPrompts.",
    "es-ES":
      "Eres un psicoanalista ingenioso y empático, canalizando a Sigmund Freud. Escribe análisis vívidos y respetuosos basados en la teoría clásica (satisfacción del deseo, trabajo onírico, desplazamiento, condensación, proceso primario/secundario). Devuelve SIEMPRE JSON ESTRICTO con: summary, analysis, symbols, themes, associationPrompts.",
    "fr-FR":
      "Vous êtes un psychanalyste spirituel et empathique, canalisant Freud. Rédigez des analyses vives et respectueuses ancrées dans la théorie classique. Retournez TOUJOURS un JSON STRICT avec : summary, analysis, symbols, themes, associationPrompts.",
    "en-US": base,
  };
  return map[lang] || base;
}

function buildUserPrompt({ title, text, mood, sleepQuality, isRecurring, lang }) {
  return `
LANG=${lang}
TITLE: ${title || "(untitled)"}
DREAM_TEXT:
${text || "(empty)"}

CONTEXT:
- Mood (1-5): ${mood || "-"}
- Sleep quality (1-5): ${sleepQuality || "-"}
- Recurring: ${isRecurring ? "yes" : "no"}

TASK:
1) SUMMARY: 1 paragraph (2–4 sentences).
2) PSYCHOANALYTIC ANALYSIS: 600–900+ words in 4–6 paragraphs, using Freud (wish-fulfillment, censorship, displacement, condensation, manifest/latent content, primary/secondary processes).
3) SYMBOLS: >=5 items as [{"symbol":"...", "meaning":"..."}].
4) THEMES: 3–6 strings.
5) ASSOCIATION PROMPTS: 5–7 questions to spark free association.

OUTPUT STRICT JSON:
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
    headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
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
  if (!resp.ok) throw new Error(`OpenAI HTTP ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}

function mockLong(lang) {
  const P = (pt, en, es, fr) =>
    lang === "pt-BR" ? pt : lang === "es-ES" ? es : lang === "fr-FR" ? fr : en;

  return {
    summary: P(
      "Este sonho encena um desejo disfarçado e a tensão entre o que você admite e o que censura.",
      "This dream stages a disguised wish and the tension between what you admit and what you censor.",
      "Este sueño escenifica un deseo disfrazado y la tensión entre lo que admites y censuras.",
      "Ce rêve met en scène un désir déguisé et la tension entre ce que vous admettez et censurez."
    ),
    analysis: P(
      "Análise longa (~800+ palavras) com deslocamento, condensação, censura onírica e contraste entre conteúdo manifesto e latente...",
      "Long analysis (~800+ words) with displacement, condensation, dream censorship and manifest/latent content...",
      "Análisis largo (~800+ palabras) con desplazamiento, condensación, censura onírica y contenido manifiesto/latente...",
      "Analyse longue (~800+ mots) avec déplacement, condensation, censure onirique et contenu manifeste/latent..."
    ),
    symbols: [
      { symbol: P("Porta", "Door", "Puerta", "Porte"), meaning: P("limiar psíquico", "psychic threshold", "umbral psíquico", "seuil psychique") },
      { symbol: P("Água", "Water", "Agua", "Eau"), meaning: P("afeto profundo", "deep affect", "afecto profundo", "affect profond") },
      { symbol: P("Casa", "House", "Casa", "Maison"), meaning: P("estrutura do self", "structure of the self", "estructura del yo", "structure du soi") },
      { symbol: P("Chave", "Key", "Llave", "Clé"), meaning: P("acesso ao reprimido", "access to the repressed", "acceso a lo reprimido", "accès au refoulé") },
      { symbol: P("Escada", "Stairs", "Escalera", "Escalier"), meaning: P("mudança de nível psíquico", "psychic level shift", "cambio de nivel psíquico", "changement de niveau psychique") },
    ],
    themes: [
      P("Desejo disfarçado", "Disguised wish", "Deseo disfrazado", "Désir déguisé"),
      P("Conflito interno", "Inner conflict", "Conflicto interno", "Conflit interne"),
      P("Busca de identidade", "Search for identity", "Búsqueda de identidad", "Quête d'identité"),
    ],
    associationPrompts: [
      P("Qual cena mais o impacta e por quê?", "Which scene impacts you most and why?", "¿Qué escena te impacta más y por qué?", "Quelle scène vous impacte le plus et pourquoi ?"),
      P("Que lembrança infantil ressoa aqui?", "What childhood memory resonates here?", "¿Qué recuerdo infantil resuena aquí?", "Quel souvenir d’enfance résonne ici ?"),
      P("Se fosse um título de peça, qual seria?", "If it were a play title, what would it be?", "Si fuera título de una obra, ¿cuál sería?", "Si c’était une pièce, quel serait le titre ?"),
      P("Que desejo plausível se insinua?", "What plausible wish sneaks in?", "¿Qué deseo plausible se insinúa?", "Quel désir plausible se glisse ?"),
      P("O que você evita de dia e retorna à noite?", "What do you avoid by day that returns at night?", "¿Qué evitas de día que vuelve de noche?", "Que fuyez-vous le jour qui revient la nuit ?"),
    ],
  };
}

/* ------------- POST /api/interpret ------------- */
router.post("/", async (req, res) => {
  try {
    const {
      text = "",
      title = "",
      mood = null,
      sleepQuality = null,
      isRecurring = false,
      lang: langRaw = "pt-BR",
    } = req.body || {};

    const lang = normalizeLang(langRaw);

    let payload;
    if (OPENAI_KEY) {
      try {
        payload = await callOpenAI({
          system: buildSystem(lang),
          user: buildUserPrompt({ title, text, mood, sleepQuality, isRecurring, lang }),
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

    const result = {
      summary: payload.summary || "",
      analysis: payload.analysis || "",
      fullText: payload.analysis || payload.fullText || "",
      symbols: Array.isArray(payload.symbols) ? payload.symbols : [],
      themes: Array.isArray(payload.themes) ? payload.themes : [],
      associationPrompts: Array.isArray(payload.associationPrompts) ? payload.associationPrompts : [],
      language: lang,
      cautionNote:
        lang === "pt-BR"
          ? "Interpretação com propósito de entretenimento e reflexão. Não substitui acompanhamento psicológico."
          : lang === "es-ES"
          ? "Interpretación con fines de entretenimiento y reflexión. No sustituye acompañamiento psicológico."
          : lang === "fr-FR"
          ? "Interprétation destinée au divertissement et à la réflexion. Ne remplace pas un suivi psychologique."
          : "Interpretation for entertainment and reflection. Not a substitute for psychological care.",
    };

    return res.json({ result });
  } catch (err) {
    console.error("interpret_error:", err);
    // Nunca 500: devolve mock extenso para não quebrar o front
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
