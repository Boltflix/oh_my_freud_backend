// src/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

// Stripe (para webhook inline)
const Stripe = require('stripe');
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Routers
const stripeRouter = require('./routes/stripe');

const app = express();

// ====== CORS (ANTES de qualquer parser) ======
const allowed = new Set([
  'https://ohmyfreud.site',
  'https://www.ohmyfreud.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.has(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

// Opcional, mas ajuda alguns hosts:
app.options('*', cors());

// ====== HEALTH ======
app.get('/api/health', (_req, res) => {
  res.status(200).json({ ok: true, time: new Date().toISOString() });
});

// ====== STRIPE WEBHOOK (raw!) ======
// Mantido exatamente assim: /api/stripe/webhook com express.raw
if (stripe) {
  app.post(
    '/api/stripe/webhook',
    express.raw({ type: 'application/json' }),
    (req, res) => {
      const sig = req.headers['stripe-signature'];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!endpointSecret) {
        // Sem secret configurado, não quebramos deploy.
        return res.status(200).send('Webhook disabled');
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } catch (err) {
        console.error('⚠️  Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      // Trate os eventos que você precisa. Por ora, só 200.
      // console.log('🔔  Received event:', event.type);
      return res.status(200).send('ok');
    }
  );
}

// ====== JSON parser (DEPOIS do webhook) ======
app.use(express.json());

// ====== ROTAS ======
app.use('/api/stripe', stripeRouter);
// Aliases pedidas: /api/premium e /premium apontam para Stripe
app.use('/api/premium', stripeRouter);
app.use('/premium', stripeRouter);

// (Se quiser manter /interpret no futuro, pode declarar aqui. Front já tem fallback.)

// ====== SERVIDOR ======
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Oh My Freud backend on port ${PORT}`);
});

