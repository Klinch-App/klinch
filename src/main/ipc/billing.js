const { ipcMain, shell } = require('electron');
const { stripe }         = require('../api/stripe');

// Price IDs — create these in Stripe Dashboard then add to .env
const PRICES = {
  starter:   process.env.STRIPE_PRICE_STARTER   || null,
  unlimited: process.env.STRIPE_PRICE_UNLIMITED || null,
  pack:      process.env.STRIPE_PRICE_PACK      || null,
};

const SUCCESS_URL    = process.env.STRIPE_SUCCESS_URL    || 'https://tryklinch.com/billing/success';
const CANCEL_URL     = process.env.STRIPE_CANCEL_URL     || 'https://tryklinch.com/billing/cancel';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;

function _unavailable() {
  return { ok: false, error: 'Billing not configured — add STRIPE_SECRET_KEY to .env' };
}

function init() {

  // ── Create checkout session + open in browser ───────────────────────────
  ipcMain.handle('billing:create-checkout', async (_e, { plan_key, customer_id }) => {
    if (!stripe) return _unavailable();
    const priceId = PRICES[plan_key];
    if (!priceId) {
      return {
        ok: false,
        error: `Price ID for "${plan_key}" not set. Add STRIPE_PRICE_${plan_key.toUpperCase()} to .env`,
      };
    }
    try {
      const isSubscription = plan_key !== 'pack';
      const params = {
        mode:                 isSubscription ? 'subscription' : 'payment',
        line_items:           [{ price: priceId, quantity: 1 }],
        automatic_tax:        { enabled: true },
        success_url:          `${SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:           CANCEL_URL,
        allow_promotion_codes: true,
      };
      if (customer_id) params.customer = customer_id;

      const session = await stripe.checkout.sessions.create(params);
      shell.openExternal(session.url);
      return { ok: true, session_id: session.id };
    } catch (err) {
      console.error('[billing] create-checkout:', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Poll checkout session to detect completed payment ───────────────────
  ipcMain.handle('billing:poll-checkout', async (_e, { session_id }) => {
    if (!stripe) return _unavailable();
    try {
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ['subscription', 'customer'],
      });
      return {
        ok:             true,
        payment_status: session.payment_status,
        status:         session.status,
        mode:           session.mode,
        subscription:   session.subscription
          ? {
              id:                 session.subscription.id || session.subscription,
              current_period_end: session.subscription.current_period_end,
              status:             session.subscription.status,
            }
          : null,
        customer_id: typeof session.customer === 'object'
          ? session.customer?.id
          : session.customer,
      };
    } catch (err) {
      console.error('[billing] poll-checkout:', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Sync subscription status ────────────────────────────────────────────
  ipcMain.handle('billing:sync-status', async (_e, { subscription_id }) => {
    if (!stripe) return _unavailable();
    try {
      const sub = await stripe.subscriptions.retrieve(subscription_id);
      return {
        ok:                   true,
        status:               sub.status,
        current_period_end:   sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        customer:             sub.customer,
      };
    } catch (err) {
      console.error('[billing] sync-status:', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Cancel subscription at period end ───────────────────────────────────
  ipcMain.handle('billing:cancel-subscription', async (_e, { subscription_id }) => {
    if (!stripe) return _unavailable();
    try {
      const sub = await stripe.subscriptions.update(subscription_id, {
        cancel_at_period_end: true,
      });
      return {
        ok:                   true,
        cancel_at_period_end: sub.cancel_at_period_end,
        current_period_end:   sub.current_period_end,
      };
    } catch (err) {
      console.error('[billing] cancel-subscription:', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Open Stripe customer portal ─────────────────────────────────────────
  ipcMain.handle('billing:customer-portal', async (_e, { customer_id }) => {
    if (!stripe) return _unavailable();
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer:   customer_id,
        return_url: SUCCESS_URL,
      });
      shell.openExternal(session.url);
      return { ok: true };
    } catch (err) {
      console.error('[billing] customer-portal:', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Verify + parse an incoming webhook event ────────────────────────────
  // Designed to be called from a future server-side forwarding endpoint.
  // Supported events: checkout.session.completed, customer.subscription.updated,
  //   customer.subscription.deleted, invoice.payment_failed
  ipcMain.handle('billing:process-webhook', async (_e, { payload, signature }) => {
    if (!stripe) return _unavailable();
    if (!WEBHOOK_SECRET) return { ok: false, error: 'STRIPE_WEBHOOK_SECRET not configured' };
    try {
      const event = stripe.webhooks.constructEvent(payload, signature, WEBHOOK_SECRET);
      return { ok: true, type: event.type, data: event.data.object };
    } catch (err) {
      console.error('[billing] webhook verify:', err.message);
      return { ok: false, error: err.message };
    }
  });
}

module.exports = { init };
