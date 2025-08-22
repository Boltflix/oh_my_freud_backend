// src/server.js
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();

/* ---------------- C O R S ---------------- */
const allowed = new Set([
  "https://ohmyfreud.site",
  "https://www.ohmyfreud.site",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.has(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
    credentials: false,
  })
);

/* --------- Webhook Stripe precisa de RAW antes do json() --------- */
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    try {
      if (!STRIPE_WEBHOOK_SECRET || !stripe) {
        // Webhook não configurado — 200 pra não travar deploy
        return res.status(200).send("ok");
      }
      const sig = req.headers["stripe-signature"];
      // Se for validar:
      // const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
      return res.status(200).send("ok");
    } catch (e) {
      console.error("webhook_error:", e);
      return res.status(400).send(`Webhook Error: ${e.message}`);
    }
  }
);

/* ------------- MONTE O ROTEADOR DO STRIPE ANTES DO express.json() ------------- */
const stripeRouter = require("./routes/stripe");
app.use("/api/stripe", stripeRouter);
app.use("/api/premium", stripeRouter);
app.use("/premium", stripeRouter);

/* ------------- Demais rotas usam JSON (se precisarmos no futuro) ------------- */
app.use(express.json());

/* ------------- Health ------------- */
app.get("/api/health", (req, res) => {
  const hasStripe = !!STRIPE_SECRET_KEY;
  const hasOpenAI = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY);
  const keyIsLive = hasStripe && STRIPE_SECRET_KEY.startsWith("sk_live_");

  res.json({
    ok: true,
    hasStripe,
    hasOpenAI,
    keyIsLive,
    stripePrices: {
      monthly:
        process.env.STRIPE_MONTHLY_PRICE_ID ||
        process.env.STRIPE_PRICE_MONTHLY ||
        process.env.STRIPE_PRICE_ID ||
        null,
      annual:
        process.env.STRIPE_ANNUAL_PRICE_ID ||
        process.env.STRIPE_PRICE_ANNUAL ||
        null,
    },
    frontendOrigin: process.env.FRONTEND_ORIGIN || "https://ohmyfreud.site",
  });
});

/* ------------- Start ------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Oh My Freud backend listening on", PORT);
});
