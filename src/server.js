/**
 * Oh My Freud! Backend
 * Express + Stripe + Supabase + OpenAI
 */
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

// ---- ENV ----
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET; // preencha depois de criar o webhook no Stripe

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ---- CLIENTS ----
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const openai = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;
const supabase = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const app = express();

/**
 * IMPORTANTE: o webhook do Stripe precisa vir ANTES do express.json(),
 * usando express.raw(), senão a verificação de assinatura falha.
 */
app.post('/api/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return res.status(200).send('[Webhook desabilitado]');
  }
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('❌ Assinatura do webhook inválida:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const email = session.customer_details?.email || session.customer_email;
        const currentPeriodEnd = session.expires_at ? new Date(session.expires_at * 1000) : null;

        if (supabase && email) {
          await supabase.from('subscriptions').insert({
            email,
            provider: 'stripe',
            price_id: STRIPE_PRICE_ID || null,
            status: 'active',
            current_period_end: currentPeriodEnd
          });
          console.log('✅ Sub criada no Supabase para', email);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const status = sub.status;
        const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;

        let email = null;
        if (sub.customer && stripe) {
          try {
            const customer = await stripe.customers.retrieve(sub.customer);
            email = customer.email || null;
          } catch {}
        }

        if (supabase && email) {
          await supabase.from('subscriptions').upsert({
            email,
            provider: 'stripe',
            price_id: STRIPE_PRICE_ID || null,
            status,
            current_period_end: currentPeriodEnd
          }, { onConflict: 'email' });
          console.log(`🔁 Sub ${status} atualizada para`, email);
        }
        break;
      }
      default:
        // outros eventos podem ser ignorados no MVP
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Erro no processamento do webhook:', err);
    res.status(500).send('Webhook handler error');
  }
});

// Middlewares comuns (depois do webhook):
app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check (teste rápido)
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    hasStripe: !!stripe,
    hasOpenAI: !!openai,
    hasSupabase: !!supabase,
    now: new Date().toISOString()
  });
});

// Criar sessão de checkout de assinatura (Stripe)
app.post('/api/create-checkout-session', async (req, res) => {
  try {
    if (!stripe) return res.status(400).json({ error: 'Stripe não configurado' });
    if (!STRIPE_PRICE_ID) return res.status(400).json({ error: 'STRIPE_PRICE_ID ausente' });

    const { successUrl, cancelUrl, email } = req.body || {};
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      success_url: successUrl || 'https://example.com/success',
      cancel_url: cancelUrl || 'https://example.com/cancel',
      allow_promotion_codes: true,
      customer_email: email || undefined
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('Erro ao criar sessão de checkout:', err);
    res.status(500).json({ error: 'Falha ao criar sessão de checkout' });
  }
});

// Interpretação de sonhos (OpenAI)
app.post('/api/interpret-dream', async (req, res) => {
  try {
    if (!openai) return res.status(400).json({ error: 'OpenAI não configurado' });
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Faltou o campo \"text\"' });

    const systemPrompt = `Você é um psicanalista inspirado na linguagem de Freud. 
Explique SEPARADO: (1) símbolos/associações possíveis, (2) hipóteses de desejo/angústia, (3) sugestões de reflexão.
Seja cuidadoso e claro, sem patologizar. Lembre que isto é entretenimento e não substitui terapia.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Meu sonho: ${text}` }
      ],
      temperature: 0.7
    });

    const answer = completion.choices?.[0]?.message?.content || 'Não consegui gerar interpretação.';
    res.json({ interpretation: answer });
  } catch (err) {
    console.error('Erro OpenAI:', err);
    res.status(500).json({ error: 'Falha ao interpretar sonho' });
  }
});

app.listen(PORT, () => {
  console.log(`Oh My Freud backend escutando na porta ${PORT}`);
});
