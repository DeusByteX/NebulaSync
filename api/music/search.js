export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query required' });

  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&entity=song&limit=25`
    );
    const data = await response.json();
    const results = (data.results || []).map((item) => ({
      trackId: `itunes-${item.trackId}`,
      title: item.trackName,
      artist: item.artistName,
      album: item.collectionName || 'Single',
      coverArt: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '400x400bb') : '',
      audioUrl: item.previewUrl || '',
      durationMs: item.trackTimeMillis || 30000,
      source: 'itunes'
    }));

    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: 'Search failed' });
  }
}
