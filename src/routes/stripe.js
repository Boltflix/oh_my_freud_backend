// src/routes/stripe.js  (CommonJS)
const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  monthly: process.env.STRIPE_MONTHLY_PRICE_ID,
  annual: process.env.STRIPE_ANNUAL_PRICE_ID,
  fallback: process.env.STRIPE_PRICE_ID, // opcional (compat com env antiga)
};

router.post('/checkout', async (req, res) => {
  try {
    const plan = String(req.body?.plan || req.query?.plan || 'monthly').toLowerCase();

    const price =
      (plan === 'annual' ? PRICES.annual : PRICES.monthly) ||
      PRICES.fallback;

    if (!price) {
      return res.status(400).json({ error: 'missing_price_id_for_plan' });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price, quantity: 1 }],
      success_url: `${appUrl}/premium?status=success`,
      cancel_url: `${appUrl}/premium?status=cancel`,
      allow_promotion_codes: true,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('stripe/checkout error:', err);
    return res.status(500).json({ error: 'checkout_failed' });
  }
});

module.exports = router;
