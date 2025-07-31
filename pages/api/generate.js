import FormData from 'form-data';

/**
 * API route to handle headshot generation.  It receives a JSON payload
 * containing the user’s name, email, phone and a base64 encoded image.
 * It forwards the image to the Black Forest Labs API to generate a
 * professional headshot and sends the lead information to a Google
 * Sheets webhook.  Finally it returns the generated image URL.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { name, email, phone, base64Image } = req.body;
  if (!name || !email || !phone || !base64Image) {
    return res.status(400).json({ error: 'Missing parameters' });
  }
  try {
    // Prepare multipart form for BFL API
    const form = new FormData();
    form.append('image', base64Image);
    form.append(
      'prompt',
      'A corporate headshot of this person with a professional background and professional expression on face. Put some mild grain on the skin to make the skin realistic and make the lips & hair look like that of a normal person.'
    );
    const bflRes = await fetch('https://api.bfl.ai/v1/generate', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.BFL_API_KEY,
        ...form.getHeaders()
      },
      body: form
    });
    if (!bflRes.ok) {
      const text = await bflRes.text();
      throw new Error(`BFL API error: ${text}`);
    }
    const { output_url } = await bflRes.json();
    // Forward lead to Google Sheets
    await fetch(process.env.GS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, output_url })
    });
    return res.status(200).json({ output_url });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
