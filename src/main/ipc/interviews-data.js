const { ipcMain } = require('electron');
const Anthropic = require('@anthropic-ai/sdk');

async function apolloSearch(query) {
  const res = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`Company search ${res.status}`);
  const companies = await res.json();
  const logoKey = process.env.LOGO_DEV_API_KEY || '';
  const organizations = companies.slice(0, 8).map(c => ({
    id: c.domain,
    name: c.name,
    primary_domain: c.domain,
    logo_url: c.domain ? `https://img.logo.dev/${c.domain}?token=${logoKey}` : null,
  }));
  return { organizations };
}

async function proxycurlFetch(linkedinUrl) {
  const apiKey = process.env.PROXYCURL_API_KEY;
  if (!apiKey) throw new Error('No Proxycurl API key configured');

  const url = `https://nubela.co/proxycurl/api/v2/linkedin?linkedin_profile_url=${encodeURIComponent(linkedinUrl)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`Proxycurl ${res.status}`);
  const data = await res.json();

  const normalised = {
    first_name: data.first_name || '',
    last_name:  data.last_name  || '',
    occupation: data.occupation || '',
    profile_pic_url: data.profile_pic_url || null,
  };

  return { data: normalised };
}

async function apolloEnrich(domain) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error('No Apollo API key');
  const res = await fetch('https://api.apollo.io/v1/organizations/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({ domain }),
  });
  if (!res.ok) throw new Error(`Apollo enrich ${res.status}`);
  const data = await res.json();
  return data.organization || null;
}

async function apolloPeople(domain) {
  const apiKey = process.env.APOLLO_API_KEY;
  if (!apiKey) throw new Error('No Apollo API key');
  const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
    body: JSON.stringify({ organization_domains: [domain], page: 1, per_page: 6 }),
  });
  if (!res.ok) throw new Error(`Apollo people ${res.status}`);
  const data = await res.json();
  return data.people || [];
}

async function newsFetch(query) {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) throw new Error('No News API key');
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=6&apiKey=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NewsAPI ${res.status}`);
  const data = await res.json();
  return data.articles || [];
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

  ipcMain.handle('apollo:enrich', async (_e, { domain }) => {
    try { return { ok: true, data: await apolloEnrich(domain) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('apollo:people', async (_e, { domain }) => {
    try { return { ok: true, data: await apolloPeople(domain) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle('news:fetch', async (_e, { query }) => {
    try { return { ok: true, data: await newsFetch(query) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
}

module.exports = { init };
