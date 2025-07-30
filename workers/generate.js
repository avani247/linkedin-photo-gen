// Cloudflare Worker that takes lead information and a base64 headshot,
// calls the BFL API to generate a professional corporate headshot,
// records the lead in Google Sheets via webhook and returns the generated image URL.

export default {
  async fetch(request, env) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }
    try {
      const { name, email, phone, base64Image } = await request.json();
      // Prepare form data for BFL API
      const formData = new FormData();
      formData.append('image', base64Image);
      formData.append(
        'prompt',
        'A corporate headshot of this person with a professional background and professional expression on face. Put some mild grain on the skin to make the skin realistic and make the lips & hair look like that of a normal person.'
      );
      // Call the BFL API to generate the image
      const bflResp = await fetch('https://api.bfl.ai/v1/generate', {
        method: 'POST',
        headers: {
          'x-api-key': env.BFL_API_KEY,
        },
        body: formData,
      });
      if (!bflResp.ok) {
        // Pass through errors from upstream service
        return new Response('BFL error', { status: 502 });
      }
      const bflData = await bflResp.json();
      const output_url = bflData.output_url;
      // Fire and forget: send lead information + generated URL to Google Sheets webhook
      // Only attempt if webhook URL provided to avoid runtime errors in dev
      if (env.GS_WEBHOOK_URL) {
        fetch(env.GS_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name, email, phone, output_url }),
        }).catch(() => {
          // ignore errors writing to sheet
        });
      }
      // Respond back to the client with the generated image URL
      return new Response(JSON.stringify({ output_url }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (err) {
      return new Response('Server error', {
        status: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};