// pages/api/generate.js

/**
 * Generates up to FOUR headshots via BFL and ALWAYS posts the lead to Google Sheets.
 * Sheet post is robust: try JSON first; if not OK, fallback to form-encoded with
 * both machine and human-readable field names (Name, Phone Number, Email).
 *
 * Env vars in Vercel:
 *  - BFL_API_KEY
 *  - GS_WEBHOOK_URL
 */

export const config = {
  api: {
    bodyParser: { sizeLimit: '6mb' }, // frontend compresses; this is just a safety net
  },
};

const VARIANTS = 4;
const TIMEOUT_MS = 60_000;
const SLEEP_MS = 1000;

const PROMPT = [
  `Create a high-resolution corporate headshot of this person based on the provided image attached.`,
  ``,
  `Pose & Angle: Maintain the same face orientation and camera angle as the input photo, with natural head positioning and no extreme perspective changes.`,
  ``,
  `Hairstyle: Preserve the subject’s original hairstyle, adjusting only for neatness and light grooming.`,
  ``,
  `Skin Tone: Match the original skin tone exactly, applying only a ~15% enhancement for clarity and evenness—avoid whitening or unrealistic smoothness. Add very mild skin grain for a realistic texture.`,
  ``,
  `Facial Features: Keep all defining facial features intact; make lips and hair look natural with subtle refinement only. Remove all accessories (earrings, glasses, etc.). Reduce under eyes or eye puffiness.`,
  ``,
  `Clothing: Dress in casual formals attire (blazer and shirt), ensuring the clothing matches a professional corporate style.`,
  ``,
  `Background: Replace with a softly focused, professional office environment.`,
  ``,
  `Framing: Adjust face and body proportions for a natural, homogenous composition; keep it cropped from mid-torso upward.`,
  ``,
  `Lighting: Soft, even front lighting with minimal shadows for a clean corporate look.`,
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
  // Some BFL setups expect x-key, others x-api-key — send both for safety.
  'x-key': key,
  'x-api-key': key,
});

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createJob({ key, base64, seed }) {
  // Prefer image-to-image endpoint
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
    // Fallback to text-to-image endpoint
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

/** Post to Google Sheets with robust fallbacks and**
