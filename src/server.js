// src/server.js
const express = require('express');
const cors = require('cors');

const app = express();

/* -------------------- CORS -------------------- */
// Inclui seus domínios + os do editor Horizons/Hostinger
const allowed = new Set([
  'https://ohmyfreud.site',
  'https://www.ohmyfreud.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',

  // Editores/preview do Horizons
  'https://horizons.hostinger.com',
  'https://horizons.hostinger.dev',
  'https://horizons-frontend-local.hostinger.dev',
  'http://localhost:4000',
]);

app.use(
  cors({
    origin: (origin, cb) => {
      // requests sem Origin (curl/healthchecks) -> permitir
      if (!origin || allowed.has(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS: ' + origin), false);
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
    credentials: false,
  })
);

/* -------- Stripe webhook (RAW antes do json) -------- */
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      // Sem webhook configurado -> responde ok pra não travar deploy
      return res.status(200).send('ok');
    }
    // Se quiser validar: const sig = req.headers['stripe-signature'];
    // const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    return res.status(200).send('ok');
  } catch (e) {
    console.error('webhook_error:', e);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
});

/* ---------------- Body parser JSON ---------------- */
app.use(express.json({ limit: '1mb' }));

/* ---------------- Rotas opcionais (Stripe) ---------------- */
try {
  const stripeRouter = require('./routes/stripe');
  app.use('/api/stripe', stripeRouter);
  app.use('/api/premium', stripeRouter);
  app.use('/premium', stripeRouter);
} catch (e) {
  // Router de Stripe ausente — segue sem quebrar
  console.warn('[init] stripe router not found (ok if not used yet)');
}

/* ---------------- Rota Apply-Edit (editor inline) ---------------- */
const applyEditRouter = require('./routes/applyEdit');
app.use('/api/apply-edit', applyEditRouter);

/* ---------------- Health ---------------- */
app.get('/api/health', (req, res) => {
  const hasStripe = !!(process.env.STRIPE_SECRET_KEY);
  const hasOpenAI = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY);
  const editorEnabled = process.env.ALLOW_INLINE_EDIT === '1';

  res.json({
    ok: true,
    hasStripe,
    hasOpenAI,
    editorEnabled,
    frontendOrigin: process.env.FRONTEND_ORIGIN || 'https://ohmyfreud.site',
    node: process.version,
  });
});

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Oh My Freud backend listening on', PORT);
});
