// src/server.js (CommonJS) — robusto contra export errado
require('dotenv').config();
const express = require('express');
const cors = require('cors');

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

// ---------- Stripe webhook raw ANTES do json ----------
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// ---------- Demais rotas em JSON ----------
app.use(express.json());

// ---------- Helpers p/ carregar routers com segurança ----------
function loadRouter(path) {
  try {
    const mod = require(path);
    // pode exportar diretamente o router (function) OU { router: Router }
    const r = (typeof mod === 'function' && typeof mod.use === 'function')
      ? mod
      : (mod && typeof mod.router === 'function' && typeof mod.router.use === 'function'
          ? mod.router
          : null);
    if (!r) console.warn(`[WARN] Router inválido em ${path}. Ignorando registro.`);
    return r;
  } catch (e) {
    console.warn(`[WARN] Falha ao carregar ${path}: ${e.message}`);
    return null;
  }
}

function loadStripe() {
  try {
    const mod = require('./routes/stripe');
    const router =
      (mod && typeof mod === 'function' && typeof mod.use === 'function') ? mod
      : (mod && typeof mod.router === 'function' && typeof mod.router.use === 'function') ? mod.router
      : null;
    const createCheckout = mod && typeof mod.createCheckout === 'function' ? mod.createCheckout : null;
    if (!router) console.warn('[WARN] stripeRouter inválido. /api/stripe não será registrado.');
    if (!createCheckout) console.warn('[WARN] createCheckout ausente. Aliases /premium não serão registrados.');
    return { router, createCheckout };
  } catch (e) {
    console.warn('[WARN] Falha ao carregar ./routes/stripe:', e.message);
    return { router: null, createCheckout: null };
  }
}

// ---------- Health ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'oh-my-freud-backend', ts: new Date().toISOString() });
});

// ---------- Interpret ----------
const interpretRouter = loadRouter('./routes/interpret');
if (interpretRouter) {
  app.use('/api/interpret', interpretRouter);
  app.use('/interpret', interpretRouter); // alias
}

// ---------- Stripe ----------
const { router: stripeRouter, createCheckout } = loadStripe();
if (stripeRouter) app.use('/api/stripe', stripeRouter);
if (createCheckout) {
  app.post('/api/premium', (req, res) => createCheckout(req, res));
  app.post('/premium', (req, res) => createCheckout(req, res));
}

// ---------- Erro genérico ----------
app.use((err, req, res, next) => {
  console.error('[UNHANDLED]', err);
  res.status(500).json({ error: 'internal_error', detail: err?.message || 'unknown' });
});

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on ${PORT}`));
}
module.exports = app;
