async function testFetch() {
  const query = 'The Weeknd Blinding Lights audio';
  
  // Test 1: Direct YouTube search
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const match = /"videoId":"([a-zA-Z0-9_-]{11})"/.exec(html);
    console.log('Test 1 Direct YT match:', match ? match[1] : null);
  } catch (e) {
    console.log('Test 1 failed:', e.message);
  }

  // Test 2: CorsProxy.io
  try {
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent('https://www.youtube.com/results?search_query=' + query)}`);
    const html = await res.text();
    const match = /"videoId":"([a-zA-Z0-9_-]{11})"/.exec(html);
    console.log('Test 2 CorsProxy match:', match ? match[1] : null);
  } catch (e) {
    console.log('Test 2 failed:', e.message);
  }
}

testFetch();
