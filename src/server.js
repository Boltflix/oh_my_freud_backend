// src/server.js
const express = require("express");
const cors = require("cors");

const app = express();

/* ---------------- CORS ---------------- */
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
      return cb(new Error("Not allowed by CORS: " + origin), false);
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
    credentials: false,
  })
);

/* ---- Stripe webhook (RAW antes do json/urlencoded) ---- */
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), (req, res) => {
  try {
    if (!STRIPE_WEBHOOK_SECRET) return res.status(200).send("ok");
    // Se precisar validar no futuro:
    // const Stripe = require("stripe");
    // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // const sig = req.headers["stripe-signature"];
    // const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    return res.status(200).send("ok");
  } catch (e) {
    console.error("webhook_error:", e);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
});

/* ---- Demais rotas usam JSON & URL-ENC ---- */
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

/* ---- Routers ---- */
try {
  const stripeRouter = require("./routes/stripe");
  app.use("/api/stripe", stripeRouter);
  app.use("/api/premium", stripeRouter); // aliases
  app.use("/premium", stripeRouter);
} catch {
  console.warn("[init] stripe router not found (ok for now)");
}

const interpretRouter = require("./routes/interpret");
app.use("/api/interpret", interpretRouter);
app.use("/interpret", interpretRouter); // alias /interpret (sem /api)

/* ---- Health ---- */
app.get("/api/health", (req, res) => {
  const hasStripe = !!(process.env.STRIPE_SECRET_KEY || "");
  const hasOpenAI = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY);
  res.json({
    ok: true,
    hasStripe,
    hasOpenAI,
    keyIsLive: hasStripe
      ? String(process.env.STRIPE_SECRET_KEY || "").startsWith("sk_live_")
      : false,
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
    node: process.version,
  });
});

/* ---- Start ---- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Oh My Freud backend listening on", PORT);
});

