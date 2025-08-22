// src/routes/stripe.js
const express = require("express");
const router = express.Router();
const Stripe = require("stripe");

// --- Stripe client (somente se houver chave) ---
const SECRET = process.env.STRIPE_SECRET_KEY || "";
const stripe = SECRET ? new Stripe(SECRET) : null;

// --- Origens front (para URLs de sucesso/cancelamento) ---
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://ohmyfreud.site";

// --- IDs de preços (suporta nomes novos e legados) ---
const PRICE_MONTHLY =
  process.env.STRIPE_MONTHLY_PRICE_ID ||
  process.env.STRIPE_PRICE_MONTHLY ||
  process.env.STRIPE_PRICE_ID || // último recurso (um único price antigo)
  null;

const PRICE_ANNUAL =
  process.env.STRIPE_ANNUAL_PRICE_ID ||
  process.env.STRIPE_PRICE_ANNUAL ||
  null;

function getPriceFor(plan) {
  if (plan === "monthly") return PRICE_MONTHLY;
  if (plan === "annual") return PRICE_ANNUAL;
  return null;
}

// --- DEBUG seguro (não vaza segredos) ---
router.get("/debug", (req, res) => {
  res.json({
    hasStripeKey: Boolean(SECRET && SECRET.startsWith("sk_")),
    keyIsLive: Boolean(SECRET && SECRET.startsWith("sk_live_")),
    monthlyConfigured: Boolean(PRICE_MONTHLY && PRICE_MONTHLY.startsWith("price_")),
    annualConfigured: Boolean(PRICE_ANNUAL && PRICE_ANNUAL.startsWith("price_")),
    frontendOrigin: FRONTEND_ORIGIN,
  });
});

// --- Checkout ---
router.post("/checkout", async (req, res) => {
  try {
    const { plan } = req.body || {};
    if (!plan || (plan !== "monthly" && plan !== "annual")) {
      return res.status(400).json({ error: "invalid_plan", hint: 'body.plan = "monthly" | "annual"' });
    }

    if (!SECRET || !SECRET.startsWith("sk_")) {
      return res.status(500).json({ error: "stripe_key_missing", hint: "Set STRIPE_SECRET_KEY (sk_live_...)" });
    }
    const priceId = getPriceFor(plan);
    if (!priceId || !priceId.startsWith("price_")) {
      return res.status(500).json({
        error: "price_not_configured_for_plan",
        plan,
        hint: `Configure STRIPE_${plan.toUpperCase()}_PRICE_ID com um Price ID Live (price_...)`,
      });
    }

    const successUrl = `${FRONTEND_ORIGIN}/premium/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${FRONTEND_ORIGIN}/premium?canceled=1`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("[/api/stripe/checkout] ERROR:", err?.message, err?.raw || "");
    const message = err?.raw?.message || err?.message || "checkout_failed";
    return res.status(500).json({ error: "checkout_failed", message });
  }
});

module.exports = router;

