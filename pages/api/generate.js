// pages/api/generate.js
/**
 * Generates a professional headshot using BFL Flux Kontext (image-to-image),
 * and ALWAYS posts the lead (name, email, phone, output_url) to Google Sheets,
 * even if generation fails.
 *
 * Env vars required in Vercel:
 * - BFL_API_KEY
 * - GS_WEBHOOK_URL
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, phone, base64Image } = req.body || {};
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Missing name, email, or phone' });
  }

  const promptText =
    'A corporate headshot of this person with a professional background and professional expression on face. Put some mild grain on the skin to make the skin realistic and make the lips & hair look like that of a normal person. Keep the same identity and facial features.';

  const BFL_API_KEY = process.env.BFL_API_KEY;
  const SHEETS_URL = process.env.GS_WEBHOOK_URL;

  let output_url = '';

  try {
    // ---- 1) Submit request to BFL Flux Kontext (image editing) ----
    // Endpoint & header per docs: https://docs.bfl.ai/kontext/kontext_image_editing
    const createRes = await fetch('https://api.bfl.ai/v1/flux-kontext-pro', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
        'x-key': BFL_API_KEY, // NOTE: not x-api-key
      },
      body: JSON.stringify({
        prompt: promptText,
        // Send base64 string without data URI prefix
        input_image: base64Image || null, // if null, it will behave like text-to-image
        aspect_ratio: '1:1',
        output_format: 'jpeg',
        safety_tolerance: 2,
        prompt_upsampling: false,
      }),
    });

    if (!createRes.ok) {
      const text = await createRes.text();
      throw new Error(`BFL create error: ${text}`);
    }

    const { polling_url } = await createRes.json();

    // ---- 2) Poll until Ready (or timeout) ----
    const start = Date.now();
    const TIMEOUT_MS = 35_000;
    const SLEEP_MS = 1000;

    while (Date.now() - start < TIMEOUT_MS) {
      const pollRes = await fetch(polling_url, {
        method: 'GET',
        headers: { accept: 'application/json', 'x-key': BFL_API_KEY },
      });

      if (!pollRes.ok) {
        const t = await pollRes.text();
        throw new Error(`BFL poll error: ${t}`);
      }

      const pollJson = await pollRes.json();
      const status = (pollJson.status || '').toLowerCase();

      if (status === 'ready') {
        // Signed URL valid for ~10 minutes
        output_url = pollJson?.result?.sample || '';
        break;
      }
      if (status === 'error' || status === 'failed') {
        console.error('BFL generation failed:', pollJson);
        break;
      }
      await new Promise((r) => setTimeout(r, SLEEP_MS));
    }

    if (!output_url) {
      console.warn('BFL: no output_url (timed out or failed).');
    }
  } catch (err) {
    // If create or poll fails, we still proceed to post the lead
    console.error('BFL generation error:', err);
  }

  // ---- 3) ALWAYS post the lead to Google Sheets (success OR failure) ----
  try {
    await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, output_url }),
    });
  } catch (sheetErr) {
    console.error('Google Sheets webhook error:', sheetErr);
  }

  // ---- 4) Respond to client ----
  if (output_url) {
    return res.status(200).json({ output_url });
  } else {
    return res.status(500).json({ error: 'Headshot generation failed' });
  }
}

