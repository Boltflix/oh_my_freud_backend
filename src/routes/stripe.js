// src/routes/stripe.js
const express = require('express');
const Stripe = require('stripe');
const router = express.Router();

const SECRET = process.env.STRIPE_SECRET_KEY || '';
const stripe = SECRET ? new Stripe(SECRET) : null;

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://ohmyfreud.site';

// Price IDs (live) — use variáveis existentes ou fallback compatível
const PRICE_MONTHLY =
  process.env.STRIPE_MONTHLY_PRICE_ID ||
  process.env.STRIPE_PRICE_MONTHLY ||
  process.env.STRIPE_PRICE_ID || // compat
  '';

const PRICE_ANNUAL =
  process.env.STRIPE_ANNUAL_PRICE_ID ||
  process.env.STRIPE_PRICE_ANNUAL ||
  '';

function pickPlan(req) {
  // aceita JSON, form-urlencoded e query string
  const fromBody = (req.body && (req.body.plan || req.body.Plan || req.body.PLAN)) || null;
  const fromQuery =
    (req.query && (req.query.plan || req.query.Plan || req.query.PLAN)) || null;
  const plan = (fromBody || fromQuery || '').toString().toLowerCase();
  if (plan === 'monthly' || plan === 'month' || plan === 'mensal') return 'monthly';
  if (plan === 'annual' || plan === 'yearly' || plan === 'anual' || plan === 'ano') return 'annual';
  return null;
}

function priceFor(plan) {
  if (plan === 'monthly') return PRICE_MONTHLY;
  if (plan === 'annual') return PRICE_ANNUAL;
  return null;
}

/* ---- Debug helpers (opcional para diagnóstico) ---- */
router.get('/config', (req, res) => {
  res.json({
    ok: true,
    hasStripeKey: !!SECRET,
    monthly: { id: PRICE_MONTHLY || null },
    annual: { id: PRICE_ANNUAL || null },
    frontendOrigin: FRONTEND_ORIGIN,
    node: process.version,
  });
});

router.post('/echo', (req, res) => {
  res.json({
    ok: true,
    contentType: req.headers['content-type'] || null,
    plan: (req.body && req.body.plan) || null,
    query: req.query || {},
  });
});

/* ---- POST /api/stripe/checkout ---- */
router.post('/checkout', async (req, res) => {
  try {
    if (!stripe || !SECRET) {
      return res.status(500).json({ error: 'stripe_not_configured' });
    }

    const plan = pickPlan(req);
    const price = priceFor(plan);
    if (!price) {
      return res.status(400).json({
        error: 'invalid_plan',
        detail: 'Use plan=monthly|annual (JSON, x-www-form-urlencoded, ou ?plan=)',
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: `${FRONTEND_ORIGIN}/premium?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_ORIGIN}/premium?canceled=1`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      payment_method_types: ['card'],
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('checkout_error:', err);
    return res
      .status(500)
      .json({ error: 'checkout_failed', detail: String(err.message || err) });
  }
});

module.exports = router;

