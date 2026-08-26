import React, { useState, useEffect, useRef } from 'react';
import { Search, Play, Plus, Trash2, Send, MessageSquare, CheckCircle, Disc, Copy, Lock, Unlock, QrCode, TrendingUp, Music, Sparkles } from 'lucide-react';
import { getBackendUrl } from '../config';

const GENRES = [
  { name: 'Pop Hits', color: '#8d67ab' },
  { name: 'Hip-Hop', color: '#ba5d07' },
  { name: 'Rock Classics', color: '#c92a2a' },
  { name: 'Dance & Electronic', color: '#1e754a' },
  { name: 'Lo-Fi Chill Beats', color: '#105282' },
  { name: 'Heavy Metal', color: '#4a4a4a' },
];

export default function Dashboard({
  user,
  view,
  setView,
  activeRoom,
  onLeaveRoom,
  onPlaySong,
  onAddToQueue,
  onUpvoteTrack,
  onRemoveFromQueue,
  onClearQueue,
  onToggleRoomLock,
  onSendReaction,
  chatMessages,
  onSendChatMessage
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [chatText, setChatText] = useState('');
  const chatBottomRef = useRef(null);

  // Recommendations and Charts states (Fetched dynamically from server)
  const [trendingTracks, setTrendingTracks] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [loadingFeeds, setLoadingFeeds] = useState(false);

  // Show large QR code state
  const [showQrCard, setShowQrCard] = useState(false);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, view]);

  const LOCAL_FALLBACK_TRACKS = [
    {
      trackId: "trend-fallback-1",
      title: "Nebula Synth Vibe",
      artist: "SoundHelix 1",
      album: "Space Odyssey Vol. 1",
      coverArt: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      durationMs: 372000,
      source: "studio"
    },
    {
      trackId: "trend-fallback-2",
      title: "Solar Winds",
      artist: "SoundHelix 2",
      album: "Space Odyssey Vol. 1",
      coverArt: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=300&auto=format&fit=crop",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      durationMs: 423000,
      source: "studio"
    },
    {
      trackId: "trend-fallback-3",
      title: "Supernova Pulse",
      artist: "SoundHelix 3",
      album: "Space Odyssey Vol. 2",
      coverArt: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=300&auto=format&fit=crop",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
      durationMs: 302000,
      source: "studio"
    },
    {
      trackId: "trend-fallback-4",
      title: "Starlight Horizon",
      artist: "SoundHelix 4",
      album: "Space Odyssey Vol. 2",
      coverArt: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=300&auto=format&fit=crop",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
      durationMs: 302000,
      source: "studio"
    },
    {
      trackId: "trend-fallback-5",
      title: "Cosmic Echoes",
      artist: "SoundHelix 5",
      album: "Quantum Tunes",
      coverArt: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=300&auto=format&fit=crop",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
      durationMs: 362000,
      source: "studio"
    },
    {
      trackId: "trend-fallback-6",
      title: "Dark Matter Rhythm",
      artist: "SoundHelix 6",
      album: "Quantum Tunes",
      coverArt: "https://images.unsplash.com/photo-1506157786151-b8491531f063?q=80&w=300&auto=format&fit=crop",
      audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
      durationMs: 582000,
      source: "studio"
    }
  ];

  // Helper to parse public Apple RSS feeds on client
  const mapAppleFeed = (results, sourceTag) => {
    return results.map(item => ({
      trackId: `${sourceTag}-${item.id}`,
      title: item.name,
      artist: item.artistName,
      album: item.collectionName || 'Single Chart',
      coverArt: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '400x400bb') : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop',
      audioUrl: '',
      durationMs: 240000,
      source: 'chart'
    }));
  };

  // Load Real-time Trending Top Charts & New Releases on component mount (With Direct Client Failovers)
  useEffect(() => {
    setLoadingFeeds(true);

    const loadTrending = async () => {
      // 1. Try custom Express backend first
      try {
        const res = await fetch(`${getBackendUrl()}/api/music/trending`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          setTrendingTracks(data.results);
          return;
        }
      } catch (e) {
        console.warn('Backend trending feed failed, attempting direct Apple Music RSS fetch...', e.message);
      }

      // 2. Try direct client-side Apple Music RSS fetch (Bypasses Mixed Content limits since HTTPS)
      try {
        const res = await fetch('https://rss.applemediaservices.com/api/v2/us/music/most-played/24/songs.json');
        const data = await res.json();
        if (data.feed && data.feed.results) {
          setTrendingTracks(mapAppleFeed(data.feed.results, 'trend'));
          return;
        }
      } catch (e) {
        console.warn('Direct Apple Music RSS trending feed failed, falling back to local files:', e.message);
      }

      // 3. Fallback: use local high-quality mock database
      setTrendingTracks(LOCAL_FALLBACK_TRACKS);
    };

    const loadNewReleases = async () => {
      // 1. Try custom Express backend first
      try {
        const res = await fetch(`${getBackendUrl()}/api/music/new-releases`);
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          setNewReleases(data.results);
          return;
        }
      } catch (e) {
        console.warn('Backend new releases feed failed, attempting direct Apple Music RSS fetch...', e.message);
      }

      // 2. Try direct client-side Apple Music RSS fetch
      try {
        const res = await fetch('https://rss.applemediaservices.com/api/v2/us/music/new-releases/24/songs.json');
        const data = await res.json();
        if (data.feed && data.feed.results) {
          setNewReleases(mapAppleFeed(data.feed.results, 'new'));
          return;
        }
      } catch (e) {
        console.warn('Direct Apple Music RSS new releases feed failed, falling back to local files:', e.message);
      }

      // 3. Fallback: use local high-quality mock database
      setNewReleases(LOCAL_FALLBACK_TRACKS);
    };

    Promise.all([loadTrending(), loadNewReleases()])
      .finally(() => setLoadingFeeds(false));
  }, []);

  // Handle Search API calls (Debounced to 150ms for snappy loading)
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const response = await fetch(
          `${getBackendUrl()}/api/music/search?query=${encodeURIComponent(searchQuery)}`
        );
        const data = await response.json();
        
        if (data.results) {
          setSearchResults(data.results);
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 150);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Play a song card with dynamic YouTube stream resolution
  const handlePlayClick = async (track) => {
    if (track.youtubeId) {
      onPlaySong(track);
      return;
    }
    setSearchLoading(true);
    try {
      const response = await fetch(`${getBackendUrl()}/api/music/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: track.title, artist: track.artist }),
      });
      const data = await response.json();
      if (data.youtubeId) {
        onPlaySong({
          ...track,
          youtubeId: data.youtubeId,
          audioUrl: data.audioUrl,
          durationMs: data.durationMs
        });
      } else {
        onPlaySong({
          ...track,
          audioUrl: track.audioUrl || data.audioUrl,
          durationMs: track.durationMs || data.durationMs
        });
      }
    } catch (err) {
      console.error('Failed to resolve playback stream:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddToQueueClick = async (track) => {
    if (track.youtubeId) {
      onAddToQueue(track);
      return;
    }
    setSearchLoading(true);
    try {
      const response = await fetch(`${getBackendUrl()}/api/music/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: track.title, artist: track.artist }),
      });
      const data = await response.json();
      if (data.youtubeId) {
        onAddToQueue({
          ...track,
          youtubeId: data.youtubeId,
          audioUrl: data.audioUrl,
          durationMs: data.durationMs
        });
      } else {
        onAddToQueue({
          ...track,
          audioUrl: track.audioUrl || data.audioUrl,
          durationMs: track.durationMs || data.durationMs
        });
      }
    } catch (err) {
      console.error('Failed to resolve queue stream:', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    onSendChatMessage(chatText.trim());
    setChatText('');
  };

  const handleCopyInviteLink = () => {
    if (!activeRoom) return;
    const inviteLink = `${window.location.origin}?join=${activeRoom.id}`;
    navigator.clipboard.writeText(inviteLink);
    alert('NebulaSync Invite Link copied! Share it with friends to auto-join this session.');
  };

  const formatTime = (ms) => {
    if (!ms) return '0:00';
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const activeInviteLink = activeRoom ? `${window.location.origin}?join=${activeRoom.id}` : '';

  return (
    <main className="main-content">
      {/* Header Sticky */}
      <header className="main-header">
        {view === 'search' ? (
          <div className="search-input-container">
            <Search />
            <input
              type="text"
              className="search-input"
              placeholder="Search 100M+ tracks, artists, remixes, and bootlegs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>
        ) : (
          <div style={{ fontSize: '1.2rem', fontWeight: '700' }}>
            {view === 'jam' && activeRoom ? `Jam Session: ${activeRoom.name}` : `Welcome back, ${user.username}!`}
          </div>
        )}
      </header>

      {/* RENDER VIEW 1: HOME VIEW */}
      {view === 'home' && (
        <>
          {/* Quick Vibes Shelf (Renders Worldwide charts top 6) */}
          <section className="shelf-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <TrendingUp style={{ color: 'var(--primary)' }} size={20} />
              <h2 className="shelf-title" style={{ margin: 0 }}>Trending Worldwide</h2>
            </div>
            {loadingFeeds && trendingTracks.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading global charts...</div>
            ) : (
              <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
                {trendingTracks.slice(0, 6).map((track) => (
                  <div 
                    className="music-card" 
                    key={track.trackId}
                    style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '14px', padding: '10px' }}
                    onClick={() => handlePlayClick(track)}
                  >
                    <img src={track.coverArt} alt={track.title} style={{ width: '56px', height: '56px', borderRadius: '4px', objectFit: 'cover' }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflow: 'hidden', flexGrow: 1 }}>
                      <div className="music-card-title" style={{ fontSize: '0.85rem' }}>{track.title}</div>
                      <div className="music-card-subtitle" style={{ fontSize: '0.75rem' }}>{track.artist}</div>
                    </div>
                    <button className="play-hover-btn" style={{ position: 'static', opacity: 1, transform: 'none', width: '32px', height: '32px', flexShrink: 0 }}>
                      <Play size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>



          {/* Suggested Tracks List (Renders Real-time New Releases) */}
          <section className="shelf-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Sparkles style={{ color: 'var(--primary)' }} size={20} />
              <h2 className="shelf-title" style={{ margin: 0 }}>Latest Global Releases</h2>
            </div>
            {loadingFeeds && newReleases.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading new releases...</div>
            ) : (
              <div className="cards-grid">
                {newReleases.map((track) => (
                  <div className="music-card" key={track.trackId} onClick={() => handlePlayClick(track)}>
                    <div className="music-card-img-container">
                      <img className="music-card-img" src={track.coverArt} alt={track.title} />
                      <button className="play-hover-btn">
                        <Play />
                      </button>
                    </div>
                    <div className="music-card-title">{track.title}</div>
                    <div className="music-card-subtitle">{track.artist}</div>
                    {activeRoom && (
                      <button 
                        className="invite-btn" 
                        style={{ marginTop: 'auto', alignSelf: 'flex-start' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToQueueClick(track);
                        }}
                      >
                        + Add to Jam Queue
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* RENDER VIEW 2: SEARCH VIEW */}
      {view === 'search' && (
        <>
          {searchQuery ? (
            <section className="shelf-section">
              <h2 className="shelf-title">Search Results</h2>
              
              {searchLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0', color: 'var(--text-muted)', gap: '10px' }}>
                  <Disc className="spinning-disc" style={{ animation: 'spin 2s linear infinite' }} />
                  <span>Searching music database...</span>
                </div>
              ) : searchResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                  No tracks found for "{searchQuery}"
                </div>
              ) : (
                <div className="cards-grid">
                  {searchResults.map((track) => (
                    <div className="music-card" key={track.trackId} onClick={() => handlePlayClick(track)}>
                      <div className="music-card-img-container">
                        <img className="music-card-img" src={track.coverArt} alt={track.title} />
                        
                        {/* Display custom badge if the result is a YouTube web stream/remix */}
                        {track.source === 'remix' && (
                          <span style={{
                            position: 'absolute',
                            top: '8px',
                            left: '8px',
                            backgroundColor: '#ff007f',
                            color: 'white',
                            fontSize: '0.6rem',
                            fontWeight: 'bold',
                            padding: '3px 6px',
                            borderRadius: '4px',
                            zIndex: 3
                          }}>
                            Remix / Web
                          </span>
                        )}

                        <button className="play-hover-btn">
                          <Play />
                        </button>
                      </div>
                      <div className="music-card-title">{track.title}</div>
                      <div className="music-card-subtitle">{track.artist}</div>
                      {activeRoom && (
                        <button 
                          className="invite-btn" 
                          style={{ marginTop: 'auto', alignSelf: 'flex-start' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToQueueClick(track);
                          }}
                        >
                          + Jam Queue
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <>
              {/* Display charts in search page when empty */}
              <section className="shelf-section">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <TrendingUp style={{ color: 'var(--primary)' }} size={20} />
                  <h2 className="shelf-title" style={{ margin: 0 }}>Top Songs Worldwide</h2>
                </div>
                {loadingFeeds ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading trending songs...</div>
                ) : (
                  <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
                    {trendingTracks.slice(0, 12).map((track) => (
                      <div className="music-card" key={track.trackId} onClick={() => handlePlayClick(track)}>
                        <div className="music-card-img-container">
                          <img className="music-card-img" src={track.coverArt} alt={track.title} />
                          <button className="play-hover-btn">
                            <Play />
                          </button>
                        </div>
                        <div className="music-card-title">{track.title}</div>
                        <div className="music-card-subtitle">{track.artist}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="shelf-section">
                <h2 className="shelf-title">Browse all genres</h2>
                <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', marginBottom: '32px' }}>
                  {GENRES.map((g) => (
                    <div
                      key={g.name}
                      style={{
                        backgroundColor: g.color,
                        height: '140px',
                        borderRadius: '12px',
                        padding: '16px',
                        fontWeight: '800',
                        fontSize: '1.2rem',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                      onClick={() => {
                        setSearchQuery(g.name);
                      }}
                    >
                      <span>{g.name}</span>
                      <div 
                        style={{ 
                          position: 'absolute', 
                          width: '70px', 
                          height: '70px', 
                          bottom: '-15px', 
                          right: '-15px', 
                          background: 'rgba(255,255,255,0.15)', 
                          borderRadius: '8px', 
                          transform: 'rotate(25deg)' 
                        }} 
                      />
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {/* RENDER VIEW 3: JAM ROOM VIEW */}
      {view === 'jam' && activeRoom && (
        <div className="jam-room-layout">
          {/* Main Jam Info and Queue (Left side) */}
          <div className="jam-room-main">
            
            {/* Room Hero Card */}
            <div className="jam-card-hero">
              <img 
                className="jam-hero-art" 
                src={activeRoom.currentTrack?.coverArt || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&auto=format&fit=crop'} 
                alt="Active Song" 
              />
              <div className="jam-hero-info">
                <span className="jam-badge">Jamming</span>
                <h1 className="jam-hero-title">
                  {activeRoom.currentTrack ? activeRoom.currentTrack.title : 'No Song Playing'}
                </h1>
                <p style={{ fontSize: '1.1rem', color: 'white', fontWeight: '500' }}>
                  {activeRoom.currentTrack ? activeRoom.currentTrack.artist : 'Select a track to start the session'}
                </p>
                
                {/* Futuristic Active Visualizer Wave */}
                {activeRoom.isPlaying && (
                  <div className="eq-wave-container" style={{ justifyContent: 'flex-start', margin: '8px 0' }}>
                    <div className="eq-wave-bar"></div>
                    <div className="eq-wave-bar"></div>
                    <div className="eq-wave-bar"></div>
                    <div className="eq-wave-bar"></div>
                    <div className="eq-wave-bar"></div>
                    <div className="eq-wave-bar"></div>
                    <div className="eq-wave-bar"></div>
                    <div className="eq-wave-bar"></div>
                    <div className="eq-wave-bar"></div>
                    <div className="eq-wave-bar"></div>
                    <div className="eq-wave-bar"></div>
                    <div className="eq-wave-bar"></div>
                  </div>
                )}

                <div className="jam-hero-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '6px' }}>
                  <span>Room: <strong>{activeRoom.name}</strong></span>
                  <span>•</span>
                  <span>Host: <strong>{activeRoom.host}</strong></span>
                  <span>•</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: activeRoom.isLocked ? 'var(--secondary)' : 'var(--primary)' }}>
                    {activeRoom.isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                    {activeRoom.isLocked ? 'Host Only' : 'Collaborative Control'}
                  </span>
                </div>

                {/* EMOJI REACTION DOCK */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px' }}>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-display)', color: 'var(--text-muted)' }}>React:</span>
                  <div style={{ display: 'flex', gap: '10px', background: 'rgba(3,0,10,0.6)', padding: '6px 12px', borderRadius: '30px', border: '1px solid var(--border)' }}>
                    {['🔥', '❤️', '🎉', '🎧', '💩', '😮'].map(emoji => (
                      <button 
                        key={emoji}
                        style={{ fontSize: '1.25rem', transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)' }}
                        onClick={() => onSendReaction(emoji)}
                        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.25)'}
                        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="jam-room-controls">
                  <button className="jam-btn jam-btn-secondary" onClick={onLeaveRoom}>
                    Leave Jam
                  </button>
                  
                  {/* Host Toggle Controls Lock Button */}
                  {activeRoom.host === user.username && (
                    <button 
                      className="jam-btn jam-btn-secondary"
                      onClick={() => onToggleRoomLock(!activeRoom.isLocked)}
                      style={{ borderColor: activeRoom.isLocked ? 'var(--secondary)' : 'var(--primary)', color: activeRoom.isLocked ? 'var(--secondary)' : 'var(--primary)' }}
                      title="Restrict playback buttons to Host only"
                    >
                      {activeRoom.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                      <span>{activeRoom.isLocked ? 'Unlock Playback' : 'Lock Playback'}</span>
                    </button>
                  )}

                  {/* Share Link Button */}
                  <button className="jam-btn jam-btn-secondary" onClick={handleCopyInviteLink}>
                    <Copy size={14} />
                    <span>Copy Invite Link</span>
                  </button>

                  <button className="jam-btn jam-btn-primary" onClick={() => setView('search')}>
                    Browse Songs
                  </button>
                </div>
              </div>

              {/* QR Code and QR Floating Overlay Card */}
              <div 
                style={{ position: 'relative', cursor: 'pointer' }}
                onMouseEnter={() => setShowQrCard(true)}
                onMouseLeave={() => setShowQrCard(false)}
              >
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(3,0,10,0.5)',
                  border: '1px solid var(--border)',
                  padding: '12px',
                  borderRadius: '10px',
                  transition: 'var(--transition-fast)'
                }}>
                  <QrCode size={40} style={{ color: 'var(--primary)', filter: 'drop-shadow(0 0 3px var(--primary))' }} />
                  <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-display)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>QR Invite</span>
                </div>

                {showQrCard && (
                  <div style={{
                    position: 'absolute',
                    top: '80px',
                    right: '0',
                    width: '180px',
                    backgroundColor: 'rgba(14, 8, 28, 0.95)',
                    border: '2px solid var(--border-neon)',
                    boxShadow: 'var(--neon-glow)',
                    borderRadius: '12px',
                    padding: '16px',
                    zIndex: 40,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    animation: 'slide-in 0.25s ease'
                  }}>
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(activeInviteLink)}&color=00ffcc&bgcolor=0e081c`}
                      alt="Room QR Code"
                      style={{ width: '140px', height: '140px', borderRadius: '4px', border: '1px solid var(--border)' }}
                    />
                    <span style={{ fontSize: '0.7rem', color: 'white', textAlign: 'center', fontWeight: 'bold' }}>Scan to Auto-Join!</span>
                  </div>
                )}
              </div>

            </div>

            {/* Participants list */}
            <div className="jam-members-shelf">
              <div className="jam-members-title">Listening Together ({activeRoom.members.length})</div>
              <div className="jam-members-list">
                {activeRoom.members.map((member) => (
                  <span className={`jam-member-pill ${member === activeRoom.host ? 'host' : ''}`} key={member}>
                    <img 
                      className="jam-member-pill-avatar"
                      src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${member}`}
                      alt={member}
                    />
                    <strong>{member}</strong>
                    {member === activeRoom.host && <span className="host-badge">Host</span>}
                  </span>
                ))}
              </div>
            </div>

            {/* Queue Area */}
            <div className="queue-shelf">
              <div className="queue-header">
                <span className="queue-title">Shared Jam Queue</span>
                {activeRoom.queue.length > 0 && activeRoom.host === user.username && (
                  <button className="clear-queue-btn" onClick={onClearQueue}>
                    Clear Queue
                  </button>
                )}
              </div>

              {activeRoom.queue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  The queue is empty. Search for songs and click "+ Jam Queue" to add them here!
                </div>
              ) : (
                <div className="queue-list">
                  {activeRoom.queue.map((track, idx) => {
                    const isUpvotedByMe = track.upvotes?.includes(user.username);
                    return (
                      <div className="queue-track-card" key={`${track.trackId}-${idx}`}>
                        <div className="queue-track-info">
                          <span className="queue-track-number">{idx + 1}</span>
                          <img className="queue-track-img" src={track.coverArt} alt={track.title} />
                          <div className="queue-track-details">
                            <span className="queue-track-title">{track.title}</span>
                            <span className="queue-track-artist">{track.artist}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          
                          {/* COLLABORATIVE UPVOTING BUTTON */}
                          <button
                            onClick={() => onUpvoteTrack(track.trackId)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '5px 10px',
                              borderRadius: '6px',
                              backgroundColor: isUpvotedByMe ? 'rgba(0, 255, 204, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid',
                              borderColor: isUpvotedByMe ? 'var(--primary)' : 'rgba(255, 255, 255, 0.08)',
                              color: isUpvotedByMe ? 'var(--primary)' : 'var(--text-muted)',
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              transition: 'var(--transition-fast)'
                            }}
                            title={isUpvotedByMe ? 'Remove Upvote' : 'Upvote song'}
                          >
                            <span>▲</span>
                            <span>{track.upvotes?.length || 0}</span>
                          </button>

                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {formatTime(track.durationMs)}
                          </span>
                          {(activeRoom.host === user.username) && (
                            <button className="queue-remove-btn" onClick={() => onRemoveFromQueue(idx)}>
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Group Chat Drawer */}
          <div className="jam-chat-panel">
            <div className="chat-header">
              <MessageSquare size={18} />
              <h3>Group Chat</h3>
            </div>

            <div className="chat-messages-container">
              {chatMessages.map((msg) => {
                if (msg.isSystem) {
                  return (
                    <div className="chat-message system" key={msg.id}>
                      {msg.text}
                    </div>
                  );
                }

                const isSelf = msg.sender === user.username;
                return (
                  <div className={`chat-message ${isSelf ? 'self' : ''}`} key={msg.id}>
                    <span className="chat-sender-name">{msg.sender}</span>
                    <div className="chat-bubble">
                      {msg.text}
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>

            <form className="chat-input-form" onSubmit={handleSendChat}>
              <input
                type="text"
                className="chat-input"
                placeholder="Send a message..."
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
              />
              <button type="submit" className="chat-send-btn">
                <Send />
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
