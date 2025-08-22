// src/server.js — Backend Oh My Freud (CommonJS)

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { randomUUID } = require("crypto");

// =====================================================
// App
// =====================================================
const app = express();
const PORT = process.env.PORT || 3000;

// O Render/Proxy adiciona X-Forwarded-Proto, etc. — garante https nas URLs
app.set("trust proxy", 1);

// =====================================================
// Middlewares
// =====================================================
app.use(
  cors({
    origin: [
      "https://ohmyfreud.site",
      "https://www.ohmyfreud.site",
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    credentials: true,
  })
);

// Atenção: o /api/stripe/webhook (se existir) usa raw no próprio router.
// Aqui usamos JSON para o restante da API.
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// =====================================================
// Health
// =====================================================
app.get(["/", "/api/health", "/health"], (req, res) => {
  res.json({
    ok: true,
    hasStripe: !!process.env.STRIPE_SECRET_KEY,
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    stripePrices: {
      // novas variáveis
      monthly: !!process.env.STRIPE_MONTHLY_PRICE_ID || !!process.env.STRIPE_PRICE_MONTHLY,
      annual:  !!process.env.STRIPE_ANNUAL_PRICE_ID  || !!process.env.STRIPE_PRICE_ANNUAL,
      // legado (um price antigo)
      legacy:  !!process.env.STRIPE_PRICE_ID,
    },
    appUrl: process.env.APP_URL || "unset",
    successUrl: process.env.CHECKOUT_SUCCESS_URL || "unset",
    cancelUrl: process.env.CHECKOUT_CANCEL_URL || "unset",
    now: new Date().toISOString(),
  });
});

// =====================================================
// OpenAI
// =====================================================
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

// =====================================================
// Rotas: Interpretação de Sonhos
// =====================================================
async function criarSonhoHandler(req, res) {
  try {
    const payload = req.body || {};
    if (!payload.description || payload.description.trim().length < 5) {
      return res.status(400).json({ error: "Descrição do sonho é obrigatória" });
    }
    const result = await interpretarComOpenAI(payload);
    return res.json({ id: randomUUID(), result });
  } catch (e) {
    console.error("[Dreams] erro ao interpretar:", e);
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
    console.error("[Dreams] erro ao reinterpretar:", e);
    res.status(500).json({ error: "Erro ao reinterpretar" });
  }
}
[
  "/api/dreams/:id/reinterpret",
  "/dreams/:id/reinterpret",
  "/api/reinterpret/:id",
  "/reinterpret/:id",
].forEach((p) => app.post(p, reinterpretarHandler));

// Debug “rápido”
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

// =====================================================
// Stripe
// (usa a rota modular em ./routes/stripe — mantém compatibilidade)
// =====================================================
const stripeRoutes = require("./routes/stripe");
app.use("/api/stripe", stripeRoutes);

// Aliases/compat
app.use("/api/premium", stripeRoutes);
app.use("/premium", stripeRoutes);

// =====================================================
// Not Found / Error Handler
// =====================================================
app.use((req, res, next) => {
  res.status(404).json({ error: "Not Found", path: req.originalUrl });
});

app.use((err, req, res, next) => {
  console.error("[GLOBAL ERROR]", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// Logs globais para pegar qualquer rejeição não tratada
process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED REJECTION]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT EXCEPTION]", err);
});

// =====================================================
// Start
// =====================================================
app.listen(PORT, () => {
  console.log(`Oh My Freud backend escutando na porta ${PORT}`);
});
