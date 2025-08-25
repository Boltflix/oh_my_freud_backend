// src/routes/interpret.js
const express = require("express");
const router = express.Router();

const OpenAI = require("openai");

const OPENAI_KEY =
  process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "";
const MODEL = process.env.OPENAI_MODEL || "gpt-5o-mini";

const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

// util: idioma em 2 letras
function pickLang(input) {
  if (!input) return "pt";
  return String(input).toLowerCase().split("-")[0].slice(0, 2) || "pt";
}

// POST /api/interpret
// body: { lang?: string, dream: { title, content, mood, sleepQuality, dreamDate? } }
router.post("/", async (req, res) => {
  try {
    if (!openai) {
      return res.status(500).json({ error: "openai_not_configured" });
    }

    const { lang: langRaw, dream } = req.body || {};
    if (!dream || !dream.content) {
      return res.status(400).json({ error: "invalid_dream" });
    }

    const lang =
      pickLang(langRaw) ||
      pickLang(req.header("x-i18n-lang")) ||
      "pt";

    const sys = `
Você é Sigmund Freud em 2025, porém fiel à psicanálise clássica.
Analise sonhos com técnica freudiana (conteúdo manifesto x latente, condensação, deslocamento, restos diurnos, desejo reprimido).
Escreva **no idioma**: ${lang}.
Responda **apenas JSON** com o seguinte formato:

{
  "summary": string (máx ~2-3 frases, direto e poético),
  "fullText": string (análise psicanalítica mais longa, ~10-15 linhas),
  "symbols": [{"symbol": string, "meaning": string}, ... 3 a 6 itens],
  "themes": [string, ... 3 a 5 itens],
  "associationPrompts": [string, ... 3 a 5 perguntas para associação livre],
  "cautionNote": string (nota ética: é um guia educativo, não substitui terapia)
}

Não inclua texto fora do JSON. Nada de markdown.
`;

    const user = {
      dream,
    };

    // Responses API com obrigatoriedade de JSON:
    const completion = await openai.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: JSON.stringify(user),
        },
      ],
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return res.status(502).json({
        error: "empty_openai_response",
      });
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({
        error: "invalid_json_from_model",
        preview: text?.slice(0, 400),
      });
    }

    return res.json({
      ok: true,
      interpretation: parsed,
    });
  } catch (err) {
    console.error("interpret_error:", err);
    return res.status(500).json({
      error: "interpret_failed",
      detail: String(err?.message || err),
    });
  }
});

module.exports = router;
