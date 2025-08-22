// src/routes/stripe.js
const express = require("express");
const Stripe = require("stripe");

const router = express.Router();

const SECRET = process.env.STRIPE_SECRET_KEY || "";
const stripe = SECRET ? new Stripe(SECRET) : null;

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://ohmyfreud.site";

// --- Helpers para DEBUG de qual env está sendo usado ---
function pickFirst(nameList) {
  for (const n of nameList) {
    if (process.env[n]) return { value: process.env[n], source: n };
  }
  return { value: "", source: null };
}

const MONTHLY_PICK = pickFirst([
  "STRIPE_MONTHLY_PRICE_ID",
  "STRIPE_PRICE_MONTHLY",
  "STRIPE_PRICE_ID",
]);
const ANNUAL_PICK = pickFirst(["STRIPE_ANNUAL_PRICE_ID", "STRIPE_PRICE_ANNUAL"]);

const PRICE_MONTHLY = MONTHLY_PICK.value || "";
const PRICE_ANNUAL = ANNUAL_PICK.value || "";

function getPriceFor(plan) {
  if (!plan) return null;
  const p = String(plan).toLowerCase();
  if (p === "monthly") return PRICE_MONTHLY || null;
  if (p === "annual") return PRICE_ANNUAL || null;
  return null;
}

// Extrai "plan" de query, body objeto, body string (JSON) ou urlencoded
function extractPlan(req) {
  if (req.query && req.query.plan) return String(req.query.plan).toLowerCase();

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

// --------- DEBUG: ver envs e price ids lidos pelo processo ---------
router.get("/config", (req, res) => {
  res.json({
    ok: true,
    hasStripeKey: !!SECRET,
    monthly: { id: PRICE_MONTHLY || null, source: MONTHLY_PICK.source },
    annual: { id: PRICE_ANNUAL || null, source: ANNUAL_PICK.source },
    frontendOrigin: FRONTEND_ORIGIN,
    node: process.version,
    // envs originais (para checagem rápida)
    env: {
      STRIPE_MONTHLY_PRICE_ID: process.env.STRIPE_MONTHLY_PRICE_ID || null,
      STRIPE_PRICE_MONTHLY: process.env.STRIPE_PRICE_MONTHLY || null,
      STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID || null,
      STRIPE_ANNUAL_PRICE_ID: process.env.STRIPE_ANNUAL_PRICE_ID || null,
      STRIPE_PRICE_ANNUAL: process.env.STRIPE_PRICE_ANNUAL || null,
    },
  });
});

// --------- DEBUG: ecoar como o corpo foi recebido e que plan foi visto ---------
router.post("/echo", express.text({ type: "*/*" }), (req, res) => {
  const contentType = req.headers["content-type"] || null;
  let bodyPreview = req.body;
  if (typeof bodyPreview === "string" && bodyPreview.length > 500) {
    bodyPreview = bodyPreview.slice(0, 500) + "...";
  }
  const plan = extractPlan(req);
  res.json({
    ok: true,
    contentType,
    bodyType: typeof req.body,
    bodyPreview,
    query: req.query || {},
    plan,
  });
});

// --------- CHECKOUT Stripe (aceita JSON, form e query) ---------
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
        detail:
          "Use plan=monthly|annual no corpo (JSON/form) ou na query string. Conferir /api/stripe/config e /api/stripe/echo.",
        received: {
          plan,
          hasMonthlyPrice: !!PRICE_MONTHLY,
          hasAnnualPrice: !!PRICE_ANNUAL,
        },
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
