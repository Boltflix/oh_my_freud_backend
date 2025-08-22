// src/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();

/* =========================
   CORS — ANTES de qualquer parser
   ========================= */
const allowed = new Set([
  'https://ohmyfreud.site',
  'https://www.ohmyfreud.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.use(
  cors({
    origin: (origin, cb) => (!origin || allowed.has(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS'))),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
  })
);
app.options('*', cors());

/* =========================
   HEALTH
   ========================= */
app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() });
});

/* =========================
   STRIPE WEBHOOK (raw!)
   ========================= */
const stripeSecret = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

// manter exatamente assim: /api/stripe/webhook com express.raw
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    // não quebra deploy se não configurado
    return res.status(200).send('Webhook disabled');
  }
  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      req.headers['stripe-signature'],
      process.env.STRIPE_WEBHOOK_SECRET
    );
    // trate eventos se quiser (invoice.paid, checkout.session.completed etc.)
    return res.status(200).send('ok');
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

/* =========================
   JSON parser (depois do webhook)
   ========================= */
app.use(express.json());

/* =========================
   ROTAS STRIPE (+ aliases)
   ========================= */
const stripeRouter = require('./routes/stripe');
app.use('/api/stripe', stripeRouter);   // canônico
app.use('/api/premium', stripeRouter);  // alias
app.use('/premium', stripeRouter);      // alias

/* =========================
   START
   ========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Oh My Freud backend listening on ${PORT}`);
});
