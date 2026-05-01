const Anthropic = require('@anthropic-ai/sdk');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[claude] ANTHROPIC_API_KEY not set in .env');
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FEEDBACK_SYSTEM =
  'You are an expert SDR interview coach. Analyze this interview transcript and give the candidate structured, specific feedback. ' +
  'Reference actual things said — no generic advice. Use exactly this format:\n\n' +
  '**What You Did Well**\n• [specific strength from the transcript]\n• [specific strength]\n• [specific strength]\n\n' +
  '**What to Improve**\n• [specific weakness with actionable fix]\n• [specific weakness with actionable fix]\n• [specific weakness with actionable fix]\n\n' +
  '**For Your Next Interview**\n• [concrete actionable tip]\n• [concrete actionable tip]\n• [concrete actionable tip]';

const SYSTEM = {
  teleprompter:
    'You are an expert SDR interview coach giving real-time spoken coaching to a candidate mid-interview. ' +
    'Respond in 2-3 clear, direct sentences the candidate can read aloud as they speak. ' +
    'Be concrete, confident, and specific. No bullets, no markdown, no intro phrases like "Great question".',

  bullets:
    'You are an expert SDR interview coach giving structured talking points to a candidate mid-interview. ' +
    'Respond with exactly 3-4 bullet points. Format each bullet as "• text" on its own line. ' +
    'No intro sentence, no outro, no markdown other than the • character. ' +
    'Each bullet should be one punchy sentence a candidate can say aloud.',
};

/**
 * Stream a Claude answer for the given question.
 *
 * @param {string} question
 * @param {'teleprompter'|'bullets'} mode
 * @param {(token: string) => void} onToken - called for every streaming text delta
 * @returns {Promise<string>} full response text
 */
async function streamAnswer(question, mode, onToken) {
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: SYSTEM[mode] || SYSTEM.teleprompter,
    messages: [{ role: 'user', content: question }],
  });

  let fullText = '';

  stream.on('text', (text) => {
    fullText += text;
    onToken(text);
  });

  await stream.finalMessage();
  return fullText;
}

async function streamFeedback(transcript, onToken) {
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 800,
    system: FEEDBACK_SYSTEM,
    messages: [{ role: 'user', content: `Interview transcript:\n\n${transcript}` }],
  });

  let fullText = '';
  stream.on('text', (text) => {
    fullText += text;
    onToken(text);
  });

  await stream.finalMessage();
  return fullText;
}

module.exports = { streamAnswer, streamFeedback };
