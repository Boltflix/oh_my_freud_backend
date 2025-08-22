// src/server.js
const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

// -----------------------------
// ENV / Config
// -----------------------------
const PORT = process.env.PORT || 3000;
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  "https://ohmyfreud.site";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

const STRIPE_MONTHLY_PRICE_ID =
  process.env.STRIPE_MONTHLY_PRICE_ID ||
  process.env.STRIPE_PRICE_MONTHLY ||
  process.env.STRIPE_PRICE_ID || ""; // compat

const STRIPE_ANNUAL_PRICE_ID =
  process.env.STRIPE_ANNUAL_PRICE_ID ||
  process.env.STRIPE_PRICE_ANNUAL ||
  "";

// Stripe client (opcional)
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

// -----------------------------
// App
// -----------------------------
const app = express();

// ---- Webhook Stripe ANTES do express.json()
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(400).send("stripe_webhook_not_configured");
    }
    const sig = req.headers["stripe-signature"];
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        STRIPE_WEBHOOK_SECRET
      );
      // TODO: trate eventos se quiser (checkout.session.completed etc.)
      return res.json({ received: true, type: event.type });
    } catch (err) {
      console.error("Webhook error:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  }
);

// ---- CORS e JSON
const allowed = new Set([
  "https://ohmyfreud.site",
  "https://www.ohmyfreud.site",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      cb(null, allowed.has(origin));
    },
    credentials: false,
  })
);
app.use(express.json());

// ---- Health
app.get("/api/health", async (_req, res) => {
  res.json({
    ok: true,
    hasStripe: !!STRIPE_SECRET_KEY,
    keyIsLive: STRIPE_SECRET_KEY.startsWith("sk_live_"),
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    stripePrices: {
      monthly: STRIPE_MONTHLY_PRICE_ID || null,
      annual: STRIPE_ANNUAL_PRICE_ID || null,
    },
    frontendOrigin: FRONTEND_ORIGIN,
  });
});

// ---- Rotas
const stripeRouter = require("./routes/stripe");
app.use("/api/stripe", stripeRouter);
app.use("/api/premium", stripeRouter);
app.use("/premium", stripeRouter); // alias compat

const interpretRouter = require("./routes/interpret");
app.use("/api/interpret", interpretRouter);
app.use("/interpret", interpretRouter); // alias compat

// Raiz simples
app.get("/", (_req, res) => res.json({ service: "Oh My Freud backend" }));

// 404 API
app.use((req, res, next) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ error: "not_found" });
  next();
});

// Start
app.listen(PORT, () => {
  console.log("Oh My Freud backend listening on", PORT);
  console.log("Your service is live 🎉");
});

