import Stripe from 'stripe';
import 'dotenv/config';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';

let stripe = null;

export function getStripeClient() {
  if (!STRIPE_SECRET_KEY) return null;
  if (!stripe) {
    stripe = new Stripe(STRIPE_SECRET_KEY);
  }
  return stripe;
}

export function hasStripeConfigured() {
  return !!(STRIPE_SECRET_KEY && STRIPE_WEBHOOK_SECRET);
}

export function getStripeWebhookSecret() {
  return STRIPE_WEBHOOK_SECRET;
}

export function resolveStripePriceId(planId) {
  const map = {
    coach: process.env.STRIPE_PRICE_COACH || '',
    pro: process.env.STRIPE_PRICE_PRO || '',
    starter: process.env.STRIPE_PRICE_STARTER || '',
  };

  return map[String(planId || '').toLowerCase()] || '';
}
