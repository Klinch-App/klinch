let stripe = null;

const key = process.env.STRIPE_SECRET_KEY;
if (key) {
  try {
    stripe = require('stripe')(key);
    console.log('[billing] Stripe initialized');
  } catch (err) {
    console.error('[billing] Stripe init failed:', err.message);
  }
} else {
  console.warn('[billing] STRIPE_SECRET_KEY not set — billing disabled until key is added to .env');
}

module.exports = { stripe };
