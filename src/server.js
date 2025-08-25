// src/server.js
const express = require("express");
const cors = require("cors");

const app = express();

/* --------- CORS --------- */
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

/* --------- Stripe webhook (raw antes do json) --------- */
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => res.status(200).send("ok")
);

/* --------- Demais rotas usam JSON --------- */
app.use(express.json());

/* --------- Routers --------- */
const stripeRouter = require("./routes/stripe");
app.use("/api/stripe", stripeRouter);
app.use("/api/premium", stripeRouter);
app.use("/premium", stripeRouter);

const interpretRouter = require("./routes/interpret");
app.use("/api/interpret", interpretRouter);
app.use("/interpret", interpretRouter);

const insightsRouter = require("./routes/insights");
app.use("/api", insightsRouter);

/* --------- Health --------- */
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

/* --------- Start --------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Oh My Freud backend listening on", PORT);
});
