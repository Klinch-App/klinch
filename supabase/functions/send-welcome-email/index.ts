// Deploy: supabase functions deploy send-welcome-email
// Wire up: Supabase Dashboard → Authentication → Hooks → "Send email" hook
//   OR: Database → Webhooks → auth.users INSERT → this function URL
//
// Required Supabase secret (supabase secrets set RESEND_API_KEY=...):
//   RESEND_API_KEY

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const FROM           = 'hello@tryklinch.com';
const SUBJECT        = 'Welcome to Klinch 👋';

const BODY_HTML = `
<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">
  <p>Hey,</p>
  <p>Really glad you're here.</p>
  <p>Klinch was built for one reason — to help SaaS job seekers walk into interviews prepared and walk out with offers.</p>
  <p>To get the most out of it:</p>
  <ul style="padding-left:20px;margin:0 0 16px">
    <li style="margin:0 0 6px">Add your first interview</li>
    <li style="margin:0 0 6px">Upload your resume</li>
    <li style="margin:0 0 6px">Run a Dry Run before you go live</li>
  </ul>
  <p>You've got 3 free Klinch Ear sessions to start. Use them.</p>
  <p>If you ever have questions or feedback, just reply to this email. I read every one.</p>
  <p>Good luck out there.</p>
  <p>— Sean</p>
</div>`;

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let email: string | null = null;

  try {
    const body = await req.json();
    // Database webhook payload: { type: 'INSERT', record: { email: '...' }, ... }
    // Auth hook payload: { user: { email: '...' }, ... } or { record: { email: '...' } }
    email =
      body?.record?.email ??
      body?.user?.email   ??
      body?.email         ??
      null;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  if (!email) {
    console.error('[send-welcome-email] no email in payload');
    return new Response('Missing email', { status: 400 });
  }

  if (!RESEND_API_KEY) {
    console.error('[send-welcome-email] RESEND_API_KEY not set');
    return new Response('Email service not configured', { status: 500 });
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    FROM,
        to:      [email],
        subject: SUBJECT,
        html:    BODY_HTML,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('[send-welcome-email] Resend error:', res.status, text);
      return new Response('Email send failed', { status: 500 });
    }

    console.log(`[send-welcome-email] sent to ${email}`);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[send-welcome-email] fetch failed:', err.message);
    return new Response('Internal error', { status: 500 });
  }
});
