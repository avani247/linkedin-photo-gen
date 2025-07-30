# TimesPro LinkedIn‑Photo Generator

This repository contains a fully serverless web application that allows anyone to convert a casual headshot into a polished, professional LinkedIn photo. Built with a static front‑end hosted on **GitHub Pages** and a serverless back‑end powered by **Cloudflare Workers**, the entire solution runs on free tiers — there are no hosting costs when deployed correctly.

## Features

* **Responsive landing page**: A simple and modern interface built with TailwindCSS via CDN. Visitors are greeted with a brief description of the service and a clear call‑to‑action.
* **Lead capture form**: Users provide their name, email and phone number, and upload a headshot. Form fields include client‑side validation with helpful error messages.
* **Serverless image generation**: Upon submission, the form data and image are sent to a Cloudflare Worker. The Worker forwards the request to **Black Forest Labs (BFL)** via `https://api.bfl.ai/v1/generate` using a fixed prompt describing a professional headshot. When the generated image URL is returned, the Worker responds back to the client.
* **Google Sheets integration**: The Worker also posts the user details and generated image URL to a Google Sheets webhook, allowing simple lead management on a free tier.
* **Free hosting**: Static assets live on GitHub Pages, while the Worker runs on Cloudflare’s generous free tier. Deployments are automated via GitHub Actions.

## File structure

```
/public
  ├── index.html       # Landing page UI
  ├── script.js        # Client‑side logic for form handling and API calls
  └── logo.png         # TimesPro logo (copied from the provided asset)
/workers
  └── generate.js      # Cloudflare Worker implementing the back‑end logic
/.github/workflows
  └── gh-pages.yml     # GitHub Action to publish /public to GitHub Pages
wrangler.toml           # Cloudflare Worker configuration
README.md               # This documentation
```

## Local development

1. Install the [Cloudflare Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install/) if you haven’t already:

   ```bash
   npm install -g wrangler
   ```

2. Clone your fork and install any dependencies (none are required beyond Wrangler itself):

   ```bash
   git clone https://github.com/<your-name>/linkedin-photo-gen.git
   cd linkedin-photo-gen
   ```

3. Copy the TimesPro logo into the `public/` folder if it is not already present.

4. Replace `YOUR_WORKER_URL` in `public/script.js` with your deployed Worker URL once you have published it (see below).

5. Run the Worker locally with Wrangler for testing:

   ```bash
   wrangler dev --var BFL_API_KEY=<your_bfl_api_key> --var GS_WEBHOOK_URL=<your_webhook>
   ```

   The Worker will be available at `http://localhost:8787`. Update `WORKER_URL` accordingly to test the integration.

6. Serve the front‑end by opening `public/index.html` directly in your browser or using a simple static file server (for example `npx http-server public`).

## Deployment guide

1. **Create the repository**. Use the GitHub CLI or the web UI to create a new public repository named `linkedin-photo-gen` under your account.

2. **Push the code**. Commit and push the contents of this directory to the `main` branch of that repository.

3. **Configure GitHub Pages**. In repository settings, under **Pages**, select:

   * **Source**: GitHub Actions
   * The default branch (`main`) will be used to trigger deployments. The provided workflow publishes the `public` directory to Pages.

4. **Publish the Cloudflare Worker**. First log into your Cloudflare account via Wrangler:

   ```bash
   wrangler login
   ```

   Publish the Worker with:

   ```bash
   wrangler publish
   ```

   Wrangler will prompt you for the account and pick an available workers.dev subdomain. Note the URL it prints (`https://<subdomain>.workers.dev`) — you’ll need to insert this into `public/script.js` as `WORKER_URL`.

5. **Store secrets**. On the next command line, set your API keys as Worker secrets. These are not stored in the repository:

   ```bash
   wrangler secret put BFL_API_KEY
   wrangler secret put GS_WEBHOOK_URL
   ```

6. **Update the front‑end**. Edit `public/script.js` to replace `YOUR_WORKER_URL` with your actual Worker URL. Commit and push the change. The GitHub Action will redeploy your pages automatically.

7. **Verify**. Navigate to `https://<your‑username>.github.io/linkedin-photo-gen` and follow the flow: fill out the form, upload a headshot, and within about a minute you should see a generated image. Check your Google Sheet to confirm the lead entry was recorded.

## License

This project is provided for educational and demonstration purposes. TimesPro branding is used under the assumption of a hypothetical exercise; real deployments should respect brand guidelines and usage rights.