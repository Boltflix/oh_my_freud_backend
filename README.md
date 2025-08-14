# Oh My Freud! – Backend

Backend pronto para Deploy (Render) com:
- **Express**
- **Stripe** (checkout de assinatura + webhook)
- **Supabase** (salva status da assinatura)
- **OpenAI** (interpretação de sonhos)

## Rotas
- `GET /api/health` → status do serviço
- `POST /api/create-checkout-session` → cria sessão de checkout  
  **Body exemplo:**
  ```json
  { "successUrl": "https://seu-front/sucesso", "cancelUrl": "https://seu-front/cancelado", "email": "opcional@exemplo.com" }
  ```
  **Resposta:** `{ "url": "https://checkout.stripe.com/..." }`

- `POST /api/stripe-webhook` → URL do webhook no Stripe (use este caminho exato)
- `POST /api/interpret-dream` → gera interpretação (OpenAI)  
  **Body exemplo:** `{ "text": "descreva seu sonho aqui" }`

## Variáveis de ambiente (Render)

```
OPENAI_API_KEY=sk_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...   # só depois de criar o webhook no Stripe
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
PORT=3000
NODE_ENV=production
```

> **Dica:** Se o webhook ainda não existir, deixe `STRIPE_WEBHOOK_SECRET` vazia. O endpoint vai responder sem quebrar o deploy.

## Deploy no Render
1. Crie um repositório no GitHub e envie estes arquivos.
2. No Render, **New Web Service** → conecte o repositório.
3. **Build Command:** `npm install`
4. **Start Command:** `npm start`
5. Adicione as variáveis de ambiente e **Deploy**.
