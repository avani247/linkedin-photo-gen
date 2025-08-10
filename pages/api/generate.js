// pages/api/generate.js

/**
 * Generates FOUR headshots via BFL, posts lead to Google Sheets regardless of success.
 * - Tries /v1/flux-kontext-pro (image-to-image) first; falls back to /v1/flux-pro-1.1.
 * - Sends both x-key and x-api-key headers for compatibility.
 * - Polls polling_url until Ready (up to 60s).
 *
 * Env in Vercel:
 *  - BFL_API_KEY
 *  - GS_WEBHOOK_URL
 */

export const config = {
  api: {
    bodyParser: { sizeLimit: '6mb' }, // safety net; frontend already compresses
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

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

  const BFL_API_KEY = process.env.BFL_API_KEY;
  const SHEETS_URL = process.env.GS_WEBHOOK_URL;

  const output_urls = [];
  let generationError = null;

  // Submit a single job; prefer kontext (image→image), fallback to flux-pro-1.1
  const submit = async (seed) => {
    const commonHeaders = {
      'Content-Type': 'application/json',
      accept: 'application/json',
      'x-key': BFL_API_KEY,
      'x-api-key': BFL_API_KEY, // extra compatibility
    };

    // First try: flux-kontext-pro (image-to-image)
    const kontextBody = {
      prompt: PROMPT,
      input_image: base64Image,      // raw base64 (no data URI)
      aspect_ratio: '1:1',
      output_format: 'jpeg',
      safety_tolerance: 2,
      prompt_upsampling: false,
      seed,
    };

    let createRes = await fetch('https://api.bfl.ai/v1/flux-kontext-pro', {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify(kontextBody),
    });

    // Fallback if endpoint not available
    if (!createRes.ok) {
      // Second try: flux-pro-1.1 (text-to-image). We still use the prompt;
      // some stacks ignore input_image here.
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
        headers: commonHeaders,
        body: JSON.stringify(fallbackBody),
      });

      if (!createRes.ok) {
        const text = await createRes.text();
        throw new Error(`BFL create error: ${text}`);
      }
    }

    const { polling_url } = await createRes.json();
    return polling_url;
  };

  const poll = async (polling_url) => {
    const start = Date.now();
    while (Date.now() - start < TIMEOUT_MS) {
      const pollRes = await fetch(polling_url, {
        method: 'GET',
        headers: { accept: 'application/json', 'x-key': BFL_API_KEY, 'x-api-key': BFL_API_KEY },
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
  };

  try {
    const seeds = Array.from({ length: VARIANTS }, (_, i) => Math.floor(Math.random() * 1e9) + i);
    const pollingUrls = await Promise.all(seeds.map((s) => submit(s)));
    const results = await Promise.allSettled(pollingUrls.map((u) => poll(u)));
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) output_urls.push(r.value);
    }
    if (!output_urls.length) throw new Error('All generations failed or returned empty URLs.');
  } catch (err) {
    generationError = err;
    console.error('BFL generation error:', err);
  } finally {
    // ALWAYS send lead to Google Sheets
    try {
      if (SHEETS_URL) {
        await fetch(SHEETS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            phone,
            phone_number: phone,                // sheet compatibility
            output_url: output_urls[0] || '',   // first image (if any)
            output_urls,                        // all images
            status: output_urls.length ? 'success' : 'error',
            error: generationError ? String(generationError.message || generationError) : null,
            ts: new Date().toISOString(),
          }),
        });
      } else {
        console.error('GS_WEBHOOK_URL missing.');
      }
    } catch (sheetErr) {
      console.error('Google Sheets webhook error:', sheetErr);
    }
  }

  if (output_urls.length) {
    return res.status(200).json({ output_urls });
  }
  return res.status(500).json({ error: 'Headshot generation failed' });
}
