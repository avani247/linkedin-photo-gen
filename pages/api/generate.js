import FormData from 'form-data';

/**
 * API route to handle headshot generation. It receives a JSON payload
 * containing the user’s name, email, phone and a base64 encoded image.
 * It forwards the image to the Black Forest Labs API to generate a
 * professional headshot and sends the lead information to a Google
 * Sheets webhook. Finally it returns the generated image URL.
 */
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, phone, base64Image } = req.body;
  // Basic validation – require all lead fields. base64Image may be empty if generation failed client‑side.
  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  let output_url = '';
  try {
    // Only attempt to call BFL if an image was provided
    if (base64Image) {
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
      const json = await bflRes.json();
      output_url = json.output_url;
    }
  } catch (err) {
    // Log BFL errors but do not prevent lead submission
    console.error('BFL generation error:', err);
  }
  // Send lead to Google Sheets regardless of BFL success. Include whatever output_url was set (may be empty).
  try {
    await fetch(process.env.GS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, output_url })
    });
  } catch (err) {
    console.error('Google Sheets webhook error:', err);
  }
  // Respond to client. If we have a generated image URL, return it. Otherwise indicate failure.
  if (output_url) {
    return res.status(200).json({ output_url });
  } else {
    return res.status(500).json({ error: 'Failed to generate headshot' });
  }
}
