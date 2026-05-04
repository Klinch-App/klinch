const { ipcMain } = require('electron');
const path      = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Claude helpers ─────────────────────────────────────────────────────────────

async function analyzeResume(rawText) {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: 'You are an expert SDR resume coach and ATS specialist. Return ONLY valid JSON — no markdown, no code fences, no explanation.',
    messages: [{
      role: 'user',
      content: `Analyze this resume for an SDR (Sales Development Representative) role.
Return ONLY valid JSON matching this schema exactly:
{"overall_score":<0-100>,"dimensions":{"impact":<0-100>,"clarity":<0-100>,"ats_compatibility":<0-100>,"sdr_relevance":<0-100>},"highlights":[{"id":"h1","original":"<exact quote from resume>","reason":"<why it's weak>"}],"ats_tips":["<specific actionable tip>"]}

Rules:
- Include 3-6 highlights. Each must quote an actual line from the resume.
- Include 3-6 ATS tips. Must be specific, not generic ("Use % figures" not "Add metrics").
- Reasons must explain concretely why the line is weak for SDR roles.

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

async function rewriteHighlight(original, reason, rawText) {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 200,
    system: 'You are an expert SDR resume coach. Return only the rewritten resume line — no explanation, no quotes, no preamble.',
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

async function roleFitAnalysis(rawText, jdRaw, roleTitle) {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1000,
    system: 'You are an expert recruiter and ATS specialist. Return ONLY valid JSON — no markdown, no code fences.',
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

  ipcMain.handle('claude:resume-analyze', async (_e, { raw_text }) => {
    try {
      const data = await analyzeResume(raw_text);
      return { ok: true, data };
    } catch (err) {
      console.error('[claude:resume-analyze]', err.message);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('claude:resume-rewrite', async (_e, { original, reason, raw_text }) => {
    try {
      const text = await rewriteHighlight(original, reason, raw_text);
      return { ok: true, text };
    } catch (err) {
      console.error('[claude:resume-rewrite]', err.message);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('claude:role-fit', async (_e, { raw_text, jd_raw, role_title }) => {
    try {
      const data = await roleFitAnalysis(raw_text, jd_raw, role_title);
      return { ok: true, data };
    } catch (err) {
      console.error('[claude:role-fit]', err.message);
      return { ok: false, error: err.message };
    }
  });

  // General claude:coach handler (used by Interview Detail page and Dry Run)
  ipcMain.handle('claude:coach', async (_e, { model, max_tokens, messages, system }) => {
    try {
      const params = { model, max_tokens, messages };
      if (system) params.system = system;
      const result = await client.messages.create(params);
      return result;
    } catch (err) {
      console.error('[claude:coach]', err.message);
      return { content: [{ type: 'text', text: `Error: ${err.message}` }] };
    }
  });
}

module.exports = { init };
