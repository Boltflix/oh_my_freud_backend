// src/routes/stripe.js
const express = require('express');
const Stripe = require('stripe');

const router = express.Router();

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://ohmyfreud.site';

const PRICE_MONTHLY =
  process.env.STRIPE_MONTHLY_PRICE_ID ||
  process.env.STRIPE_PRICE_MONTHLY ||
  process.env.STRIPE_PRICE_ID || '';

const PRICE_ANNUAL =
  process.env.STRIPE_ANNUAL_PRICE_ID ||
  process.env.STRIPE_PRICE_ANNUAL || '';

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

function getPlan(req) {
  const b = req.body || {};
  return String(b.plan ?? b['plan'] ?? req.query?.plan ?? '').toLowerCase();
}
function priceFor(plan) {
  if (plan === 'monthly') return PRICE_MONTHLY;
  if (plan === 'annual') return PRICE_ANNUAL;
  return null;
}

async function createSession(plan) {
  if (!stripe) throw new Error('stripe_not_configured');
  const priceId = priceFor(plan);
  if (!priceId) throw new Error('price_not_configured');

  return stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${FRONTEND_ORIGIN}/premium?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${FRONTEND_ORIGIN}/premium?canceled=1`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
  });
}

/** JSON: { url } — mantém compatibilidade */
router.post('/checkout', async (req, res) => {
  try {
    const plan = getPlan(req);
    if (plan !== 'monthly' && plan !== 'annual') {
      return res.status(400).json({ error: 'invalid_plan' });
    }
    const session = await createSession(plan);
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('stripe_checkout_error:', err);
    return res
      .status(500)
      .json({ error: 'stripe_error', detail: err?.message || 'unknown_error' });
  }
});

/** NOVO: Redireciona direto pro Stripe (sem fetch no front) */
router.post('/checkout/redirect', async (req, res) => {
  try {
    const plan = getPlan(req);
    if (plan !== 'monthly' && plan !== 'annual') {
      return res.status(400).send('invalid_plan');
    }
    const session = await createSession(plan);
    return res.redirect(303, session.url);
  } catch (err) {
    console.error('stripe_checkout_redirect_error:', err);
    return res.status(500).send('stripe_error');
  }
});

/** Diagnóstico opcional */
router.get('/config', (_req, res) => {
  res.json({
    ok: true,
    liveKey: STRIPE_SECRET_KEY.startsWith('sk_live_') || false,
    frontendOrigin: FRONTEND_ORIGIN,
    prices: { monthly: Boolean(PRICE_MONTHLY), annual: Boolean(PRICE_ANNUAL) },
  });
});

module.exports = router;
