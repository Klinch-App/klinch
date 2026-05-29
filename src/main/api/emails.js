'use strict';

const { Resend } = require('resend');

const FROM = 'hello@tryklinch.com';

function _client() {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function _purchaseHtml(planLabel, bullets) {
  const items = bullets.map(b => `<li style="margin:0 0 6px">${b}</li>`).join('');
  return `
<div style="font-family:sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px">
  <p>Hey,</p>
  <p>Your ${planLabel} plan is active.</p>
  <p>Here's what you've got:</p>
  <ul style="padding-left:20px;margin:0 0 16px">${items}</ul>
  <p>That's it. Go land the job.</p>
  <p>— Sean</p>
</div>`;
}

const PLAN_COPY = {
  starter: {
    subject: "You're all set 🎉",
    label:   'Starter',
    bullets: [
      '10 Klinch Ear sessions/month',
      '10 Dry Runs/month',
      'Company Intel',
      'Resume Coach',
      'Unlimited interview and application tracking',
      'Email support',
    ],
  },
  unlimited: {
    subject: "You're all set 🎉",
    label:   'Unlimited',
    bullets: [
      'Unlimited Klinch Ear sessions',
      'Unlimited Dry Runs',
      'Company Intel',
      'Resume Coach',
      'Unlimited interview and application tracking',
      'Email support',
      'Early access to new features',
    ],
  },
};

const WELCOME_HTML = `
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

async function sendWelcome(toEmail) {
  const resend = _client();
  if (!resend) {
    console.warn('[emails] RESEND_API_KEY not set — welcome email skipped');
    return;
  }
  try {
    await resend.emails.send({
      from:    FROM,
      to:      toEmail,
      subject: 'Welcome to Klinch 👋',
      html:    WELCOME_HTML,
    });
  } catch (err) {
    console.error('[emails] sendWelcome failed:', err.message);
  }
}

async function sendPurchaseConfirmation(toEmail, planKey) {
  const copy = PLAN_COPY[planKey];
  if (!copy) return; // pack/fivepack — no confirmation email
  const resend = _client();
  if (!resend) {
    console.warn('[emails] RESEND_API_KEY not set — purchase email skipped');
    return;
  }
  try {
    await resend.emails.send({
      from:    FROM,
      to:      toEmail,
      subject: copy.subject,
      html:    _purchaseHtml(copy.label, copy.bullets),
    });
  } catch (err) {
    console.error('[emails] sendPurchaseConfirmation failed:', err.message);
  }
}

module.exports = { sendWelcome, sendPurchaseConfirmation };
