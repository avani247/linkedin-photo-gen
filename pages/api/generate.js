// pages/api/generate.js
/**
 * Generates up to FOUR headshots via BFL and ALWAYS posts the lead to Google Sheets.
 * - Tries image-to-image (/v1/flux-kontext-pro); falls back to text-to-image (/v1/flux-pro-1.1)
 * - Sends both x-key and x-api-key headers (some stacks expect one or the other)
 * - Polls polling_url until Ready (up to 60s)
 * - Returns 402 when credits are insufficient
 *
 * Vercel env vars:
 *  - BFL_API_KEY
 *  - GS_WEBHOOK_URL
 */

export const config = {
  api: {
    bodyParser: { sizeLimit: '6mb' }, // safety net; frontend compresses already
  },
};

const VARIANTS = 4;
const TIMEOUT_MS = 60_000;
const SLEEP_MS = 1000;

const PROMPT = [
  'Create a high-resolution corporate headshot of this person based on the provided image attached.',
  '',
  'Pose & Angle: Maintain the same face orientation and camera angle as the input photo, with natural head positioning and no extreme perspective changes.',
  '',
  'Hairstyle: Preserve the subject’s original hairstyle, adjusting only for neatness and light grooming.',
  '',
  'Skin Tone: Match the original skin tone exactly, applying only a ~15% enhancement for clarity and evenness—avoid whitening or unrealistic smoothness. Add very mild skin grain for a realistic texture.',
  '',
  'Facial Features: Keep all defining facial features intact; make lips and hair look natural with subtle refinement only. Remove all accessories (earrings, glasses, etc.). Reduce under eyes or eye puffiness.',
  '',
  'Clothing: Dress in casual formals attire (blazer and shirt), ensuring the clothing matches a professional corporate style.',
  '',
  'Background: Replace with a softly focused, professional office environment.',
  '',
  'Framing: Adjust face and body proportions for a natural, homogenous composition; keep it cropped from mid-torso upward.',
  '',
  'Lighting: Soft, even front lighting with minimal shadows for a clean corporate look.',
].join('\n');

class InsufficientCreditsError extends Error {
  constructor(msg) {
    super(msg);
    this.name = 'InsufficientCreditsError';
  }
}

const headers = (key) => ({
  'Content-Type': 'application/json',
  accept: 'application/json',
  'x-key': key,
  'x-api-key': key,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createJob({ key, base64, seed }) {
  // Prefer image-to-image first
  const kontextBody = {
    prompt: PROMPT,
    input_image: base64, // raw base64 (no data: prefix)
    aspect_ratio: '1:1',
    output_format: 'jpeg',
    safety_tolerance: 2,
    prompt_upsampling: false,
    seed,
  };

  let createRes = await fetch('https://api.bfl.ai/v1/flux-kontext-pro', {
    method: 'POST',
    headers: headers(key),
    body: JSON.stringify(kontextBody),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    if (createRes.status === 402 || /insufficient\s*credits/i.test(text)) {
      throw new InsufficientCreditsError(text || 'Insufficient credits');
    }
    // Fallback to text-to-image
    const fallbackBody = {
      prompt: PROMPT,
      aspect_ratio: '1:1',
      output_format: 'jpeg',
      safety_tolerance: 2,
      prompt_upsampling: false,
      seed,
    };
    createRes = await fetch('https://api.bfl.ai/v1/flux-pro-1.1', {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify(fallbackBody),
    });
    if (!createRes.ok) {
      const text2 = await createRes.text();
      if (createRes.status === 402 || /insufficient\s*credits/i.test(text2)) {
        throw new InsufficientCreditsError(text2 || 'Insufficient credits');
      }
      throw new Error(`BFL create error: ${text2}`);
    }
  }

  const { polling_url } = await createRes.json();
  return polling_url;
}

async function pollJob({ key, pollingUrl }) {
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    const pollRes = await fetch(pollingUrl, {
      method: 'GET',
      headers: { accept: 'application/json', 'x-key': key, 'x-api-key': key },
    });
    if (!pollRes.ok) {
      const t = await pollRes.text();
      throw new Error(`BFL poll error: ${t}`);
    }
    const json = await pollRes.json();
    const status = (json.status || '').toLowerCase();
    if (status === 'ready') return json?.result?.sample || '';
    if (status === 'error' || status === 'failed') {
      throw new Error(`BFL status ${status}: ${JSON.stringify(json)}`);
    }
    await sleep(SLEEP_MS);
  }
  throw new Error('BFL generation timeout');
}

// Post to Google Sheets with JSON first; if that fails, fall back to form-encoded
async function postLeadToSheet(sheetUrl, lead) {
  if (!sheetUrl) {
    console.error('GS_WEBHOOK_URL missing.');
    return false;
  }

  // Try JSON
  try {
    const r = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lead),
    });
    const text = await r.text();
    console.log('Sheets JSON resp:', r.status, text.slice(0, 200));
    if (r.ok) return true;
  } catch (e) {
    console.error('Sheets JSON post error:', e);
  }

  // Fallback to x-www-form-urlencoded with both machine + friendly field names
  try {
    const form = new URLSearchParams({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      output_url: lead.output_url || '',
      output_urls: JSON.stringify(lead.output_urls || []),
      status: lead.status || '',
      error: lead.error || '',
      ts: lead.ts || '',
      'Name': lead.name,
      'Email': lead.email,
      'Phone Number': lead.phone,
      'Output URL': lead.output_url || '',
      'Output URLs': JSON.stringify(lead.output_urls || []),
      'Status': lead.status || '',
      'Error': lead.error || '',
      'Timestamp': lead.ts || '',
    });

    const r2 = await fetch(sheetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const text2 = await r2.text();
    console.log('Sheets FORM resp:', r2.status, text2.slice(0, 200));
    return r2.ok;
  } catch (e2) {
    console.error('Sheets FORM post error:', e2);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, phone, base64Image } = req.body || {};
  if (!name || !email || !phone || !base64Image) {
    return res.status(400).json({ error: 'Missing name, email, phone or image' });
  }

  const key = process.env.BFL_API_KEY;
  const sheetUrl = process.env.GS_WEBHOOK_URL;

  const output_urls = [];
  let statusTag = 'success';
  let errorMsg = '';

  try {
    // Probe first job to catch credit errors early
    const seed0 = Math.floor(Math.random() * 1e9);
    const polling0 = await createJob({ key, base64: base64Image, seed: seed0 });
    const url0 = await pollJob({ key, pollingUrl: polling0 });
    if (url0) output_urls.push(url0);

    // Remaining variants in parallel
    const remaining = Math.max(0, VARIANTS - 1);
    if (remaining) {
      const seeds = Array.from({ length: remaining }, (_, i) => Math.floor(Math.random() * 1e9) + i + 1);
      const pollingUrls = await Promise.all(seeds.map((s) => createJob({ key, base64: base64Image, seed: s })));
      const results = await Promise.allSettled(pollingUrls.map((u) => pollJob({ key, pollingUrl: u })));
      for (const r of results) if (r.status === 'fulfilled' && r.value) output_urls.push(r.value);
    }

    if (!output_urls.length) {
      statusTag = 'error';
      errorMsg = 'All generations failed or returned empty URLs.';
      throw new Error(errorMsg);
    }
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      statusTag = 'insufficient_credits';
      errorMsg = err.message || 'Insufficient credits';
    } else {
      statusTag = 'error';
      errorMsg = err?.message || String(err);
    }
    console.error('BFL generation error:', err);
  } finally {
    await postLeadToSheet(sheetUrl, {
      name,
      email,
      phone,
      output_url: output_urls[0] || '',
      output_urls,
      status: statusTag,
      error: errorMsg || null,
      ts: new Date().toISOString(),
    });
  }

  if (statusTag === 'insufficient_credits') {
    return res.status(402).json({ error: 'Insufficient credits' });
  }
  if (!output_urls.length) {
    return res.status(500).json({ error: 'Headshot generation failed' });
  }
  return res.status(200).json({ output_urls });
}
