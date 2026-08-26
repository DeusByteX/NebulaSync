export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query required' });

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=15`
    );
    const data = await response.json();
    const rawResults = data.results || [];

    // Pre-resolve YouTube video IDs for top 5 search items in parallel for instant full-length playback
    const topResults = rawResults.slice(0, 5);
    const youtubeIds = await Promise.all(
      topResults.map(async (item) => {
        try {
          const q = `${item.artistName} ${item.trackName} audio`;
          const ytRes = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (ytRes.ok) {
            const html = await ytRes.text();
            const match = /"videoId":"([a-zA-Z0-9_-]{11})"/.exec(html);
            return match ? match[1] : null;
          }
        } catch (e) {}
        return null;
      })
    );

    const results = rawResults.map((item, idx) => ({
      trackId: `itunes-${item.trackId}`,
      title: item.trackName,
      artist: item.artistName,
      album: item.collectionName || 'Single',
      coverArt: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '400x400bb') : '',
      audioUrl: item.previewUrl || '',
      durationMs: item.trackTimeMillis || 240000,
      youtubeId: (idx < 5 ? youtubeIds[idx] : null) || '',
      source: 'itunes'
    }));

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: 'Search failed' });
  }
}
