// src/routes/interpret.js
const express = require("express");
const router = express.Router();

const OpenAI = require("openai");

const OPENAI_KEY =
  process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || "";
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY }) : null;

/**
 * Modelo(s) preferidos:
 * - 1º: variável de ambiente OPENAI_MODEL (se existir)
 * - 2º: gpt-5o-mini (mais barato/eficiente)
 * - 3º: gpt-4o-mini (fallback de custo baixo)
 */
const PREFERRED_MODELS = [
  process.env.OPENAI_MODEL,
  "gpt-5o-mini",
  "gpt-4o-mini",
].filter(Boolean);

// idioma (2 letras)
function pickLang(input) {
  if (!input) return "pt";
  return String(input).toLowerCase().split("-")[0].slice(0, 2) || "pt";
}

// Tenta chamar a API testando a lista de modelos preferidos
async function createChatJSON(messages) {
  let lastErr = null;

  for (const model of PREFERRED_MODELS) {
    try {
      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages,
      });
      return { completion, modelUsed: model };
    } catch (err) {
      lastErr = err;
      // se o erro for de modelo inexistente/indisponível, tenta o próximo
      const msg = String(err?.message || err);
      const code = err?.code || err?.status || "";
      const isModelIssue =
        msg.includes("model_not_found") ||
        msg.includes("invalid_request_error") ||
        code === 404;
      if (!isModelIssue) break; // erro diferente de modelo — não adianta tentar os próximos
    }
  }

  throw lastErr || new Error("openai_call_failed");
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
  "summary": string,
  "fullText": string,
  "symbols": [{"symbol": string, "meaning": string}],
  "themes": [string],
  "associationPrompts": [string],
  "cautionNote": string
}

Não inclua nada fora do JSON. Sem markdown.
`.trim();

    const user = { dream };

    const { completion, modelUsed } = await createChatJSON([
      { role: "system", content: sys },
      { role: "user", content: JSON.stringify(user) },
    ]);

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return res.status(502).json({ error: "empty_openai_response" });
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
      modelUsed,
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
