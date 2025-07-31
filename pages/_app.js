import '../styles/globals.css';

/**
 * Custom App component to apply global styles.  Since Tailwind
 * is loaded via the CDN in individual pages, this file only
 * imports the global CSS reset.
 */
export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />;
}