// src/routes/stripe.js
const express = require("express");
const Stripe = require("stripe");

const router = express.Router();

const SECRET = process.env.STRIPE_SECRET_KEY || "";
const stripe = SECRET ? new Stripe(SECRET) : null;

// De onde o Stripe vai voltar após success/cancel
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://ohmyfreud.site";

// IDs de preço (live)
const PRICE_MONTHLY =
  process.env.STRIPE_MONTHLY_PRICE_ID ||
  process.env.STRIPE_PRICE_MONTHLY ||
  process.env.STRIPE_PRICE_ID ||
  "";

const PRICE_ANNUAL =
  process.env.STRIPE_ANNUAL_PRICE_ID ||
  process.env.STRIPE_PRICE_ANNUAL ||
  "";

function getPriceFor(plan) {
  if (plan === "monthly") return PRICE_MONTHLY;
  if (plan === "annual") return PRICE_ANNUAL;
  return null;
}

/**
 * POST /api/stripe/checkout
 * Aceita plan via body JSON ({"plan":"monthly"|"annual"}) OU via query (?plan=monthly)
 * Força parser JSON APENAS nesta rota para garantir que req.body exista.
 * Sempre responde em JSON (inclusive erros), para facilitar o debug.
 */
router.post("/checkout", express.json(), async (req, res) => {
  try {
    if (!stripe || !SECRET) {
      return res.status(500).json({ error: "stripe_not_configured" });
    }

    const plan = (req.body && req.body.plan) || req.query.plan || null;
    const price = getPriceFor(plan);
    if (!price) {
      return res
        .status(400)
        .json({ error: "invalid_plan", detail: "Use plan=monthly|annual via body JSON ou query string" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${FRONTEND_ORIGIN}/premium?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_ORIGIN}/premium?canceled=1`,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      payment_method_types: ["card"],
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error("checkout_error:", err);
    return res
      .status(500)
      .json({ error: "checkout_failed", detail: String(err && err.message ? err.message : err) });
  }
});

module.exports = router;
