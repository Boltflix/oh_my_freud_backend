// src/server.js (CommonJS) — rollback sem /api/wellness
// Start: node src/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const interpretRouter = require('./routes/interpret');
const { router: stripeRouter, createCheckout } = require('./routes/stripe');

const app = express();

// ---- CORS ANTES do express.json() ----
const allowed = new Set([
  'https://ohmyfreud.site',
  'https://www.ohmyfreud.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);
const corsOptions = {
  origin: (origin, cb) => (!origin || allowed.has(origin)) ? cb(null, true) : cb(null, false),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ---- Stripe webhook (raw) ANTES do json ----
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// ---- Demais rotas em JSON ----
app.use(express.json());

// ---- Health ----
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'oh-my-freud-backend', ts: new Date().toISOString() });
});

// ---- Interpret ----
app.use('/api/interpret', interpretRouter);
app.use('/interpret', interpretRouter); // alias

// ---- Stripe ----
app.use('/api/stripe', stripeRouter);
app.post('/api/premium', (req, res) => createCheckout(req, res)); // alias p/ Stripe
app.post('/premium', (req, res) => createCheckout(req, res));     // alias p/ Stripe

// ---- Erro genérico ----
app.use((err, req, res, next) => {
  console.error('[UNHANDLED]', err);
  res.status(500).json({ error: 'internal_error', detail: err?.message || 'unknown' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}

module.exports = app;
