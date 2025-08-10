import Head from 'next/head';
import { useState } from 'react';

export default function Home() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [resultUrls, setResultUrls] = useState([]); // up to 4 urls

  // Resize + compress before sending (keeps payload small)
  const resizeAndEncode = (imageFile) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 800;
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) {
            height = (height * maxDim) / width;
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = (width * maxDim) / height;
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width);
        canvas.height = Math.round(height);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
      img.src = URL.createObjectURL(imageFile);
    });
  };

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!email.trim()) {
      errs.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'Invalid email address';
    }
    if (!phone.trim()) errs.phone = 'Phone is required';
    if (!file) {
      errs.file = 'Headshot image is required';
    } else if (!file.type.startsWith('image/')) {
      errs.file = 'Please upload an image file';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setResultUrls([]);
    try {
      const resized = await resizeAndEncode(file);
      const payload = {
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        base64Image: (resized.split(',')[1] ?? ''), // raw base64
      };
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate headshots');
      }
      const urls = Array.isArray(data.output_urls) ? data.output_urls : [];
      setResultUrls(urls);

      // clear form
      setName('');
      setEmail('');
      setPhone('');
      setFile(null);
      setErrors({});
    } catch (err) {
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
        {/* Tailwind via CDN */}
        <script src="https://cdn.tailwindcss.com"></script>
      </Head>
      <main className="min-h-screen flex flex-col items-center justify-start bg-gray-50">
        {/* Hero */}
        <section className="w-full py-12 px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <img src="/timespro.png" alt="TimesPro Logo" className="h-16 mx-auto mb-4" />
            <h1 className="text-3xl md:text-5xl font-bold mb-4">
              Get a Professional LinkedIn Headshot – Free
            </h1>
            <p className="text-gray-700 text-lg md:text-xl mb-8">
              TimesPro presents an AI-powered headshot generator to elevate your profile.
            </p>
            {/* Example: Arya old/new */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 mb-8">
              <div>
                <img
                  src="/arya-old.jpeg"
                  alt="Arya – Original"
                  className="w-40 h-40 object-cover rounded-full shadow-md"
                />
                <p className="mt-2 text-sm text-gray-600">Arya – Original</p>
              </div>
              <div>
                <img
                  src="/arya-new.jpeg"
                  alt="Arya – Generated (example)"
                  className="w-40 h-40 object-cover rounded-full shadow-md"
                />
                <p className="mt-2 text-sm text-gray-600">Arya – Generated (example)</p>
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

        {/* Form */}
        {showForm && (
          <section className="w-full max-w-md px-4 pb-12">
            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-md space-y-4">
              <div>
                <label className="block font-medium mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full border rounded px-3 py-2 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
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
                  className={`w-full border rounded px-3 py-2 ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
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
                  className={`w-full border rounded px-3 py-2 ${
                    errors.phone ? 'border-red-500' : 'border-gray-300'
                  }`}
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
                className={`w-full bg-blue-600 text-white px-6 py-3 rounded-full font-semibold shadow hover:bg-blue-700 focus:outline-none ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? 'Generating…' : 'Submit'}
              </button>
            </form>

            {/* Results: grid of up to 4 */}
            {resultUrls.length > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-semibold mb-4 text-center">Your AI-Generated Headshots</h3>
                <div className="grid grid-cols-2 gap-4">
                  {resultUrls.map((url, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-lg shadow text-center">
                      <img
                        src={url}
                        alt={`Generated headshot ${idx + 1}`}
                        className="mx-auto w-40 h-40 object-cover rounded-full shadow"
                      />
                      <a
                        href={url}
                        download
                        className="mt-3 inline-block bg-green-600 text-white px-4 py-2 rounded-full hover:bg-green-700"
                      >
                        Download #{idx + 1}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  );
}
