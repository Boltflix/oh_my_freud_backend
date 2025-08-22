// src/routes/interpret.js
const express = require("express");
const router = express.Router();

const OPENAI_KEY = process.env.OPENAI_API_KEY || "";

// linguagem -> tag
function normLang(l) {
  if (!l) return "pt-BR";
  const s = String(l).toLowerCase();
  if (s.startsWith("en")) return "en-US";
  if (s.startsWith("es")) return "es-ES";
  if (s.startsWith("fr")) return "fr-FR";
  if (s.startsWith("pt")) return "pt-BR";
  return "en-US";
}

async function chatJSON({ title, description, lang }) {
  const modelCandidates = ["gpt-4o-mini", "gpt-4o-mini-translate", "gpt-4o", "gpt-3.5-turbo"];
  const system = `You are a psychoanalytic assistant. ALWAYS answer in valid JSON UTF-8 with keys:
{
  "summary": "...",
  "analysis": "...",
  "symbols": [{"symbol":"...","meaning":"..."}],
  "themes": ["..."],
  "associationPrompts": ["..."],
  "language": "${lang}"
}`;

  const user = `Language: ${lang}
Title: ${title || ""}
Description: ${description || ""}

Return ONLY JSON, no extra text.`;

  for (const model of modelCandidates) {
    try {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.7,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error?.message || `openai_${r.status}`);
      const content = j?.choices?.[0]?.message?.content || "";
      // tenta extrair JSON
      const jsonText =
        content.trim().startsWith("{") ? content :
        (content.match(/\{[\s\S]*\}$/) || [])[0] || content;

      return JSON.parse(jsonText);
    } catch (e) {
      // tenta próximo modelo
    }
  }
  throw new Error("openai_failed_all_models");
}

function normalize(p, lang) {
  const summary = p?.resumo ?? p?.summary ?? "";
  const analysis = p?.analise ?? p?.analysis ?? p?.fullText ?? "";
  const symbolsRaw = Array.isArray(p?.simbolos ?? p?.symbols) ? p?.simbolos ?? p?.symbols : [];
  const themes = Array.isArray(p?.temas ?? p?.themes) ? p?.temas ?? p?.themes : [];
  const prompts = Array.isArray(p?.perguntas ?? p?.associationPrompts ?? p?.questions)
    ? (p?.perguntas ?? p?.associationPrompts ?? p?.questions)
    : [];

  const symbols = symbolsRaw.map((s) => {
    if (typeof s === "string") return { symbol: s, meaning: "" };
    if (Array.isArray(s)) return { symbol: s[0] || "", meaning: s[1] || "" };
    return { symbol: s?.symbol || "", meaning: s?.meaning || "" };
  });

  return {
    result: {
      summary,
      analysis,
      symbols,
      themes,
      associationPrompts: prompts,
      language: p?.language || lang,
    },
  };
}

// Ping simples
router.get("/ping", (_req, res) => res.json({ ok: true }));

// POST /api/interpret
router.post("/", async (req, res) => {
  try {
    const {
      title = "",
      description = "",
      dream_date,
      mood,
      sleep_quality,
      is_recurring,
      lang,
    } = req.body || {};

    const locale = normLang(lang);

    // Se não houver chave, devolve um mock útil para QA (não 500)
    if (!OPENAI_KEY) {
      return res.json(
        normalize(
          {
            summary:
              locale.startsWith("pt")
                ? "Resumo fictício (sem OPENAI_KEY configurada)."
                : locale.startsWith("es")
                ? "Resumen ficticio (sin OPENAI_KEY)."
                : "Mock summary (no OPENAI_KEY).",
            analysis:
              (title ? `Title: ${title}\n` : "") +
              (description ? `Description: ${description}\n\n` : "") +
              "Sem chave OpenAI — retornando resposta mock para testes.",
            symbols: ["biblioteca", "mar", "porta"],
            themes: ["autoconhecimento", "mudança"],
            associationPrompts: [
              "O que esse sonho te lembra?",
              "Que emoções ficaram mais fortes?",
            ],
            language: locale,
          },
          locale
        )
      );
    }

    const ai = await chatJSON({ title, description, lang: locale });
    return res.json(normalize(ai, locale));
  } catch (err) {
    console.error("interpret_error:", err);
    return res.status(500).json({ error: "interpret_failed", detail: String(err.message || err) });
  }
});

module.exports = router;
