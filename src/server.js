// server.js
const express = require("express");
const cors = require("cors");

const app = express();

// Body parser
app.use(express.json({ limit: "1mb" }));

// CORS (mantém seus domínios + dev)
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
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// HEALTH (mostra se Stripe/OpenAI estão configurados e quais price IDs o back enxerga)
app.get("/api/health", (req, res) => {
  const stripePrices = [
    process.env.STRIPE_MONTHLY_PRICE_ID ||
      process.env.STRIPE_PRICE_MONTHLY ||
      process.env.STRIPE_PRICE_ID ||
      null,
    process.env.STRIPE_ANNUAL_PRICE_ID ||
      process.env.STRIPE_PRICE_ANNUAL ||
      null,
  ].filter(Boolean);

  res.json({
    ok: true,
    hasStripe: Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_")),
    hasOpenAI: Boolean(process.env.OPENAI_API_KEY),
    stripePrices,
  });
});

// STRIPE routes
const stripeRouter = require("./src/routes/stripe");
app.use("/api/stripe", stripeRouter);
// Aliases compatíveis que você citou:
app.use("/api/premium", stripeRouter);
app.use("/premium", stripeRouter);

// (coloque aqui as outras rotas existentes, ex.: /api/interpret)

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Oh My Freud backend listening on ${PORT}`);
});
