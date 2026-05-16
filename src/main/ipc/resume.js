const { ipcMain } = require('electron');
const path      = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Claude helpers ─────────────────────────────────────────────────────────────

const ROLE_DIM_KEY = {
  'SDR': 'sdr_relevance', 'AE': 'ae_relevance', 'CSM': 'csm_relevance',
  'AM': 'am_relevance', 'SE': 'se_relevance', 'RevOps': 'revops_relevance',
  'Marketing': 'marketing_relevance', 'Partnerships': 'partnerships_relevance',
  'Enablement': 'enablement_relevance', 'People': 'people_relevance',
};

async function analyzeResume(rawText, profileCtx, roleType = 'SDR') {
  const roleDimKey = ROLE_DIM_KEY[roleType] || 'sdr_relevance';
  const baseSystem = `You are an expert ${roleType} resume coach and ATS specialist. Return ONLY valid JSON — no markdown, no code fences, no explanation.`;
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2500,
    system: profileCtx ? profileCtx + '\n\n' + baseSystem : baseSystem,
    messages: [{
      role: 'user',
      content: `Analyze this resume for a ${roleType} role.
Return ONLY valid JSON matching this schema exactly:
{"overall_score":<0-100>,"dimensions":{"impact":<0-100>,"clarity":<0-100>,"ats_compatibility":<0-100>,"${roleDimKey}":<0-100>,"ai_fluency":<0-100>},"ai_fluency_callouts":["<specific missing element>"],"annotations":[{"id":"h1","quote":"<exact verbatim substring>","comment":"<specific feedback>","severity":"high|medium"}],"ats_tips":["<specific actionable tip>"]}

Rules:
- overall_score: weighted average of all 5 dimensions (impact 25%, clarity 20%, ats_compatibility 20%, ${roleDimKey} 20%, ai_fluency 15%).
- ai_fluency (0–100): Score on three signals:
  1. Specific AI tools named (Claude, ChatGPT, Gemini, Copilot, Gong AI, Clay, Apollo AI, Orum, Salesloft AI, etc.) — 0 points if none.
  2. AI-driven outcomes with measurable metrics (e.g. "used Clay to build 200 prospect lists, cutting research time 60%") — 0 points if no quantified results.
  3. AI-native language and forward-looking framing ("automated", "AI-assisted", "prompt engineering", "LLM workflows") — partial credit.
  Bands: 0–30 = no AI signals; 31–60 = vague mention, no specifics; 61–85 = tools named, outcomes missing; 86–100 = tools + quantified outcomes + forward-looking language.
- ai_fluency_callouts: If ai_fluency < 70, include 1–2 callouts telling the candidate exactly what is missing (e.g. "No AI tools are mentioned — name specific tools like Claude, ChatGPT, or Gemini", "AI outcomes lack metrics — add a line like 'used AI prospecting tools to reduce list-building time by 40%'"). If ai_fluency >= 70, return [].
- Include 5-8 annotations. Each "quote" must be copied character-for-character from the resume text below — it will be used to find and highlight the exact phrase. Do not paraphrase or summarise.
- severity: "high" for major issues that significantly hurt the resume, "medium" for minor improvements.
- Comments must be specific and actionable for ${roleType} roles, not generic.
- Include 3-5 ATS tips specific to this resume, not generic advice.

Resume:
${rawText}`,
    }],
  });
  const text = msg.content[0].text.trim()
    .replace(/^```json\s*/,  '')
    .replace(/^```\s*/,      '')
    .replace(/\s*```$/,      '');
  return JSON.parse(text);
}

async function rewriteHighlight(original, reason, rawText, profileCtx) {
  const baseSystem = 'You are an expert SDR resume coach. Return only the rewritten resume line — no explanation, no quotes, no preamble.';
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: profileCtx ? profileCtx + '\n\n' + baseSystem : baseSystem,
    messages: [{
      role: 'user',
      content: `Rewrite this resume line to be stronger for an SDR role.
Original: "${original}"
Issue: ${reason}
Resume context: ${rawText.slice(0, 800)}`,
    }],
  });
  return msg.content[0].text.trim();
}

async function roleFitAnalysis(rawText, jdRaw, roleTitle, profileCtx) {
  const baseSystem = 'You are an expert recruiter and ATS specialist. Return ONLY valid JSON — no markdown, no code fences.';
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: profileCtx ? profileCtx + '\n\n' + baseSystem : baseSystem,
    messages: [{
      role: 'user',
      content: `Analyze how well this resume fits the job description.
Return ONLY valid JSON: {"keyword_match_score":<0-100>,"keywords_present":["keyword"],"keywords_missing":["keyword"],"talking_points":["short actionable tip"],"strategic_summary":"<2-3 sentences>"}

Rules:
- keywords_present: 3-5 matched strengths from the resume
- keywords_missing: 2-4 gaps the resume doesn't address
- talking_points: 2-3 short bullet points on how to position themselves in the interview
- strategic_summary: 2-3 sentence overall assessment

Role: ${roleTitle}
Job Description:
${jdRaw}

Resume:
${rawText}`,
    }],
  });
  const text = msg.content[0].text.trim()
    .replace(/^```json\s*/,  '')
    .replace(/^```\s*/,      '')
    .replace(/\s*```$/,      '');
  return JSON.parse(text);
}

// ── IPC registration ───────────────────────────────────────────────────────────

function init() {
  // Guard against double-registration (e.g. dev hot-reload)
  const channels = ['resume:parse','claude:resume-analyze','claude:resume-rewrite','claude:role-fit','claude:coach'];
  channels.forEach(ch => { try { ipcMain.removeHandler(ch); } catch (_) {} });
  console.log('[resume] registering IPC handlers:', channels.join(', '));

  ipcMain.handle('resume:parse', async (_e, { file_name, data }) => {
    try {
      const ext = path.extname(file_name).toLowerCase();
      const buf = Buffer.from(data);   // data is a plain number array from renderer
      let text;

      if (ext === '.pdf') {
        // pdf-parse v2 API: new PDFParse({ data: Buffer }).getText()
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buf });
        const result = await parser.getText();
        text = result.text.trim();
      } else if (ext === '.docx') {
        const mammoth = require('mammoth');
        const result  = await mammoth.extractRawText({ buffer: buf });
        text          = result.value.trim();
      } else {
        throw new Error(`Unsupported file type: ${ext}`);
      }

      if (!text) throw new Error('No text could be extracted — the file may be image-based or password protected.');
      console.log(`[resume:parse] success — ${text.length} chars from ${file_name}`);
      return { ok: true, text };
    } catch (err) {
      console.error('[resume:parse] ERROR:', err.message);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('claude:resume-analyze', async (_e, { raw_text, profile_context, role_type }) => {
    try {
      const data = await analyzeResume(raw_text, profile_context || '', role_type || 'SDR');
      return { ok: true, data };
    } catch (err) {
      console.error('[claude:resume-analyze]', err.message);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('claude:resume-rewrite', async (_e, { original, reason, raw_text, profile_context }) => {
    try {
      const text = await rewriteHighlight(original, reason, raw_text, profile_context || '');
      return { ok: true, text };
    } catch (err) {
      console.error('[claude:resume-rewrite]', err.message);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('claude:role-fit', async (_e, { raw_text, jd_raw, role_title, profile_context }) => {
    try {
      const data = await roleFitAnalysis(raw_text, jd_raw, role_title, profile_context || '');
      return { ok: true, data };
    } catch (err) {
      console.error('[claude:role-fit]', err.message);
      return { ok: false, error: err.message };
    }
  });

  // General claude:coach handler (used by Interview Detail page and Dry Run)
  ipcMain.handle('claude:coach', async (_e, { model, max_tokens, messages, system }) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const params = { model, max_tokens, messages };
      if (system) params.system = system;
      const result = await client.messages.create(params, { signal: controller.signal });
      clearTimeout(timer);
      return result;
    } catch (err) {
      clearTimeout(timer);
      console.error('[claude:coach]', err.message);
      return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
    }
  });
}

module.exports = { init };
