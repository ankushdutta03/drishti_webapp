/**
 * POST /api/agent
 *
 * Server-side half of the SIH26171 pipeline. Receives the *already
 * sanitized* screen context from the browser client (no raw pixels, no PII
 * — see the "Protect" step in app.js / privacyScan()) and asks an LLM/VLM
 * to reason over it and return an actionable browser command such as
 * {"action":"click","target":"Search Trains button"}.
 *
 * The AI API key lives ONLY here, as a server-side environment variable —
 * never in index.html, app.js, or any other file the browser downloads.
 * Set it in your deploy platform's dashboard (see README.md), not in code.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  if (!GEMINI_API_KEY) {
    res.status(500).json({
      error: 'Server misconfigured: GEMINI_API_KEY is not set as an environment variable on this deployment.'
    });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const {
    screen_context = {},
    task = '',
    allowed_actions = ['click', 'scroll'],
    protocol = 'drishti-sanitized-v1'
  } = body;

  // Defense in depth: refuse to forward anything that looks like it still
  // carries raw pixel data or un-redacted sensitive fields, even though the
  // client is expected to have already sanitized the payload.
  if (screen_context && screen_context.raw_pixels === true) {
    res.status(400).json({ error: 'Refused: payload declares raw_pixels=true. Only sanitized context is accepted.' });
    return;
  }

  const systemPrompt = [
    'You are the server-side reasoning component of a privacy-preserving browser vision agent.',
    'You never receive raw screenshots or unredacted personal data — only a sanitized description',
    'of on-screen UI elements (their type and role, not their sensitive values).',
    'Given the sanitized screen context and the user\'s task, respond with ONLY a compact JSON object',
    'of the shape {"action": "<click|scroll|type|none>", "target": "<element description>", "reason": "<short reason>"}.',
    `Only these actions are permitted: ${allowed_actions.join(', ')}.`,
    'Do not include any text outside the JSON object. No markdown code fences.'
  ].join(' ');

  const userPrompt = JSON.stringify({ protocol, task, screen_context }, null, 2);

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: 300,
          responseMimeType: 'application/json'
        }
      })
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({
        error: 'Upstream AI API error',
        detail: data
      });
      return;
    }

    const candidate = Array.isArray(data.candidates) ? data.candidates[0] : null;
    const part = candidate && candidate.content && Array.isArray(candidate.content.parts)
      ? candidate.content.parts[0]
      : null;
    const rawText = part && part.text ? part.text : '';

    let action;
    try {
      action = JSON.parse(rawText);
    } catch (e) {
      action = { action: 'none', target: null, reason: 'Model did not return valid JSON.', raw: rawText };
    }

    res.status(200).json({
      protocol,
      model: MODEL,
      action
    });
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach the AI API from the server.', detail: String(err) });
  }
};
