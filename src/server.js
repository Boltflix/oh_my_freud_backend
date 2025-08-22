// src/server.js
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe"); // <-- CORRETO

// ----------------------------------------------------------------------------
// CORS – libera seus domínios + dev
// ----------------------------------------------------------------------------
const allowed = new Set([
  "https://ohmyfreud.site",
  "https://www.ohmyfreud.site",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const app = express();

// IMPORTANTE: o webhook precisa do corpo RAW, então montamos
// a rota do webhook ANTES do express.json() geral.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

// Webhook (Live). Mantemos simples: só aceita JSON raw.
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
        return res.status(500).send("Stripe env missing");
      }
      const stripe = new Stripe(STRIPE_SECRET_KEY); // <-- instância correta
      const sig = req.headers["stripe-signature"];
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );

      console.log("[webhook]", event.type);
      // if (event.type === "checkout.session.completed") { ... }

      return res.json({ received: true });
    } catch (err) {
      console.error("[webhook] verify failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// Agora sim: parsers globais e CORS para as demais rotas
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.has(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));

// ----------------------------------------------------------------------------
// HEALTH
// ----------------------------------------------------------------------------
app.get("/api/health", (req, res) => {
  const stripePrices = [
    process.env.STRIPE_MONTHLY_PRICE_ID ||
      process.env.STRIPE_PRICE_MONTHLY ||
      process.env.STRIPE_PRICE_ID ||
      null,
    process.env.STRIPE_ANNUAL_PRICE_ID || process.env.STRIPE_PRICE_ANNUAL || null,
  ].filter(Boolean);

  res.json({
    ok: true,
    hasStripe: Boolean(STRIPE_SECRET_KEY?.startsWith("sk_")),
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
    stripePrices,
  });
});

// ----------------------------------------------------------------------------
// STRIPE ROUTES (checkout + debug)
// IMPORTANTE: como server.js está dentro de src/, use ./routes/stripe
// ----------------------------------------------------------------------------
const stripeRouter = require("./routes/stripe");
app.use("/api/stripe", stripeRouter);
// Aliases compatíveis:
app.use("/api/premium", stripeRouter);
app.use("/premium", stripeRouter);

// (mantenha aqui suas outras rotas, ex.: /api/interpret)

// START
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Oh My Freud backend listening on", PORT);
});
