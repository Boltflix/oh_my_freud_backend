// src/routes/interpret.js
const express = require("express");
const router = express.Router();
const OpenAI = require("openai");

const HAS_OPENAI = !!process.env.OPENAI_API_KEY;
const openai = HAS_OPENAI ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

// normaliza idioma recebido
function pickLocale(lang) {
  const v = String(lang || "").toLowerCase();
  if (v.startsWith("pt")) return "pt-BR";
  if (v.startsWith("es")) return "es-ES";
  if (v.startsWith("fr")) return "fr-FR";
  return "en-US";
}

// aceita JSON nesta rota
const jsonParser = express.json();

router.post(["/api/interpret", "/interpret"], jsonParser, async (req, res) => {
  try {
    const {
      title = "",
      description = "",
      dream_date = "",
      mood = "",
      sleep_quality = "",
      is_recurring = false,
      lang,
    } = req.body || {};

    if (!title && !description) {
      return res.status(400).json({ error: "missing_input", message: "Provide title or description." });
    }

    const locale = pickLocale(lang);

    // Sem OpenAI -> fallback previsível (pelo menos não quebra)
    if (!HAS_OPENAI) {
      return res.json({
        result: {
          summary: `Prévia (${locale}): resumo breve do sonho.`,
          analysis: `Prévia (${locale}): análise ilustrativa com base no título "${title}".`,
          symbols: [],
          themes: [],
          questions: [
            "Qual sensação ficou após acordar?",
            "Há algum evento recente que possa se relacionar?",
          ],
          language: locale,
        },
      });
    }

    const prompt = `
You are a psychoanalytic assistant. Respond strictly in JSON.
Language: ${locale}

Dream data:
- Title: ${title}
- Date: ${dream_date}
- Mood(0-5): ${mood}
- Sleep quality(0-5): ${sleep_quality}
- Recurring: ${is_recurring}
- Description: ${description}

Return ONLY a JSON object with keys:
{
  "summary": string,
  "analysis": string,
  "symbols": array of (string or {"symbol": string, "meaning": string}),
  "themes": array of string,
  "questions": array of string
}
`;

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: "You are a helpful psychoanalytic assistant." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion?.choices?.[0]?.message?.content || "{}";
    let parsed = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    return res.json({ result: { ...parsed, language: locale } });
  } catch (err) {
    console.error("interpret error:", err);
    return res.status(500).json({ error: "interpret_failed", message: String(err.message || err) });
  }
});

module.exports = router;
