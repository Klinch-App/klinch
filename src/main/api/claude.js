const Anthropic = require('@anthropic-ai/sdk');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('[claude] ANTHROPIC_API_KEY not set in .env');
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FEEDBACK_SYSTEM =
  'You are a direct, experienced interview coach reviewing a candidate\'s responses from a job interview. ' +
  'You only have the candidate\'s words — infer what questions were likely asked from how they answered. ' +
  'Write in second person, addressing the candidate directly as "you" throughout (e.g., "you said", "you did", "your answers"). ' +
  'Evaluate across five areas: answer structure and quality, filler words and delivery patterns (quote specific ones if present), ' +
  'answer length (flag responses that were too long, too short, or both), confidence and clarity, and overall impression. ' +
  'End with exactly 2-3 specific improvements you should make in your next interview, grounded in what you actually heard. ' +
  'Be honest and direct — vague praise is useless. Do not mention missing audio, recording limitations, or what you could not hear. ' +
  'Use exactly this format:\n\n' +
  '**Answer Quality**\n[2-3 sentences on structure, relevance, and substance of your answers]\n\n' +
  '**Delivery**\n[Filler words you used, pace, confidence — quote specific phrases if warranted]\n\n' +
  '**Answer Length**\n[Were your answers appropriately sized? Which ran long or short?]\n\n' +
  '**Clarity & Confidence**\n[How clearly did you communicate? Did you sound certain or hesitant?]\n\n' +
  '**Top Improvements**\n• [specific, actionable change]\n• [specific, actionable change]\n• [specific, actionable change — omit if only 2 apply]';


const COACHING_SYSTEM =
  'You are a live interview delivery coach. The candidate just said these words. ' +
  'If there is ONE clear delivery issue — filler words (um, uh, like, you know, literally, basically), ' +
  'rambling or over-explaining, a very short answer, or a good moment to pause — respond with a single ' +
  'coaching cue of 6 words or fewer that they can act on immediately. ' +
  'Examples: "Slow down", "Cut the fillers", "Wrap it up", "Pause and breathe", "More detail here", "Look at the camera". ' +
  'If delivery is fine, respond with exactly: NONE';

const INFER_QUESTIONS_SYSTEM =
  'You are an interview analyst. Given a candidate\'s spoken answers from a job interview, ' +
  'infer the most likely question that prompted each answer. ' +
  'Strip all personally identifiable information: replace real names with generic terms ' +
  '(e.g. "my manager", "a prospect", "the company"), and remove any email addresses, phone numbers, or locations. ' +
  'Return ONLY a valid JSON array of question strings — no preamble, no markdown, no code fences. ' +
  'Maximum 10 questions.';

async function inferQuestions(transcript) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 600,
    system: INFER_QUESTIONS_SYSTEM,
    messages: [{ role: 'user', content: transcript }],
  });
  const text    = response.content[0]?.text?.trim() || '';
  const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  try {
    const questions = JSON.parse(cleaned);
    if (!Array.isArray(questions)) return [];
    return questions.filter(q => typeof q === 'string' && q.trim()).slice(0, 10);
  } catch {
    return [];
  }
}

async function getCoachingCue(transcript) {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 20,
    system: COACHING_SYSTEM,
    messages: [{ role: 'user', content: transcript }],
  });
  const text = response.content[0]?.text?.trim() || '';
  return text === 'NONE' || !text ? null : text;
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

module.exports = { streamFeedback, getCoachingCue, inferQuestions };
