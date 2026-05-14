// Deploy: supabase functions deploy fivepack-expiry-check
// Schedule via Supabase Dashboard → Database → Cron (pg_cron), or add the SQL below.
// Runs daily at 10:00 UTC.
//
// Required Supabase secrets:
//   RESEND_API_KEY, FIVEPACK_PAYMENT_LINK (Stripe Payment Link URL for STRIPE_PRICE_FIVEPACK)
//
// pg_cron setup (run once in Supabase SQL editor — replace <SERVICE_ROLE_KEY>):
//   select cron.schedule(
//     'fivepack-expiry-check',
//     '0 10 * * *',
//     $$ select net.http_post(
//          url    := 'https://vmwhggpnrldnugsjdigh.supabase.co/functions/v1/fivepack-expiry-check',
//          headers := jsonb_build_object(
//            'Content-Type',  'application/json',
//            'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
//          ),
//          body   := '{}'
//        ) as request_id; $$
//   );

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const RESEND_API_KEY      = Deno.env.get('RESEND_API_KEY')!;
const PAYMENT_LINK        = Deno.env.get('FIVEPACK_PAYMENT_LINK') ?? 'https://tryklinch.com/billing';
const FROM_ADDRESS        = 'Klinch <noreply@tryklinch.com>';
const PRICING_URL         = 'https://tryklinch.com/pricing';

// ── Email templates ──────────────────────────────────────────────────────────

const WARNINGS: { days: number; subject: string; headline: string; body: string }[] = [
  {
    days: 7,
    subject: 'Your Klinch access expires in 7 days — renew to keep going',
    headline: 'Your access expires in 7 days',
    body: 'Keep your interview momentum going. Renew your 5-Pack before it expires and your session credits are locked.',
  },
  {
    days: 3,
    subject: '3 days left on your Klinch access',
    headline: '3 days left on your Klinch access',
    body: 'Don\'t lose access. Renew your 5-Pack now to keep your sessions and all your interview prep tools.',
  },
  {
    days: 1,
    subject: 'Last day — your Klinch access expires tomorrow',
    headline: 'Your access expires tomorrow',
    body: 'This is your last chance to renew. After tomorrow, your remaining session credits will be locked until you renew.',
  },
];

function buildEmailHtml(headline: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0eff5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
    <div style="background:linear-gradient(135deg,#7C3AFF 0%,#DC3CA0 100%);padding:28px 32px">
      <div style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">Klinch</div>
    </div>
    <div style="padding:36px 32px 28px">
      <h2 style="margin:0 0 14px;font-size:21px;font-weight:700;color:#0f0d28;letter-spacing:-0.3px;line-height:1.3">${headline}</h2>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.65;color:#4a4870">${body}</p>
      <a href="${PAYMENT_LINK}"
         style="display:inline-block;background:#7C3AFF;color:#ffffff;font-weight:700;font-size:14px;padding:14px 30px;border-radius:8px;text-decoration:none;letter-spacing:-0.1px">
        Renew 5-Pack →
      </a>
      <p style="margin:24px 0 0;font-size:13px;color:#9997b3;line-height:1.5">
        Or switch to a monthly plan for uninterrupted access —
        <a href="${PRICING_URL}" style="color:#7C3AFF;text-decoration:none;font-weight:600">view plans →</a>
      </p>
    </div>
    <div style="padding:18px 32px;border-top:1px solid #f0eff5">
      <p style="margin:0;font-size:12px;color:#c0bdd8">
        You're receiving this because you have an active Klinch 5-Pack.
        <a href="https://tryklinch.com" style="color:#7C3AFF;text-decoration:none">tryklinch.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ from: FROM_ADDRESS, to: [to], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend ${res.status}: ${text}`);
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  const now   = new Date();
  const stats = { checked: 0, sent: 0, errors: [] as string[] };

  for (const warning of WARNINGS) {
    // Window: users whose fivepack_expires_at falls exactly `days` days from now
    // (any time on that calendar day UTC). Running daily, this means each
    // user is emailed at most once per warning threshold per expiry cycle.
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() + warning.days);
    windowStart.setUTCHours(0, 0, 0, 0);

    const windowEnd = new Date(windowStart);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, credits, plan')
      .gte('fivepack_expires_at', windowStart.toISOString())
      .lt('fivepack_expires_at',  windowEnd.toISOString())
      .not('plan', 'in', '("starter","unlimited")')  // skip active subscribers
      .gt('credits', 0);                              // skip users with no sessions left

    if (error) {
      console.error(`[fivepack-expiry-check] DB error for ${warning.days}d window:`, error.message);
      stats.errors.push(`${warning.days}d: ${error.message}`);
      continue;
    }

    for (const profile of profiles ?? []) {
      stats.checked++;
      try {
        const { data: { user }, error: userErr } = await supabase.auth.admin.getUserById(profile.id);
        if (userErr || !user?.email) {
          console.warn('[fivepack-expiry-check] no email for user', profile.id);
          continue;
        }
        const html = buildEmailHtml(warning.headline, warning.body);
        await sendEmail(user.email, warning.subject, html);
        stats.sent++;
        console.log(`[fivepack-expiry-check] ${warning.days}d warning sent to ${user.email}`);
      } catch (err) {
        const msg = `user ${profile.id}: ${err.message}`;
        console.error('[fivepack-expiry-check]', msg);
        stats.errors.push(msg);
      }
    }
  }

  console.log(`[fivepack-expiry-check] done — checked=${stats.checked} sent=${stats.sent} errors=${stats.errors.length}`);
  return new Response(JSON.stringify(stats), {
    headers: { 'Content-Type': 'application/json' },
  });
});
