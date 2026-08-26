const resolveYoutubeIdClient = async (title, artist) => {
  const query = `${artist} ${title}`;

  // Method 1: Piped Public API
  try {
    const pipedRes = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query + ' audio')}&filter=music_songs`);
    if (pipedRes.ok) {
      const data = await pipedRes.json();
      if (data.items && data.items.length > 0) {
        const item = data.items[0];
        const match = item.url.match(/v=([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
          console.log(`[Piped Success] videoId="${match[1]}" duration=${item.duration}s title="${item.title}"`);
          return { youtubeId: match[1], durationMs: item.duration * 1000 };
        }
      }
    }
  } catch (e) {
    console.warn('Piped resolve failed:', e.message);
  }

  // Method 2: Cobalt/Invidious fallback endpoints
  const invidiousInstances = [
    'https://invidious.nerdvpn.de',
    'https://vid.puffyan.us',
    'https://invidious.drgns.space'
  ];

  for (const instance of invidiousInstances) {
    try {
      const invRes = await fetch(`${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
      if (invRes.ok) {
        const data = await invRes.json();
        if (Array.isArray(data) && data.length > 0) {
          const match = data.find(v => v.videoId && v.lengthSeconds > 60);
          if (match) {
            console.log(`[Invidious Success] instance="${instance}" videoId="${match.videoId}" duration=${match.lengthSeconds}s`);
            return { youtubeId: match.videoId, durationMs: match.lengthSeconds * 1000 };
          }
        }
      }
    } catch (e) {
      // try next instance
    }
  }

  // Method 3: YouTube Search html regex via allorigins CORS proxy
  try {
    const proxyRes = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent('https://www.youtube.com/results?search_query=' + encodeURIComponent(query + ' audio'))}`);
    if (proxyRes.ok) {
      const html = await proxyRes.text();
      const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/;
      const match = regex.exec(html);
      if (match && match[1]) {
        console.log(`[AllOrigins Success] videoId="${match[1]}"`);
        return { youtubeId: match[1], durationMs: 240000 };
      }
    }
  } catch (e) {
    console.warn('AllOrigins proxy failed:', e.message);
  }

  return null;
};

(async () => {
  console.log('Testing full song resolvers...');
  const r1 = await resolveYoutubeIdClient('Blinding Lights', 'The Weeknd');
  console.log('Result 1:', r1);

  const r2 = await resolveYoutubeIdClient('Starboy', 'The Weeknd');
  console.log('Result 2:', r2);
})();
