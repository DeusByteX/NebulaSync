export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  let title = '';
  let artist = '';

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    title = body?.title || '';
    artist = body?.artist || '';
  } else {
    title = req.query.title || '';
    artist = req.query.artist || '';
  }

  if (!title || !artist) {
    return res.status(400).json({ error: 'Title and artist parameters required' });
  }

  try {
    const query = `${artist} ${title} audio`;
    const searchTerm = `${artist} ${title}`;

    const [ytRes, itunesRes] = await Promise.all([
      fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }).catch(() => null),
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTerm)}&media=music&limit=1`).catch(() => null)
    ]);

    let youtubeId = null;
    if (ytRes && ytRes.ok) {
      const html = await ytRes.text();
      const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/;
      const match = regex.exec(html);
      youtubeId = match ? match[1] : null;
    }

    let audioUrl = '';
    let durationMs = 240000;
    if (itunesRes && itunesRes.ok) {
      const itunesData = await itunesRes.json();
      if (itunesData.results && itunesData.results.length > 0) {
        audioUrl = itunesData.results[0].previewUrl || '';
        durationMs = itunesData.results[0].trackTimeMillis || 240000;
      }
    }

    return res.status(200).json({ youtubeId, audioUrl, durationMs });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to resolve streams' });
  }
}
