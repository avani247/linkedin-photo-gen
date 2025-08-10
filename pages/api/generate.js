// pages/api/generate.js

/**
 * Generates FOUR professional headshots using BFL Flux Kontext (image-to-image),
 * and ALWAYS posts the lead (name, email, phone, output_urls[]) to Google Sheets,
 * whether generation succeeds or fails.
 *
 * Env vars required in Vercel:
 * - BFL_API_KEY
 * - GS_WEBHOOK_URL
 *
 * Notes:
 * - Endpoint uses JSON and header `x-key`, then you must poll `polling_url`.
 * - Result URL is at result.sample (signed URL, ~10 min). Docs: docs.bfl.ai. 
 */

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb', // safety net; front-end already compresses
    },
  },
};

const KONTEKST_ENDPOINT = 'https://api.bfl.ai/v1/flux-kontext-pro';
const VARIANTS = 4;
const TIMEOUT_MS = 45_000;
const SLEEP_MS = 1000;

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

  // Your requested prompt, with a neutral first line to avoid misgendering
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

  // Ensure we always post a lead, even if everything fails
  const output_urls = [];
  let generationError = null;

  try {
    // helper: submit a single request
    const submit = async (seed) => {
      const createRes = await fetch(KONTEKST_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json',
          'x-key': BFL_API_KEY,
        },
        body: JSON.stringify({
          prompt: PROMPT,
          input_image: base64Image, // raw base64 (no data URI) from the client
          aspect_ratio: '1:1',
          output_format: 'jpeg',
          safety_tolerance: 2,
          prompt_upsampling: false,
          seed: seed, // vary seeds for diversity
        }),
      });

      if (!createRes.ok) {
        const text = await createRes.text();
        throw new Error(`BFL create error: ${text}`);
      }

      const { polling_url } = await createRes.json();
      return polling_url;
    };

    // helper: poll until ready
    const poll = async (polling_url) => {
      const start = Date.now();
      while (Date.now() - start < TIMEOUT_MS) {
        const pollRes = await fetch(polling_url, {
          method: 'GET',
          headers: { accept: 'application/json', 'x-key': BFL_API_KEY },
        });

        if (!pollRes.ok) {
          const t = await pollRes.text();
          throw new Error(`BFL poll error: ${t}`);
        }

        const json = await pollRes.json();
        const status = (json.status || '').toLowerCase();

        if (status === 'ready') {
          return json?.result?.sample || '';
        }
        if (status === 'error' || status === 'failed') {
          throw new Error(`BFL status ${status}: ${JSON.stringify(json)}`);
        }
        await new Promise((r) => setTimeout(r, SLEEP_MS));
      }
      throw new Error('BFL generation timeout');
    };

    // Fire 4 parallel generations (vary seeds for diversity)
    const seeds = Array.from({ length: VARIANTS }, (_, i) => Math.floor(Math.random() * 1e9) + i);
    const pollingUrls = await Promise.all(seeds.map((s) => submit(s)));
    const results = await Promise.allSettled(pollingUrls.map((u) => poll(u)));

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value) output_urls.push(r.value);
    }
    if (output_urls.length === 0) {
      throw new Error('All generations failed or returned empty URLs.');
    }
  } catch (err) {
    generationError = err;
    console.error('BFL generation error:', err);
  } finally {
    // ALWAYS send the lead to Google Sheets, regardless of generation success
    try {
      if (!SHEETS_URL) {
        console.error('Google Sheets webhook URL missing.');
      } else {
        await fetch(SHEETS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            phone,
            output_urls, // array (possibly empty)
            status: output_urls.length ? 'success' : 'error',
            error: generationError ? String(generationError.message || generationError) : null,
            ts: new Date().toISOString(),
          }),
        });
      }
    } catch (sheetErr) {
      console.error('Google Sheets webhook error:', sheetErr);
    }
  }

  // Respond to client
  if (output_urls.length) {
    return res.status(200).json({ output_urls });
  } else {
    return res.status(500).json({ error: 'Headshot generation failed' });
  }
}
