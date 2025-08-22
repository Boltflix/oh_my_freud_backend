// src/server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();

/* ---------------- C O R S ---------------- */
const allowed = new Set([
  'https://ohmyfreud.site',
  'https://www.ohmyfreud.site',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.use(
  cors({
    origin: (origin, cb) => (!origin || allowed.has(origin) ? cb(null, true) : cb(new Error('Not allowed by CORS'), false)),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204,
    credentials: false, // ok para nosso caso
  })
);
app.options('*', cors());

/* --------- Stripe webhook precisa de RAW antes do json() --------- */
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  try {
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(200).send('ok'); // não bloqueia deploy
    }
    // Validação se quiser usar os eventos:
    // const sig = req.headers['stripe-signature'];
    // const event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    return res.status(200).send('ok');
  } catch (e) {
    console.error('webhook_error:', e);
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
});

/* ------------- Demais rotas usam JSON ------------- */
app.use(express.json());

/* ------------- STRIPE (com aliases) ------------- */
const stripeRouter = require('./routes/stripe');
app.use('/api/stripe', stripeRouter);   // canônico
app.use('/api/premium', stripeRouter);  // alias
app.use('/premium', stripeRouter);      // alias

/* ------------- Interpret (opcional) ------------- */
/* Se o arquivo existir, monta; se não existir, ignora sem quebrar */
try {
  const interpretRouter = require('./routes/interpret');
  app.use('/api/interpret', interpretRouter);
  app.use('/interpret', interpretRouter);
} catch {
  console.log('routes/interpret.js ausente — ignorando.');
}

/* ------------- Health ------------- */
app.get('/api/health', (req, res) => {
  const hasStripe = !!STRIPE_SECRET_KEY;
  const hasOpenAI = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY);
  const keyIsLive = hasStripe && STRIPE_SECRET_KEY.startsWith('sk_live_');

  res.json({
    ok: true,
    hasStripe,
    hasOpenAI,
    keyIsLive,
    stripePrices: {
      monthly:
        process.env.STRIPE_MONTHLY_PRICE_ID ||
        process.env.STRIPE_PRICE_MONTHLY ||
        process.env.STRIPE_PRICE_ID ||
        null,
      annual:
        process.env.STRIPE_ANNUAL_PRICE_ID ||
        process.env.STRIPE_PRICE_ANNUAL ||
        null,
    },
    frontendOrigin: process.env.FRONTEND_ORIGIN || 'https://ohmyfreud.site',
  });
});

/* ------------- Start ------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Oh My Freud backend listening on', PORT);
});

