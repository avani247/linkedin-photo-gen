// script.js
// Handles UI interactions and communicates with the Cloudflare worker

// Replace this with your Worker endpoint after publishing
const WORKER_URL = 'YOUR_WORKER_URL';

// Grab references to DOM elements
const ctaButton = document.getElementById('ctaButton');
const formSection = document.getElementById('formSection');
const leadForm = document.getElementById('leadForm');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultSection = document.getElementById('resultSection');
const resultImage = document.getElementById('resultImage');
const downloadLink = document.getElementById('downloadLink');

// Error elements
const errorName = document.getElementById('errorName');
const errorEmail = document.getElementById('errorEmail');
const errorPhone = document.getElementById('errorPhone');
const errorHeadshot = document.getElementById('errorHeadshot');

// Reveal the form when CTA is clicked
ctaButton.addEventListener('click', () => {
  formSection.classList.remove('hidden');
  ctaButton.classList.add('hidden');
});

// Form submission handler
leadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  // Reset error visibility
  errorName.classList.add('hidden');
  errorEmail.classList.add('hidden');
  errorPhone.classList.add('hidden');
  errorHeadshot.classList.add('hidden');
  resultSection.classList.add('hidden');

  // Read input values
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const fileInput = document.getElementById('headshot');
  const file = fileInput.files[0];

  // Basic validation
  let hasError = false;
  if (!name) {
    errorName.classList.remove('hidden');
    hasError = true;
  }
  // Simple regex for email validation
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailPattern.test(email)) {
    errorEmail.textContent = 'Valid email is required.';
    errorEmail.classList.remove('hidden');
    hasError = true;
  }
  if (!phone) {
    errorPhone.classList.remove('hidden');
    hasError = true;
  }
  if (!file) {
    errorHeadshot.classList.remove('hidden');
    hasError = true;
  }
  if (hasError) return;

  // Show loading indicator and disable submit button
  loadingIndicator.classList.remove('hidden');
  const submitButton = document.getElementById('submitButton');
  submitButton.disabled = true;

  try {
    // Convert the selected image to base64 (strip the data URL prefix)
    const toBase64 = (file) =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          // result is a data URL; remove the prefix up to the comma
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
      });
    const base64Image = await toBase64(file);
    // Prepare payload
    const payload = {
      name,
      email,
      phone,
      base64Image,
    };
    // Send request to the Worker
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error('Server error. Please try again later.');
    }
    const data = await res.json();
    // Display the generated image
    resultImage.src = data.output_url;
    downloadLink.href = data.output_url;
    resultSection.classList.remove('hidden');
  } catch (err) {
    alert(err.message || 'Unknown error occurred');
  } finally {
    loadingIndicator.classList.add('hidden');
    submitButton.disabled = false;
  }
});