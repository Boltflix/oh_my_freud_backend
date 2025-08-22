// src/routes/stripe.js
const express = require("express");
const Stripe = require("stripe");

const router = express.Router();

const SECRET = process.env.STRIPE_SECRET_KEY || "";
const stripe = SECRET ? new Stripe(SECRET) : null;

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://ohmyfreud.site";

const PRICE_MONTHLY =
  process.env.STRIPE_MONTHLY_PRICE_ID ||
  process.env.STRIPE_PRICE_MONTHLY ||
  process.env.STRIPE_PRICE_ID ||
  "";

const PRICE_ANNUAL =
  process.env.STRIPE_ANNUAL_PRICE_ID ||
  process.env.STRIPE_PRICE_ANNUAL ||
  "";

// Mapeia o plan -> price id
function getPriceFor(plan) {
  if (!plan) return null;
  const p = String(plan).toLowerCase();
  if (p === "monthly") return PRICE_MONTHLY;
  if (p === "annual") return PRICE_ANNUAL;
  return null;
}

// Extrai "plan" de query, body já parseado, body texto (JSON) ou body urlencoded
function extractPlan(req) {
  if (req.query?.plan) return String(req.query.plan).toLowerCase();

  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    if (req.body.plan) return String(req.body.plan).toLowerCase();
  }

  if (typeof req.body === "string" && req.body.length) {
    // tenta JSON
    try {
      const asJson = JSON.parse(req.body);
      if (asJson && asJson.plan) return String(asJson.plan).toLowerCase();
    } catch (_) {
      // tenta form urlencoded
      try {
        const sp = new URLSearchParams(req.body);
        const p = sp.get("plan");
        if (p) return String(p).toLowerCase();
      } catch (_) {}
    }
  }

  return null;
}

// POST /api/stripe/checkout
// Usa express.text() para evitar que algum body-parser global gere 400 HTML.
// Aceita: JSON {"plan":"monthly"|"annual"}, form urlencoded (plan=...), ou query (?plan=...).
router.post("/checkout", express.text({ type: "*/*" }), async (req, res) => {
  try {
    if (!stripe || !SECRET) {
      return res.status(500).json({ error: "stripe_not_configured" });
    }

    const plan = extractPlan(req);
    const price = getPriceFor(plan);
    if (!price) {
      return res.status(400).json({
        error: "invalid_plan",
        detail: "Use plan=monthly|annual no corpo (JSON/form) ou na query string",
      });
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
      .json({ error: "checkout_failed", detail: String(err?.message || err) });
  }
});

module.exports = router;
