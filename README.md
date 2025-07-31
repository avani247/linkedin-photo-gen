# LinkedIn Photo Generator

**LinkedIn Photo Generator** is a free, Vercel‑hosted web app that produces a professional headshot from a user‑supplied photo.  It collects minimal lead information, sends it to a Google Sheets webhook and uses Black Forest Labs’ image‑generation API to create a polished headshot.

## 🏃‍♀️ Quick Start

```bash
git clone https://github.com/<your_user>/linkedin-photo-gen.git
cd linkedin-photo-gen
npm install
cp .env.example .env.local
# Populate .env.local with your API keys and webhook URL
npm run dev
```

The site will run locally at `http://localhost:3000`.  You can edit files in `pages/` and see live reloads.

## 🧠 How It Works

1. Users visit the landing page and click **Generate My Headshot**.
2. A form appears requesting their name, email, phone and a headshot photo.  All fields are required and validated client‑side.
3. When the form is submitted, the image is converted to a Base64 string in the browser and sent with the other data to `/api/generate`.
4. The API route calls the Black Forest Labs API using your `BFL_API_KEY` to generate a professional portrait and then forwards the lead information to your Google Sheets webhook (`GS_WEBHOOK_URL`).
5. The resulting portrait’s URL is returned to the frontend, which displays the image and provides a download button.

## 📁 Project Structure

```
linkedin-photo-gen/
├── pages/
│   ├── index.js            # Landing page with form
│   └── api/
│       └── generate.js     # Serverless API route
├── public/
│   ├── timespro.png        # TimesPro logo
│   └── example.png         # Placeholder before/after example
├── styles/
│   └── globals.css         # Global styles (optional)
├── package.json
└── README.md
```

## 🔐 Environment Variables

This app relies on two secrets.  **Do not hard‑code them in the repo.**  Instead, add them as environment variables in Vercel’s dashboard (or in a local `.env.local` file for development).

| Variable        | Description                              |
| --------------- | ---------------------------------------- |
| `BFL_API_KEY`   | Your Black Forest Labs API key           |
| `GS_WEBHOOK_URL`| Your Google Sheets Apps Script webhook   |

Create a file called `.env.local` in the project root and add:

```env
BFL_API_KEY=YOUR_BFL_API_KEY
GS_WEBHOOK_URL=YOUR_GOOGLE_SHEETS_WEBHOOK
```

When deploying to Vercel, add these keys under **Project Settings → Environment Variables**.  Set the scope to **Production**.

## 🚀 Deployment

1. Push this repository to GitHub.
2. Log into your [Vercel](https://vercel.com/) account and import the repository.
3. During import, set the environment variables `BFL_API_KEY` and `GS_WEBHOOK_URL` with your own values.
4. Deploy the app.  After a minute or two, Vercel will provide a public URL (e.g. `https://linkedin-photo-gen.vercel.app`).
5. Visit the URL and verify the flow works end‑to‑end.  You should see the lead data appear in your Google Sheet.

## 🤝 Contributing

Fork the repo, create a branch and open a pull request.  Bug reports and feature requests are welcome!

## 🤝 The End
Bye Bye

