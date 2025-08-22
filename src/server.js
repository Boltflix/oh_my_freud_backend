// src/server.js (CommonJS)

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const interpretRouter = require('./routes/interpret');
const { router: stripeRouter, createCheckout } = require('./routes/stripe');

// Carrega wellness com proteção (evita crash se export vier errado)
let wellnessRouter = null;
try {
  // wellness.js deve exportar **module.exports = router**
  // Se exportar objeto { router }, a checagem abaixo evita quebrar o app.
  const mod = require('./routes/wellness');
  wellnessRouter =
    typeof mod === 'function' && typeof mod.use === 'function'
      ? mod
      : (mod && mod.router && typeof mod.router.use === 'function' ? mod.router : null);
  if (!wellnessRouter) {
    console.warn('[WARN] wellness router not loaded (export mismatch). App will boot without /api/wellness.');
  }
} catch (e) {
  console.warn('[WARN] wellness router load error:', e.message);
}

const app = express();

// ---------- CORS ANTES do express.json() ----------
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

// ---------- Webhook Stripe com raw ----------
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// ---------- Demais rotas com JSON ----------
app.use(express.json());

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'oh-my-freud-backend', ts: new Date().toISOString() });
});

// Interpret
app.use('/api/interpret', interpretRouter);
app.use('/interpret', interpretRouter); // alias

// Stripe
app.use('/api/stripe', stripeRouter);
app.post('/api/premium', (req, res) => createCheckout(req, res));
app.post('/premium', (req, res) => createCheckout(req, res));

// Wellness (só registra se carregou ok)
if (wellnessRouter) {
  app.use('/api/wellness', wellnessRouter);
}

// Erro genérico
app.use((err, req, res, next) => {
  console.error('[UNHANDLED]', err);
  res.status(500).json({ error: 'internal_error', detail: err?.message || 'unknown' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}

module.exports = app;

