#!/usr/bin/env node
// Reads environment variables and writes src/main/build-config.js before electron-builder runs.
// Called automatically by the release:mac / release:win / build npm scripts.
// The output file is .gitignore'd — never commit it.
//
// Required env vars for a production release build:
//   ANTHROPIC_API_KEY       Claude API key
//   DEEPGRAM_API_KEY        Deepgram speech-to-text key
//   LOGO_DEV_API_KEY        Logo.dev key (company logos)
//   APOLLO_API_KEY          Apollo.io key (contact enrichment)
//   PROXYCURL_API_KEY       Proxycurl key (LinkedIn enrichment)
//   NEWS_API_KEY            NewsAPI key
//   SUPABASE_URL            Supabase project URL
//   SUPABASE_ANON_KEY       Supabase publishable anon key
//   SUPABASE_SERVICE_ROLE_KEY  Supabase service-role JWT (server-side writes)
//   STRIPE_SECRET_KEY       Stripe secret key
//   STRIPE_PRICE_STARTER    Stripe price ID for Starter plan
//   STRIPE_PRICE_UNLIMITED  Stripe price ID for Unlimited plan
//   STRIPE_PRICE_FIVEPACK   Stripe price ID for 5-session pack
//   STRIPE_PRICE_PACK       Stripe price ID for legacy one-time pack
//   STRIPE_WEBHOOK_SECRET   Stripe webhook signing secret
//   GOOGLE_CLIENT_ID        Google OAuth client ID
//   GOOGLE_CLIENT_SECRET    Google OAuth client secret
//   DEV_PASSWORD            Internal dev-unlock password
//   RESEND_API_KEY          Resend transactional email API key
//
// NOT included here (used only by electron-builder itself during publishing, never by the app):
//   GH_TOKEN                GitHub PAT for electron-builder publish step

'use strict';

const fs   = require('fs');
const path = require('path');

const RUNTIME_KEYS = [
  'ANTHROPIC_API_KEY',
  'DEEPGRAM_API_KEY',
  'LOGO_DEV_API_KEY',
  'APOLLO_API_KEY',
  'PROXYCURL_API_KEY',
  'NEWS_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_PRICE_STARTER',
  'STRIPE_PRICE_UNLIMITED',
  'STRIPE_PRICE_FIVEPACK',
  'STRIPE_PRICE_PACK',
  'STRIPE_WEBHOOK_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'DEV_PASSWORD',
  'RESEND_API_KEY',
];

const missing = RUNTIME_KEYS.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.warn('[generate-build-config] WARNING — missing env vars (will be absent in build):');
  missing.forEach(k => console.warn('  ', k));
}

const config = {};
for (const key of RUNTIME_KEYS) {
  if (process.env[key] !== undefined) config[key] = process.env[key];
}

const outPath = path.join(__dirname, '../src/main/build-config.js');
fs.writeFileSync(
  outPath,
  `// Auto-generated at build time by scripts/generate-build-config.js — do not commit.\nmodule.exports = ${JSON.stringify(config, null, 2)};\n`
);
console.log('[generate-build-config] Written:', outPath);
