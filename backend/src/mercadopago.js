import 'dotenv/config';

const MERCADOPAGO_ACCESS_TOKEN = String(process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim();
const MERCADOPAGO_CURRENCY_ID = String(process.env.MERCADOPAGO_CURRENCY_ID || 'BRL').trim().toUpperCase();

export function hasMercadoPagoConfigured() {
  return !!MERCADOPAGO_ACCESS_TOKEN;
}

export function resolveMercadoPagoPlan(planId) {
  const plan = String(planId || '').toLowerCase();
  const raw = {
    coach: process.env.MERCADOPAGO_AMOUNT_COACH || '',
    pro: process.env.MERCADOPAGO_AMOUNT_PRO || '',
    starter: process.env.MERCADOPAGO_AMOUNT_STARTER || '',
  }[plan] || '';

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    amount,
    currencyId: MERCADOPAGO_CURRENCY_ID,
  };
}

export async function createMercadoPagoPreference({
  title,
  planId,
  amount,
  payerEmail,
  externalReference,
  successUrl,
  cancelUrl,
  pendingUrl,
  notificationUrl,
  metadata = {},
}) {
  if (!MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error('Mercado Pago não configurado');
  }

  const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      items: [
        {
          id: String(planId || 'coach'),
          title: String(title || 'CrossApp Coach'),
          quantity: 1,
          currency_id: MERCADOPAGO_CURRENCY_ID,
          unit_price: Number(amount),
        },
      ],
      payer: payerEmail ? { email: String(payerEmail) } : undefined,
      external_reference: String(externalReference),
      metadata,
      back_urls: {
        success: successUrl,
        failure: cancelUrl,
        pending: pendingUrl || successUrl,
      },
      auto_return: 'approved',
      notification_url: notificationUrl || undefined,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Erro ao criar preferência Mercado Pago');
  }

  return data;
}

export async function fetchMercadoPagoPayment(paymentId) {
  if (!MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error('Mercado Pago não configurado');
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Erro ao consultar pagamento Mercado Pago');
  }

  return data;
}

export function normalizeMercadoPagoStatus(status) {
  switch (String(status || '').toLowerCase()) {
    case 'approved':
    case 'authorized':
      return 'active';
    case 'pending':
    case 'in_process':
      return 'pending';
    default:
      return 'inactive';
  }
}
