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

// resolve price id
function getPriceFor(plan) {
  if (!plan) return null;
  const p = String(plan).toLowerCase();
  if (p === "monthly") return PRICE_MONTHLY;
  if (p === "annual") return PRICE_ANNUAL;
  return null;
}

// tenta extrair "plan" do query, do body objeto, de JSON cru ou URL-encoded
function extractPlan(req) {
  // 1) query ?plan=monthly
  if (req.query?.plan) return String(req.query.plan).toLowerCase();

  // 2) body já objeto (caso algum json() tenha rodado)
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    if (req.body.plan) return String(req.body.plan).toLowerCase();
  }

  // 3) body texto cru -> tentar JSON
  if (typeof req.body === "string" && req.body.length) {
    try {
      const asJson = JSON.parse(req.body);
      if (asJson && asJson.plan) return String(asJson.plan).toLowerCase();
    } catch (_) {
      // 4) body texto cru -> tentar form urlencoded
      try {
        const sp = new URLSearchParams(req.body);
        const p = sp.get("plan");
        if (p) return String(p).toLowerCase();
      } catch (_) {}
    }
  }
  return null;
}

/**
 * POST /api/stripe/checkout
 * Aceita:
 *  - JSON: {"plan":"monthly"|"annual"}
 *  - x-www-form-urlencoded: plan=monthly
 *  - Query: ?plan=monthly
 *
 * Usamos express.text({type:'*/*'}) para NÃO deixar o body-parser responder 400 HTML.
 * Fazemos o parse manual acima e sempre respondemos JSON.
 */
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
