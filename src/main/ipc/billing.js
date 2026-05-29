'use strict';

const { ipcMain, shell } = require('electron');
const { stripe }         = require('../api/stripe');
const supabaseApi        = require('../api/supabase');
const emails             = require('../api/emails');

// Price IDs — create in Stripe Dashboard, then add to .env
const PRICES = {
  starter:   process.env.STRIPE_PRICE_STARTER   || null,
  unlimited: process.env.STRIPE_PRICE_UNLIMITED || null,
  // 30-day time-bounded 5-pack; webhook sets fivepack_expires_at in Supabase
  fivepack:  process.env.STRIPE_PRICE_FIVEPACK  || null,
  // Legacy one-time pack (no expiry); kept for backwards compatibility
  pack:      process.env.STRIPE_PRICE_PACK      || null,
};

const SUCCESS_URL    = 'https://tryklinch.com/billing/success';
const CANCEL_URL     = 'https://tryklinch.com/billing/cancel';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || null;

function _unavailable() {
  return { ok: false, error: 'Billing not configured — add STRIPE_SECRET_KEY to .env' };
}

// Get current Supabase session (user id + email)
async function _getSession() {
  const { supabase } = supabaseApi;
  if (!supabase) return { userId: null, email: null };
  try {
    const { data } = await supabase.auth.getSession();
    const user = data?.session?.user;
    return { userId: user?.id ?? null, email: user?.email ?? null };
  } catch { return { userId: null, email: null }; }
}

// Upsert billing fields into the profiles table
async function _saveBillingToProfile(userId, { plan, credits, stripe_customer_id, trial_started_at, fivepack_expires_at }) {
  const { supabase } = supabaseApi;
  if (!supabase || !userId) return;
  try {
    const row = { id: userId };
    if (plan                !== undefined) row.plan                = plan;
    if (credits             !== undefined) row.credits             = credits;
    if (stripe_customer_id  !== undefined) row.stripe_customer_id = stripe_customer_id;
    if (fivepack_expires_at !== undefined) row.fivepack_expires_at = fivepack_expires_at;
    // Only write trial_started_at if not already set in Supabase (preserve first-write semantics)
    if (trial_started_at    !== undefined && trial_started_at !== null) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('trial_started_at')
        .eq('id', userId)
        .single()
        .catch(() => ({ data: null }));
      if (!existing?.trial_started_at) row.trial_started_at = trial_started_at;
    }
    await supabase.from('profiles').upsert(row, { onConflict: 'id' });
  } catch (err) {
    console.error('[billing] profile upsert:', err.message);
  }
}

function init() {

  // ── Create checkout session + open in browser ───────────────────────────────
  ipcMain.handle('billing:create-checkout', async (_e, { plan_key, customer_id }) => {
    if (!stripe) return _unavailable();
    const priceId = PRICES[plan_key];
    if (!priceId) {
      return {
        ok:    false,
        error: `Price ID for "${plan_key}" not configured. Add STRIPE_PRICE_${plan_key.toUpperCase()} to .env`,
      };
    }
    try {
      const isSubscription = plan_key !== 'pack' && plan_key !== 'fivepack';
      const params = {
        mode:                  isSubscription ? 'subscription' : 'payment',
        line_items:            [{ price: priceId, quantity: 1 }],
        automatic_tax:         { enabled: true },
        success_url:           `${SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:            CANCEL_URL,
        allow_promotion_codes: true,
      };

      if (customer_id) {
        // Existing customer — attach to session
        params.customer = customer_id;
      } else {
        // New customer — pre-fill email from Supabase session
        const { email } = await _getSession();
        if (email) params.customer_email = email;
      }

      const session = await stripe.checkout.sessions.create(params);
      shell.openExternal(session.url);
      return { ok: true, session_id: session.id };
    } catch (err) {
      console.error('[billing] create-checkout:', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Poll checkout session to detect completed payment ───────────────────────
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
              id:                 session.subscription.id   || session.subscription,
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

  // ── Server-authoritative billing sync ──────────────────────────────────────
  // 1. Reads plan/credits/stripe_customer_id from Supabase profiles
  // 2. If a subscription_id is provided, verifies it against Stripe
  // 3. Writes back to Supabase if the subscription has lapsed
  // 4. Returns the merged authoritative billing state to the renderer
  ipcMain.handle('billing:sync-status', async (_e, { subscription_id, customer_id } = {}) => {
    const { userId } = await _getSession();

    // ── Step 1: Read Supabase profile ───────────────────────────────────────
    let profileBilling = null;
    const { supabase } = supabaseApi;
    if (supabase && userId) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('stripe_customer_id, plan, credits, trial_started_at, fivepack_expires_at')
          .eq('id', userId)
          .single();
        if (data) {
          profileBilling = data;
          // Prefer Supabase customer_id if the caller didn't supply one
          if (!customer_id && data.stripe_customer_id) customer_id = data.stripe_customer_id;
        }
      } catch { /* non-fatal */ }
    }

    // ── Step 2: Verify Stripe subscription ────────────────────────────────
    if (!stripe) {
      // No Stripe configured — return Supabase state only
      return {
        ok:                  true,
        stripe_customer_id:  profileBilling?.stripe_customer_id  ?? null,
        plan:                profileBilling?.plan                 ?? null,
        credits:             profileBilling?.credits              ?? null,
        trial_started_at:    profileBilling?.trial_started_at     ?? null,
        fivepack_expires_at: profileBilling?.fivepack_expires_at  ?? null,
      };
    }

    if (!subscription_id) {
      // No subscription to verify — return Supabase state
      return {
        ok:                  true,
        stripe_customer_id:  profileBilling?.stripe_customer_id  ?? null,
        plan:                profileBilling?.plan                 ?? null,
        credits:             profileBilling?.credits              ?? null,
        trial_started_at:    profileBilling?.trial_started_at     ?? null,
        fivepack_expires_at: profileBilling?.fivepack_expires_at  ?? null,
      };
    }

    try {
      const sub = await stripe.subscriptions.retrieve(subscription_id);

      // Subscription lapsed — downgrade in Supabase
      if ((sub.status === 'canceled' || sub.status === 'unpaid') && userId) {
        await _saveBillingToProfile(userId, { plan: 'free_trial', credits: 0 });
      }

      return {
        ok:                   true,
        status:               sub.status,
        current_period_end:   sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        customer:             sub.customer,
        // Supabase-authoritative fields
        stripe_customer_id:   profileBilling?.stripe_customer_id  ?? null,
        plan:                 profileBilling?.plan                 ?? null,
        credits:              profileBilling?.credits              ?? null,
        trial_started_at:     profileBilling?.trial_started_at     ?? null,
        fivepack_expires_at:  profileBilling?.fivepack_expires_at  ?? null,
      };
    } catch (err) {
      console.error('[billing] sync-status:', err.message);
      return { ok: false, error: err.message };
    }
  });

  // ── Fetch auth user's account creation date ────────────────────────────────
  ipcMain.handle('billing:get-user-created-at', async () => {
    const { supabase } = supabaseApi;
    if (!supabase) return { ok: true, created_at: null };
    try {
      const { data } = await supabase.auth.getUser();
      return { ok: true, created_at: data?.user?.created_at ?? null };
    } catch {
      return { ok: true, created_at: null };
    }
  });

  // ── Persist billing state to Supabase profiles ─────────────────────────────
  // Called by renderer after any successful checkout or credit change.
  ipcMain.handle('billing:sync-to-supabase', async (_e, { plan, credits, stripe_customer_id, trial_started_at, fivepack_expires_at }) => {
    const { userId } = await _getSession();
    if (!userId) return { ok: true }; // no session — skip silently
    await _saveBillingToProfile(userId, { plan, credits, stripe_customer_id, trial_started_at, fivepack_expires_at });
    return { ok: true };
  });

  // ── Cancel subscription at period end ───────────────────────────────────────
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

  // ── Open Stripe customer portal ─────────────────────────────────────────────
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

  // ── Send purchase confirmation email ───────────────────────────────────────
  ipcMain.handle('billing:send-purchase-email', async (_e, { plan_key }) => {
    try {
      const { email } = await _getSession();
      if (email) await emails.sendPurchaseConfirmation(email, plan_key);
    } catch (err) {
      console.error('[billing] send-purchase-email:', err.message);
    }
    return { ok: true };
  });

  // ── Verify + parse an incoming webhook event ────────────────────────────────
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
