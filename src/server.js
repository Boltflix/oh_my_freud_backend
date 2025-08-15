// server.js — cola TUDO isso

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Stripe = require('stripe');

// ====== LÊ AS CHAVES DO RENDER (Environment Variables) ======
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // (não usamos aqui, só no resto do app)
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY; // chave secreta do Stripe (sk_live...)
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET; // segredo do webhook (whsec_...)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ====== CLIENTES (opcional Supabase) ======
let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null;
const app = express();

/**
 * ATENÇÃO: o webhook do Stripe PRECISA vir ANTES do express.json()
 * e usar express.raw(), senão a verificação de assinatura falha.
 */
app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    // Se não tiver Stripe ou segredo do webhook, só responde OK pra não quebrar
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(200).send('[Webhook desabilitado]');
    }

    // 1) Pega a assinatura que vem no cabeçalho
    const sig = req.headers['stripe-signature'];

    // 2) Tenta “montar” o evento de forma segura (Stripe valida a assinatura)
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('❌ Assinatura inválida do webhook:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // 3) Aqui já é seguro. Vamos tratar o “tipo” do evento
    try {
      const eventType = event.type;         // ex: 'checkout.session.completed'
      const data = event.data.object;       // conteúdo principal (ex: sessão, assinatura, etc.)

      console.log('📨 Recebi evento Stripe:', eventType);

      // (Opcional) evitar processar o MESMO evento 2x (Stripe pode reenviar):
      if (await foiProcessado(event.id)) {
        console.log('🔁 Evento já processado:', event.id);
        return res.status(200).send('[ok duplicado]');
      }

      // “Menu de ações” por tipo de evento:
      switch (eventType) {
        case 'checkout.session.completed': {
          // quando o checkout termina (em assinatura: mode === 'subscription')
          const { id: sessionId, customer, customer_email, subscription, mode } = data;
          console.log('✅ checkout.session.completed:', { sessionId, mode, customer, subscription });

          if (mode === 'subscription' && subscription) {
            await sincronizarAssinatura(subscription, customer, customer_email);
          }
          break;
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
          // o objeto já é a assinatura completa
          await aplicarMudancaAssinatura(data);
          break;
        }

        case 'invoice.payment_succeeded': {
          console.log('💸 invoice.payment_succeeded:', { invoice: data.id, amount: data.amount_paid });
          await registrarFatura(data, true);
          break;
        }

        case 'invoice.payment_failed': {
          console.log('⚠️ invoice.payment_failed:', { invoice: data.id, amount: data.amount_due });
          await registrarFatura(data, false);
          break;
        }

        default:
          console.log('ℹ️ Evento não tratado especificamente:', eventType);
      }

      // marca como processado (idempotência simples)
      await marcarProcessado(event.id, eventType);

      // MUITO IMPORTANTE: sempre responder 200 se deu tudo certo,
      // senão o Stripe fica re-tentando e aparece 404/400 no dashboard.
      return res.status(200).send('[ok]');
    } catch (err) {
      console.error('❌ Erro interno tratando webhook:', err);
      return res.status(500).send('Erro interno');
    }
  }
);

// ====== AQUI, DEPOIS DO WEBHOOK, ENTRAM OS MIDDLEWARES NORMAIS ======
app.use(cors({ origin: '*' }));
app.use(express.json());

// Rota de saúde (teste rápido)
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    hasStripe: !!stripe,
    hasOpenAI: !!OPENAI_API_KEY,
    hasSupabase: !!supabase,
    now: new Date().toISOString()
  });
});

// (exemplo) rota raiz só pra não dar “Cannot GET /”
app.get('/', (req, res) => {
  res.type('text').send('Backend Oh My Freud rodando ✅');
});

// Sobe o servidor
app.listen(PORT, () => {
  console.log(`Oh My Freud backend escutando na porta ${PORT}`);
});


// ------------- “HELPERS” SIMPLES (Supabase) -------------
// Se você ainda não tem tabelas, eles só fazem console.log.
// Depois a gente troca por INSERT/UPDATE de verdade.

async function foiProcessado(eventId) {
  // Se não quiser usar Supabase agora, sempre retorna false
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('webhook_events')
    .select('id')
    .eq('id', eventId)
    .maybeSingle();

  if (error) {
    console.log('(!) Erro consultando webhook_events:', error);
    return false;
  }
  return !!data;
}

async function marcarProcessado(eventId, type) {
  if (!supabase) {
    console.log('ℹ️ (sem supabase) marcaria processado:', eventId, type);
    return;
  }
  const { error } = await supabase
    .from('webhook_events')
    .insert({ id: eventId, type, processed_at: new Date().toISOString() });

  if (error) console.log('(!) Erro inserindo webhook_events:', error);
}

async function sincronizarAssinatura(subscriptionId, customerId, email) {
  console.log('↔️ Sincronizar assinatura', { subscriptionId, customerId, email });

  // Aqui daria para puxar do Stripe: const sub = await stripe.subscriptions.retrieve(subscriptionId)
  // e salvar/atualizar na sua tabela "subscriptions".
}

async function aplicarMudancaAssinatura(sub) {
  console.log('🔄 Mudança de assinatura:', {
    id: sub.id,
    status: sub.status,
    customer: sub.customer,
    price: sub.items?.data?.[0]?.price?.id
  });

  // Aqui você atualizaria a linha na tabela "subscriptions".
}

async function registrarFatura(inv, ok) {
  console.log(ok ? '💚 Pagamento OK' : '💔 Pagamento FALHOU', {
    invoice: inv.id,
    customer: inv.customer,
    amount: inv.amount_paid ?? inv.amount_due,
    currency: inv.currency
  });

  // Aqui você gravaria/atualizaria a tabela "payments".
}



