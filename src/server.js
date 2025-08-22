// src/server.js
const express = require("express");
const cors = require("cors");

const app = express();

/* ---------- CORS ---------- */
const allowed = new Set([
  "https://ohmyfreud.site",
  "https://www.ohmyfreud.site",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowed.has(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

/* ---------- HEALTH ---------- */
const Stripe = require("stripe");
const HAS_STRIPE = !!process.env.STRIPE_SECRET_KEY;
const HAS_OPENAI = !!process.env.OPENAI_API_KEY;

app.get("/api/health", async (_req, res) => {
  res.json({
    ok: true,
    hasStripe: HAS_STRIPE,
    hasOpenAI: HAS_OPENAI,
    stripePrices: {
      monthly:
        process.env.STRIPE_MONTHLY_PRICE_ID ||
        process.env.STRIPE_PRICE_MONTHLY ||
        process.env.STRIPE_PRICE_ID ||
        null,
      annual: process.env.STRIPE_ANNUAL_PRICE_ID || process.env.STRIPE_PRICE_ANNUAL || null,
    },
  });
});

/* ---------- STRIPE WEBHOOK (RAW) ---------- */
const stripe = HAS_STRIPE ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), (req, res) => {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.sendStatus(200);
    const sig = req.headers["stripe-signature"];
    stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    res.sendStatus(200);
  } catch (err) {
    console.error("webhook error:", err);
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

/* ---------- JSON PARA AS DEMAIS ROTAS ---------- */
app.use(express.json());

/* ---------- STRIPE ROUTES ---------- */
app.use("/api/stripe", require("./routes/stripe"));
app.use("/api/premium", require("./routes/stripe"));
app.use("/premium", require("./routes/stripe"));

/* ---------- INTERPRET ROUTE ---------- */
app.use(require("./routes/interpret"));

/* ---------- ROOT ---------- */
app.get("/", (_req, res) => res.send("Oh My Freud backend is live"));

/* ---------- START ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Oh My Freud backend listening on ${PORT}`);
});
