// src/routes/stripe.js
const express = require('express');
const Stripe = require('stripe');

const router = express.Router();
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

// FRONTEND_ORIGIN define o domínio para success/cancel
const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  'https://ohmyfreud.site';

// IDs de preço em modo Live (confirme no dashboard)
const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || process.env.STRIPE_PRICE_MONTHLY_LIVE;
const PRICE_ANNUAL  = process.env.STRIPE_PRICE_ANNUAL  || process.env.STRIPE_PRICE_ANNUAL_LIVE;

router.post('/checkout', async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({
        error: 'stripe_not_configured',
        detail: 'STRIPE_SECRET_KEY ausente no servidor.',
      });
    }

    const { plan } = req.body || {};
    let priceId = null;

    if (plan === 'monthly') priceId = PRICE_MONTHLY;
    if (plan === 'annual')  priceId = PRICE_ANNUAL;

    if (!priceId) {
      return res.status(400).json({
        error: 'invalid_plan',
        detail: 'Informe plan = "monthly" | "annual" com Price ID válido no servidor.',
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${FRONTEND_ORIGIN}/premium?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_ORIGIN}/premium?canceled=1`,
      allow_promotion_codes: true,
      // client_reference_id, metadata, etc. se desejar
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: 'stripe_error', detail: err.message || 'unknown_error' });
  }
});

module.exports = router;
