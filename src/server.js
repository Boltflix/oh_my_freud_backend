// src/server.js — Backend Oh My Freud (CommonJS)
// Variáveis no Render (Environment):
// OPENAI_API_KEY, STRIPE_SECRET_KEY, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL
// CHECKOUT_SUCCESS_URL (opcional), CHECKOUT_CANCEL_URL (opcional)

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");
const OpenAI = require("openai");
const { randomUUID } = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middlewares =====
app.use(
  cors({
    origin: ["https://ohmyfreud.site", "https://www.ohmyfreud.site"],
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ===== Health =====
app.get(["/api/health", "/health"], (req, res) => {
  res.json({
    ok: true,
    hasStripe: !!process.env.STRIPE_SECRET_KEY,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    now: new Date().toISOString(),
  });
});

// ===== OpenAI =====
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function interpretarComOpenAI(payload) {
  const {
    title = "",
    description = "",
    dream_date = "",
    mood = "",
    sleep_quality = "",
    is_recurring = false,
  } = payload || {};

  const systemPrompt = `
Você é Sigmund Freud. Interprete sonhos em português com base na psicanálise (conteúdo manifesto/latente, condensação, deslocamento, simbolização), em tom humano e cuidadoso. Evite generalidades. Responda EM JSON válido:
{
  "resumo":"2-3 parágrafos conectados ao sonho",
  "analise":"explicação psicanalítica",
  "simbolos":["símbolo: significado", "..."],
  "temas":["tema1","tema2"],
  "perguntas":["pergunta 1","pergunta 2"]
}
`.trim();

  const userPrompt = `
Título: ${title}
Data: ${dream_date}
Humor: ${mood}
Sono: ${sleep_quality}
Recorrente: ${is_recurring ? "sim" : "não"}

Descrição:
${description}
`.trim();

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const text = resp?.choices?.[0]?.message?.content || "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      resumo: text || "Sem conteúdo",
      analise: "",
      simbolos: [],
      temas: [],
      perguntas: [],
    };
  }
  parsed.resumo ||= "";
  parsed.analise ||= "";
  parsed.simbolos ||= [];
  parsed.temas ||= [];
  parsed.perguntas ||= [];
  return parsed;
}

// ===== Rotas de Interpretação =====
async function criarSonhoHandler(req, res) {
  try {
    const payload = req.body || {};
    if (!payload.description || payload.description.trim().length < 5) {
      return res.status(400).json({ error: "Descrição do sonho é obrigatória" });
    }
    const result = await interpretarComOpenAI(payload);
    return res.json({ id: randomUUID(), result });
  } catch (e) {
    console.error("Erro ao interpretar sonho:", e);
    res.status(500).json({ error: "Erro ao interpretar sonho" });
  }
}
["/api/dreams", "/dreams", "/api/interpret", "/interpret"].forEach((p) =>
  app.post(p, criarSonhoHandler)
);

async function reinterpretarHandler(req, res) {
  try {
    const base = req.body || {};
    const result = await interpretarComOpenAI(base);
    return res.json({ id: req.params.id || null, result });
  } catch (e) {
    console.error("Erro ao reinterpretar:", e);
    res.status(500).json({ error: "Erro ao reinterpretar" });
  }
}
[
  "/api/dreams/:id/reinterpret",
  "/dreams/:id/reinterpret",
  "/api/reinterpret/:id",
  "/reinterpret/:id",
].forEach((p) => app.post(p, reinterpretarHandler));

// ===== Debug rápido =====
app.post("/debug/echo", (req, res) => res.json({ ok: true, received: req.body }));
app.get("/debug/openai", async (req, res) => {
  try {
    const result = await interpretarComOpenAI({
      title: "Casa antiga com portas",
      description:
        "Andava por uma casa antiga com muitas portas. Algumas não abriam. No quintal havia um poço.",
      dream_date: new Date().toISOString().slice(0, 10),
      mood: "ansioso",
      sleep_quality: "leve",
      is_recurring: false,
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
});

// ===== Stripe =====
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-06-20",
});

app.post(
  ["/api/premium/checkout", "/premium/checkout", "/api/stripe/checkout"],
  async (req, res) => {
    try {
      const plan = String(req.body?.plan || "monthly").toLowerCase();
      const price =
        plan === "annual"
          ? process.env.STRIPE_PRICE_ANNUAL
          : process.env.STRIPE_PRICE_MONTHLY;

      if (!price) {
        return res
          .status(400)
          .json({ error: "PRICE não configurado para o plano " + plan });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        success_url:
          process.env.CHECKOUT_SUCCESS_URL ||
          "https://ohmyfreud.site/premium/success",
        cancel_url:
          process.env.CHECKOUT_CANCEL_URL ||
          "https://ohmyfreud.site/premium",
      });

      res.json({ url: session.url });
    } catch (e) {
      console.error("Erro no checkout:", e);
      res.status(500).json({ error: "Erro ao criar checkout" });
    }
  }
);

// GET de teste (abre checkout direto)
app.get("/test/checkout", async (req, res) => {
  try {
    const plan = String(req.query.plan || "monthly").toLowerCase();
    const price =
      plan === "annual"
        ? process.env.STRIPE_PRICE_ANNUAL
        : process.env.STRIPE_PRICE_MONTHLY;

    if (!price) return res.status(400).send("PRICE ausente para " + plan);

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url:
        process.env.CHECKOUT_SUCCESS_URL ||
        "https://ohmyfreud.site/premium/success",
      cancel_url:
        process.env.CHECKOUT_CANCEL_URL ||
        "https://ohmyfreud.site/premium",
    });

    res.redirect(302, session.url);
  } catch (e) {
    console.error("[Stripe][test/checkout] erro:", e);
    res.status(500).send("Erro ao criar checkout: " + (e?.message || e));
  }
});

// ===== Start =====
app.listen(PORT, () => {
  console.log(`Oh My Freud backend escutando na porta ${PORT}`);
});




