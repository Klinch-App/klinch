// Deploy: supabase functions deploy stripe-webhook
// Stripe webhook URL: https://vmwhggpnrldnugsjdigh.supabase.co/functions/v1/stripe-webhook
// Required Supabase secrets (supabase secrets set KEY=VALUE):
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_FIVEPACK

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe          from 'https://esm.sh/stripe@14?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion:  '2024-04-10',
  httpClient:  Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const WEBHOOK_SECRET  = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const FIVEPACK_PRICE  = Deno.env.get('STRIPE_PRICE_FIVEPACK')!;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const body = await req.text();
  const sig  = req.headers.get('stripe-signature') ?? '';

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed:', err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Only process completed checkouts
  if (event.type !== 'checkout.session.completed') {
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = event.data.object as Stripe.Checkout.Session;

  // Verify this is a fivepack purchase
  try {
    const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
    const isFivepack = items.data.some(item => item.price?.id === FIVEPACK_PRICE);
    if (!isFivepack) {
      return new Response(JSON.stringify({ received: true, skipped: 'not fivepack' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    console.error('[stripe-webhook] listLineItems failed:', err.message);
    return new Response('Internal error', { status: 500 });
  }

  const customerId = typeof session.customer === 'string'
    ? session.customer
    : (session.customer as Stripe.Customer)?.id ?? null;

  if (!customerId) {
    console.error('[stripe-webhook] no customer ID on session', session.id);
    return new Response('Missing customer', { status: 400 });
  }

  // Look up the user by Stripe customer ID
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, credits, plan, fivepack_expires_at')
    .eq('stripe_customer_id', customerId)
    .single();

  if (profileErr || !profile) {
    // Could be a new customer — try to match by email from the session
    const customerEmail = session.customer_details?.email ?? session.customer_email;
    if (!customerEmail) {
      console.error('[stripe-webhook] profile not found for customer', customerId);
      return new Response('Profile not found', { status: 404 });
    }
    const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1 });
    // Narrow by email via direct query on auth.users using service role
    const { data: byEmail } = await supabase
      .from('profiles')
      .select('id, credits, plan, fivepack_expires_at')
      .eq('email', customerEmail)
      .maybeSingle();
    if (!byEmail) {
      console.error('[stripe-webhook] no profile for email', customerEmail);
      return new Response('Profile not found', { status: 404 });
    }
    Object.assign(profile ?? {}, byEmail);
  }

  // Expiry: 30 days from now (or extend existing if still active)
  const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  // Credits: add 5 to any existing balance (don't reset)
  const currentCredits = typeof profile.credits === 'number' ? profile.credits : 0;
  const newCredits = Math.max(currentCredits, 0) + 5;

  // Plan: only set to pay_per_use if they have no subscription plan
  const isSubscriber = profile.plan === 'starter' || profile.plan === 'unlimited';
  const newPlan = isSubscriber ? profile.plan : 'pay_per_use';

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({
      credits:             newCredits,
      fivepack_expires_at: newExpiry,
      plan:                newPlan,
    })
    .eq('id', profile.id);

  if (updateErr) {
    console.error('[stripe-webhook] profile update failed:', updateErr.message);
    return new Response('Update failed', { status: 500 });
  }

  console.log(`[stripe-webhook] fivepack applied — user=${profile.id} credits=${newCredits} expires=${newExpiry}`);
  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
