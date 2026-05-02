const { ipcMain, app } = require('electron');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

let _cacheFile = null;

function cacheFile() {
  if (!_cacheFile) _cacheFile = path.join(app.getPath('userData'), 'proxycurl-cache.json');
  return _cacheFile;
}

function loadCache() {
  try { return JSON.parse(fs.readFileSync(cacheFile(), 'utf8')); } catch { return {}; }
}

function saveCache(cache) {
  try { fs.writeFileSync(cacheFile(), JSON.stringify(cache, null, 2)); } catch (err) {
    console.error('proxycurl cache write failed:', err.message);
  }
}

async function apolloSearch(query) {
  const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Clearbit ${res.status}`);
  const companies = await res.json();
  // Normalise to the shape the renderer expects
  const organizations = companies.slice(0, 8).map(c => ({
    id: c.domain,
    name: c.name,
    primary_domain: c.domain,
    logo_url: c.domain ? `https://www.google.com/s2/favicons?domain=${c.domain}&sz=64` : null,
  }));
  return { organizations };
}

async function proxycurlFetch(linkedinUrl) {
  const cache = loadCache();
  const key = linkedinUrl.toLowerCase().replace(/\/+$/, '');
  if (cache[key]) return { data: cache[key], cached: true };

  // NinjaPear API (formerly Proxycurl) — requires a key from nubela.co
  const apiKey = process.env.PROXYCURL_API_KEY || process.env.NINJAPEAR_API_KEY;
  if (!apiKey) throw new Error('No NinjaPear/Proxycurl API key configured');

  const url = `https://nubela.co/api/v1/employee/profile?linkedin_url=${encodeURIComponent(linkedinUrl)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`NinjaPear ${res.status}`);
  const data = await res.json();

  // NinjaPear response shape: { first_name, last_name, headline, photo_url, ... }
  // Normalise to the fields our UI expects
  const normalised = {
    first_name: data.first_name || data.firstName || '',
    last_name:  data.last_name  || data.lastName  || '',
    occupation: data.headline   || data.title      || data.occupation || '',
    profile_pic_url: data.photo_url || data.profile_pic_url || data.photoUrl || null,
  };

  if (normalised.first_name) { cache[key] = normalised; saveCache(cache); }
  return { data: normalised, cached: false };
}

async function processJd(jdText) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Extract and structure this job description into JSON. Return ONLY valid JSON with no markdown.

Schema: {"role_title":"string","responsibilities":["string"],"must_have":["string"],"nice_to_have":["string"],"location":"string or null","salary":"string or null"}

Job Description:
${jdText}`,
    }],
  });
  return JSON.parse(msg.content[0].text.trim());
}

function init() {
  ipcMain.handle('apollo:search', async (_e, { query }) => {
    try { return { ok: true, data: await apolloSearch(query) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('proxycurl:fetch', async (_e, { linkedin_url }) => {
    try { return { ok: true, ...(await proxycurlFetch(linkedin_url)) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('claude:process-jd', async (_e, { jd_text }) => {
    try { return { ok: true, data: await processJd(jd_text) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
}

module.exports = { init };
