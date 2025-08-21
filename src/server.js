// src/server.js — Backend Oh My Freud (CommonJS)

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { randomUUID } = require("crypto");

// ===== App & porta =====
const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middlewares =====
app.use(
  cors({
    origin: [
      "https://ohmyfreud.site",
      "https://www.ohmyfreud.site",
      "http://localhost:5173",    // dev
      "http://127.0.0.1:5173"     // dev
    ],
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
    stripePrices: {
      monthly: !!process.env.STRIPE_MONTHLY_PRICE_ID || !!process.env.STRIPE_PRICE_MONTHLY,
      annual:  !!process.env.STRIPE_ANNUAL_PRICE_ID  || !!process.env.STRIPE_PRICE_ANNUAL,
      legacy:  !!process.env.STRIPE_PRICE_ID
    },
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

// ===== Stripe (usa a rota que você criou em src/routes/stripe.js) =====
const stripeRoutes = require("./routes/stripe");
app.use("/api/stripe", stripeRoutes);

// Aliases de compatibilidade (suas URLs antigas continuam funcionando)
app.use("/api/premium", stripeRoutes);
app.use("/premium", stripeRoutes);

// ===== Start =====
app.listen(PORT, () => {
  console.log(`Oh My Freud backend escutando na porta ${PORT}`);
});





