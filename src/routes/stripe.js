// src/routes/stripe.js
const express = require("express");
const Stripe = require("stripe");

const router = express.Router();

const SECRET = process.env.STRIPE_SECRET_KEY || "";
const stripe = SECRET ? new Stripe(SECRET) : null;

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "https://ohmyfreud.site";

// util para checar envs na ordem certa (debug)
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

const ANNUAL_PICK = pickFirst([
  "STRIPE_ANNUAL_PRICE_ID",
  "STRIPE_PRICE_ANNUAL",
]);

const PRICE_MONTHLY = MONTHLY_PICK.value || "";
const PRICE_ANNUAL = ANNUAL_PICK.value || "";

// ------------------- helpers -------------------
function getPriceFor(plan) {
  if (!plan) return null;
  const p = String(plan).toLowerCase();
  if (p === "monthly") return PRICE_MONTHLY || null;
  if (p === "annual") return PRICE_ANNUAL || null;
  return null;
}

function extractPlanFromStringBody(str) {
  if (!str || typeof str !== "string") return null;

  // tenta JSON
  try {
    const asJson = JSON.parse(str);
    if (asJson && asJson.plan) return String(asJson.plan).toLowerCase();
  } catch (_) {
    // tenta form urlencoded
    try {
      const sp = new URLSearchParams(str);
      const p = sp.get("plan");
      if (p) return String(p).toLowerCase();
    } catch (_) {}
  }
  return null;
}

// lê o body cru SEM body-parser
function readRawBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => resolve(raw));
    req.on("error", () => resolve(""));
  });
}

async function resolvePlan(req) {
  // 1) query
  if (req.query && req.query.plan) {
    return String(req.query.plan).toLowerCase();
  }

  // 2) se algum parser anterior já transformou em objeto
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    if (req.body.plan) return String(req.body.plan).toLowerCase();
  }

  // 3) ler o corpo cru e tentar JSON ou urlencoded
  const raw = await readRawBody(req);
  req._rawBody = raw; // para debug
  const p = extractPlanFromStringBody(raw);
  if (p) return p;

  return null;
}

// ------------------- debug endpoints -------------------
router.get("/config", (req, res) => {
  res.json({
    ok: true,
    hasStripeKey: !!SECRET,
    monthly: { id: PRICE_MONTHLY || null, source: MONTHLY_PICK.source },
    annual: { id: PRICE_ANNUAL || null, source: ANNUAL_PICK.source },
    frontendOrigin: FRONTEND_ORIGIN,
    node: process.version,
    env: {
      STRIPE_MONTHLY_PRICE_ID: process.env.STRIPE_MONTHLY_PRICE_ID || null,
      STRIPE_PRICE_MONTHLY: process.env.STRIPE_PRICE_MONTHLY || null,
      STRIPE_PRICE_ID: process.env.STRIPE_PRICE_ID || null,
      STRIPE_ANNUAL_PRICE_ID: process.env.STRIPE_ANNUAL_PRICE_ID || null,
      STRIPE_PRICE_ANNUAL: process.env.STRIPE_PRICE_ANNUAL || null,
    },
  });
});

router.post("/echo", async (req, res) => {
  const raw = await readRawBody(req);
  const plan = extractPlanFromStringBody(raw) || (req.query && req.query.plan) || (req.body && req.body.plan) || null;
  res.json({
    ok: true,
    contentType: req.headers["content-type"] || null,
    rawPreview: typeof raw === "string" ? (raw.length > 500 ? raw.slice(0, 500) + "..." : raw) : null,
    query: req.query || {},
    plan: plan ? String(plan).toLowerCase() : null,
  });
});

// ------------------- checkout -------------------
router.post("/checkout", async (req, res) => {
  try {
    if (!stripe || !SECRET) {
      return res.status(500).json({ error: "stripe_not_configured" });
    }

    const plan = await resolvePlan(req);
    const price = getPriceFor(plan);

    if (!price) {
      return res.status(400).json({
        error: "invalid_plan",
        detail: "Use plan=monthly|annual no corpo (JSON/form) ou na query string",
        received: {
          plan: plan || null,
          rawBodyPreview: typeof req._rawBody === "string"
            ? (req._rawBody.length > 300 ? req._rawBody.slice(0, 300) + "..." : req._rawBody)
            : null,
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
    return res.status(500).json({
      error: "checkout_failed",
      detail: String(err?.message || err),
    });
  }
});

module.exports = router;
