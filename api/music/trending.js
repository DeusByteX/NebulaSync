export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const response = await fetch('https://rss.applemediaservices.com/api/v2/us/music/most-played/24/songs.json');
    const data = await response.json();
    const results = (data.feed?.results || []).map((item) => ({
      trackId: `trend-${item.id}`,
      title: item.name,
      artist: item.artistName,
      album: item.collectionName || 'Single Chart',
      coverArt: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '400x400bb') : '',
      audioUrl: '',
      durationMs: 240000,
      source: 'chart'
    }));
    return res.status(200).json({ results });
  } catch (err) {
    return res.status(500).json({ error: 'Trending failed' });
  }
}
