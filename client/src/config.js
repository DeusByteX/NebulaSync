export const getBackendUrl = () => {
  const saved = localStorage.getItem('NEBULA_API_URL');
  if (saved) return saved.trim().replace(/\/$/, '');

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }

  // On production Vercel deploys, use relative path '' so requests route to Vercel Serverless API functions!
  return '';
};

export const setBackendUrl = (url) => {
  if (!url) {
    localStorage.removeItem('NEBULA_API_URL');
  } else {
    localStorage.setItem('NEBULA_API_URL', url.trim());
  }
};
