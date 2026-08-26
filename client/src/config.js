export const getBackendUrl = () => {
  const saved = localStorage.getItem('NEBULA_API_URL');
  if (saved) return saved.trim().replace(/\/$/, '');

  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }

  // If using secure HTTPS client, standard mixed content blocks unsecure port 3001 fetches
  if (window.location.protocol === 'https:') {
    // If we have a custom server on Render/Railway, user saves it. Default to localhost for testing.
    return 'http://localhost:3001';
  }
  return `http://${window.location.hostname}:3001`;
};

export const setBackendUrl = (url) => {
  if (!url) {
    localStorage.removeItem('NEBULA_API_URL');
  } else {
    localStorage.setItem('NEBULA_API_URL', url.trim());
  }
};
