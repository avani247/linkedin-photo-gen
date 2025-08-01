import Head from 'next/head';
import { useState } from 'react';

/**
 * Landing page component.  Presents a marketing section and a form
 * for users to submit their name, email, phone and headshot image.
 * Uses Tailwind CSS via CDN for styling.
 */
export default function Home() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState('');

  /**
   * Convert a File into a base64 encoded string.  Returns a promise
   * that resolves with the base64 value (including the data URI prefix).
   */
  const toBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  /**
   * Validate form fields and set error messages if needed.
   * Returns true if the form is valid.
   */
  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Invalid email address';
    }
    if (!phone.trim()) {
      errs.phone = 'Phone is required';
    }
    if (!file) {
      errs.file = 'Headshot image is required';
    } else if (!file.type.startsWith('image/')) {
      errs.file = 'Please upload an image file';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /**
   * Handle form submission.  Converts the image to base64, calls the
   * API route and displays the resulting headshot.  Displays
   * appropriate error messages on failure.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setResultUrl('');
    try {
      const base64 = await toBase64(file);
      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        base64Image: base64.split(',')[1] ?? ''
      };
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error('Failed to generate headshot');
      }
      const data = await res.json();
      setResultUrl(data.output_url);
      // Reset form fields
      setName('');
      setEmail('');
      setPhone('');
      setFile(null);
      setErrors({});
    } catch (err) {
      // generic error message displayed under the submit button
      setErrors((prev) => ({ ...prev, submit: err.message || 'An error occurred' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>LinkedIn Photo Generator</title>
        <meta name="description" content="Generate a professional LinkedIn headshot for free" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Inject Tailwind CSS via CDN */}
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>
      <main className="min-h-screen flex flex-col items-center justify-start bg-gray-50">
        {/* Hero section */}
        <section className="w-full py-12 px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <img src="/timespro.png" alt="TimesPro Logo" className="h-16 mx-auto mb-4" />
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              Get a Professional LinkedIn Headshot – Free
            </h1>
            <p className="text-gray-700 text-lg md:text-xl mb-8">
              TimesPro presents an AI‑powered headshot generator to elevate your profile.
            </p>
            {/* Example before/after image */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-8">
              <div>
                <img
                  src="/example.png"
                  alt="Before headshot"
                  className="w-40 h-40 object-cover rounded-full shadow-md"
                />
                <p className="mt-2 text-sm text-gray-600">Original</p>
              </div>
              <div>
                <img
                  src="/example.png"
                  alt="After headshot"
                  className="w-40 h-40 object-cover rounded-full shadow-md grayscale"
                />
                <p className="mt-2 text-sm text-gray-600">Generated (example)</p>
              </div>
            </div>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-full font-semibold shadow hover:bg-blue-700 focus:outline-none"
              >
                Generate My Headshot
              </button>
            )}
          </div>
        </section>
        {/* Form section */}
        {showForm && (
          <section className="w-full max-w-md px-4 pb-12">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4">
              <div>
                <label className="block font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full border rounded px-3 py-2 ${errors.name ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Your name"
                  required
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full border rounded px-3 py-2 ${errors.email ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="you@example.com"
                  required
                />
                {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block font-medium mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full border rounded px-3 py-2 ${errors.phone ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="Phone number"
                  required
                />
                {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="block font-medium mb-1">Upload Headshot</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className={`w-full ${errors.file ? 'border-red-500' : 'border-gray-300'} border rounded px-3 py-2`}
                  required
                />
                {errors.file && <p className="text-red-500 text-sm mt-1">{errors.file}</p>}
              </div>
              {errors.submit && <p className="text-red-500 text-sm mt-1">{errors.submit}</p>}
              <button
                type="submit"
                disabled={loading}
                className={`w-full bg-blue-600 text-white px-6 py-3 rounded-full font-semibold shadow hover:bg-blue-700 focus:outline-none ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading ? 'Generating…' : 'Submit'}
              </button>
            </form>
            {/* Result section */}
            {resultUrl && (
              <div className="mt-6 text-center">
                <h3 className="text-xl font-semibold mb-2">Your AI‑Generated Headshot</h3>
                <img src={resultUrl} alt="Generated headshot" className="mx-auto w-48 h-48 object-cover rounded-full shadow" />
                <a
                  href={resultUrl}
                  download
                  className="mt-4 inline-block bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700"
                >
                  Download My Headshot
                </a>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
