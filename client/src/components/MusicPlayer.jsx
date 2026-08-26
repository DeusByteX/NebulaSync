import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, 
  RefreshCw, Shuffle, Disc, Users, Sliders, ChevronDown, Maximize2 
} from 'lucide-react';

const EQ_PRESETS = {
  flat: [0, 0, 0, 0, 0],
  bassBoost: [6, 4, 0, 0, -1],
  vocalBoost: [-2, 0, 4, 3, 1],
  dance: [5, 3, -1, 2, 4],
  acoustic: [2, 1, 1, 2, 3],
  cyberpunk: [7, -2, 1, 4, 6]
};

export default function MusicPlayer({ 
  currentTrack, 
  isPlaying, 
  progressMs, 
  onPlayPause, 
  onSeek, 
  onNext, 
  onPrev, 
  activeRoom,
  user
}) {
  const audioRef = useRef(null);
  const [localProgress, setLocalProgress] = useState(0); // in seconds
  const [duration, setDuration] = useState(0); // in seconds
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState(false);
  
  const isLockedByHost = activeRoom && activeRoom.isLocked && activeRoom.host !== user.username;
  const isUpdatingRef = useRef(false);

  // YouTube Player States & Fallbacks
  const [ytReady, setYtReady] = useState(false);
  const [ytPlayFailed, setYtPlayFailed] = useState(false);
  const ytPlayerRef = useRef(null);
  const ytIntervalRef = useRef(null);

  // Equalizer Web Audio API States
  const [eqGains, setEqGains] = useState([0, 0, 0, 0, 0]); // [Bass, Low-Mid, Mid, Presence, Treble]
  const [selectedPreset, setSelectedPreset] = useState('flat');
  const [showEqPanel, setShowEqPanel] = useState(false);
  const [showMobileFullPlayer, setShowMobileFullPlayer] = useState(false);

  const audioCtxRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const filtersRef = useRef([]);

  // Initialize Web Audio API nodes for audio element filtering
  const initEqualizer = () => {
    if (audioCtxRef.current) return; // Already loaded

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      console.log('Mobile device detected. Bypassing Web Audio routing to prevent CORS/silent playback blocks.');
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      const audio = audioRef.current;
      if (!audio) return;

      const source = ctx.createMediaElementSource(audio);
      sourceNodeRef.current = source;

      // Define 5 standard band frequencies (Hz)
      const bands = [
        { type: 'lowshelf', frequency: 60 },
        { type: 'peaking', frequency: 230, Q: 1.0 },
        { type: 'peaking', frequency: 910, Q: 1.0 },
        { type: 'peaking', frequency: 4000, Q: 1.0 },
        { type: 'highshelf', frequency: 14000 }
      ];

      let lastNode = source;
      const filters = bands.map((band, idx) => {
        const filter = ctx.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.setValueAtTime(band.frequency, ctx.currentTime);
        if (band.Q) filter.Q.setValueAtTime(band.Q, ctx.currentTime);
        filter.gain.setValueAtTime(eqGains[idx], ctx.currentTime);
        
        lastNode.connect(filter);
        lastNode = filter;
        return filter;
      });

      lastNode.connect(ctx.destination);
      filtersRef.current = filters;
      console.log('Web Audio Equalizer node chain connected successfully.');
    } catch (e) {
      console.warn('Web Audio Equalizer bypass (CORS / gesture restriction):', e.message);
    }
  };

  // Update frequency filters dynamically whenever gain array updates
  useEffect(() => {
    if (filtersRef.current.length === 5 && audioCtxRef.current) {
      eqGains.forEach((gain, index) => {
        const filter = filtersRef.current[index];
        if (filter) {
          filter.gain.setValueAtTime(gain, audioCtxRef.current.currentTime);
        }
      });
    }
  }, [eqGains]);

  const handlePresetChange = (presetName) => {
    setSelectedPreset(presetName);
    const gains = EQ_PRESETS[presetName];
    if (gains) {
      setEqGains([...gains]);
    }
  };

  const handleBandGainChange = (index, val) => {
    const newGains = [...eqGains];
    newGains[index] = val;
    setEqGains(newGains);
    setSelectedPreset('custom');
  };

  // Reset YouTube failure flag whenever a new track loads
  useEffect(() => {
    setYtPlayFailed(false);
  }, [currentTrack]);

  // Determine if we should use the YouTube Player (Full Length) or fall back to HTML5 Audio (30s Preview fallback)
  const useYouTube = !!(currentTrack && currentTrack.youtubeId) && !ytPlayFailed;

  // 1. Initialize YouTube Player IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    // Global callback
    window.onYouTubeIframeAPIReady = () => {
      initPlayer();
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    }

    function initPlayer() {
      if (ytPlayerRef.current) return;
      
      console.log('Initializing hidden YouTube Player for full-length streams...');
      ytPlayerRef.current = new window.YT.Player('yt-player-element', {
        height: '1',
        width: '1',
        videoId: '',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          showinfo: 0,
          modestbranding: 1,
          origin: window.location.origin
        },
        events: {
          onReady: (event) => {
            console.log('YouTube Player Core Ready.');
            setYtReady(true);
            event.target.setVolume(volume * 100);
          },
          onStateChange: (event) => {
            if (event.data === window.YT.PlayerState.ENDED) {
              console.log('YouTube track ended.');
              handleAudioEnded();
            }
          },
          onError: (event) => {
            console.warn('YouTube Player encountered an error code:', event.data, '. Automatically falling back to HTML5 preview stream!');
            setYtPlayFailed(true);
          }
        }
      });
    }

    return () => {
      if (ytIntervalRef.current) {
        clearInterval(ytIntervalRef.current);
      }
    };
  }, []);

  // 2. Playback Synchronization (Handles both YouTube full-length and Audio preview fallbacks)
  useEffect(() => {
    const audio = audioRef.current;
    const yt = ytPlayerRef.current;

    if (!currentTrack) {
      if (audio) {
        audio.pause();
        audio.src = '';
      }
      if (yt && ytReady && typeof yt.stopVideo === 'function') {
        yt.stopVideo();
      }
      setLocalProgress(0);
      setDuration(0);
      return;
    }

    // A. YOUTUBE FLOW
    if (useYouTube) {
      if (audio) {
        audio.pause();
        audio.src = '';
      }

      if (yt && ytReady && typeof yt.cueVideoById === 'function') {
        const videoId = currentTrack.youtubeId;
        
        try {
          const currentUrl = yt.getVideoUrl ? yt.getVideoUrl() : '';
          
          if (!currentUrl.includes(videoId)) {
            console.log(`Loading YouTube video ID: "${videoId}" (play=${isPlaying})`);
            if (isPlaying) {
              yt.loadVideoById({ videoId });
            } else {
              yt.cueVideoById({ videoId });
            }
            setLocalProgress(0);
            setDuration(currentTrack.durationMs / 1000 || 240);
          } else {
            // Already loaded the correct video, toggle playback state
            if (isPlaying) {
              yt.playVideo();
            } else {
              yt.pauseVideo();
            }
          }

          yt.setVolume(isMuted ? 0 : volume * 100);

          // Refresh duration shortly after loading
          if (isPlaying) {
            setTimeout(() => {
              if (yt && yt.getDuration) {
                const d = yt.getDuration();
                if (d > 0) setDuration(d);
              }
            }, 1500);
          }
        } catch (e) {
          console.warn('YouTube player API invocation failed, triggering fallback:', e);
          setYtPlayFailed(true);
        }
      }
    } 
    // B. NATIVE AUDIO PREVIEW FALLBACK
    else {
      // Stop YouTube
      if (yt && ytReady && typeof yt.stopVideo === 'function') {
        try {
          yt.stopVideo();
        } catch (e) {}
      }

      if (audio) {
        const cleanUrl = currentTrack.audioUrl;
        const currentAudioSrc = audio.src;
        if (cleanUrl && !currentAudioSrc.includes(cleanUrl)) {
          console.log('Loading fallback audio preview URL:', cleanUrl);
          audio.src = cleanUrl;
          audio.load();
          setLocalProgress(0);
        }

        audio.volume = isMuted ? 0 : volume;

        if (isPlaying) {
          initEqualizer();
          if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
          }
          audio.play().catch(err => {
            console.warn('Playback error on fallback audio:', err.message);
          });
        } else {
          audio.pause();
        }
      }
    }
  }, [currentTrack, isPlaying, useYouTube, ytReady]);

  // 3. YouTube Progress Tracker Timer
  useEffect(() => {
    if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
    
    if (isPlaying && useYouTube && ytReady && ytPlayerRef.current) {
      ytIntervalRef.current = setInterval(() => {
        const yt = ytPlayerRef.current;
        try {
          if (yt && typeof yt.getCurrentTime === 'function' && !isUpdatingRef.current) {
            const currentTime = yt.getCurrentTime();
            setLocalProgress(currentTime);
          }
        } catch (e) {}
      }, 500);
    }

    return () => {
      if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
    };
  }, [isPlaying, useYouTube, ytReady]);

  // 4. Handle seek timeline updates from socket props
  useEffect(() => {
    if (progressMs === undefined || !currentTrack) return;
    
    const targetSeconds = progressMs / 1000;
    const diff = Math.abs(localProgress - targetSeconds);
    
    if (diff > 1.5) {
      console.log(`Syncing player timelines. Target seek position: ${targetSeconds.toFixed(2)}s`);
      if (useYouTube && ytReady && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
        try {
          ytPlayerRef.current.seekTo(targetSeconds, true);
        } catch (e) {
          setYtPlayFailed(true);
        }
        setLocalProgress(targetSeconds);
      } else if (!useYouTube && audioRef.current) {
        audioRef.current.currentTime = targetSeconds;
        setLocalProgress(targetSeconds);
      }
    }
  }, [progressMs]);

  // Handle HTML5 Audio periodic updates
  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio || useYouTube) return;
    
    if (!isUpdatingRef.current) {
      setLocalProgress(audio.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio && !useYouTube) {
      setDuration(audio.duration || currentTrack.durationMs / 1000 || 30);
    }
  };

  const handleAudioEnded = () => {
    if (repeat) {
      if (useYouTube && ytReady && ytPlayerRef.current) {
        try {
          ytPlayerRef.current.seekTo(0, true);
          ytPlayerRef.current.playVideo();
        } catch (e) {
          setYtPlayFailed(true);
        }
      } else if (!useYouTube && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(e => {});
      }
    } else {
      onNext();
    }
  };

  const handleTogglePlay = () => {
    if (!currentTrack) return;
    initEqualizer();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    onPlayPause(!isPlaying);
  };

  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value);
    setLocalProgress(val);
    isUpdatingRef.current = true;
  };

  const handleSliderMouseUp = (e) => {
    isUpdatingRef.current = false;
    const val = parseFloat(e.target.value);
    
    if (useYouTube && ytReady && ytPlayerRef.current && typeof ytPlayerRef.current.seekTo === 'function') {
      try {
        ytPlayerRef.current.seekTo(val, true);
      } catch (e) {
        setYtPlayFailed(true);
      }
    } else if (!useYouTube && audioRef.current) {
      audioRef.current.currentTime = val;
    }
    
    onSeek(val * 1000);
  };

  const handleVolumeChange = (e) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    setIsMuted(val === 0);
    
    if (useYouTube && ytReady && ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      try {
        ytPlayerRef.current.setVolume(val * 100);
      } catch (e) {}
    } else if (!useYouTube && audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    
    if (useYouTube && ytReady && ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === 'function') {
      try {
        ytPlayerRef.current.setVolume(nextMuted ? 0 : volume * 100);
      } catch (e) {}
    } else if (!useYouTube && audioRef.current) {
      audioRef.current.volume = nextMuted ? 0 : volume;
    }
  };

  const formatSecs = (sec) => {
    if (isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (localProgress / duration) * 100 : 0;

  return (
    <div className="music-player-bar">
      {/* HTML5 Audio Tag (Used as dynamic preview fallback) */}
      <audio 
        ref={audioRef}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
      />

      {/* Hidden YouTube Iframe Player Element (For full length songs) */}
      <div id="yt-player-container" style={{
        position: 'fixed',
        bottom: '0',
        right: '0',
        width: '200px',
        height: '120px',
        opacity: '0.01',
        pointerEvents: 'none',
        zIndex: -1
      }}>
        <div id="yt-player-element"></div>
      </div>

      {/* Left: Album cover details (Tapping expands mobile full-screen player) */}
      <div 
        className="player-left"
        onClick={() => currentTrack && setShowMobileFullPlayer(true)}
        style={{ cursor: currentTrack ? 'pointer' : 'default' }}
      >
        {currentTrack ? (
          <>
            <img 
              className={`player-song-img ${isPlaying ? 'spinning-disc' : ''}`} 
              src={currentTrack.coverArt} 
              alt={currentTrack.title} 
              style={{ animation: isPlaying ? 'spin 12s linear infinite' : 'none', borderRadius: '50%' }}
            />
            <div className="player-song-details">
              <div className="player-song-title">{currentTrack.title}</div>
              <div className="player-song-artist">{currentTrack.artist}</div>
            </div>
          </>
        ) : (
          <div style={{ color: 'var(--text-sub)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Disc size={20} className="spinning-disc" style={{ opacity: 0.5 }} />
            <span>Select a song to play</span>
          </div>
        )}
      </div>

      {/* Center: Playback Progress and Buttons */}
      <div className="player-center">
        <div className="player-controls">
          <button 
            className={`player-control-btn ${shuffle ? 'active' : ''}`}
            onClick={() => setShuffle(!shuffle)}
            title="Shuffle (Local)"
          >
            <Shuffle size={16} />
          </button>
          
          <button 
            className="player-control-btn" 
            onClick={onPrev} 
            disabled={isLockedByHost} 
            title={isLockedByHost ? "Playback controls locked by Host" : "Previous"}
            style={{ cursor: isLockedByHost ? 'not-allowed' : 'pointer', opacity: isLockedByHost ? 0.3 : 1 }}
          >
            <SkipBack size={20} />
          </button>
          
          <button 
            className="player-control-btn play-btn" 
            onClick={handleTogglePlay} 
            disabled={isLockedByHost} 
            title={isLockedByHost ? "Playback controls locked by Host" : (isPlaying ? "Pause" : "Play")}
            style={{ cursor: isLockedByHost ? 'not-allowed' : 'pointer', opacity: isLockedByHost ? 0.5 : 1 }}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} style={{ marginLeft: '2px' }} />}
          </button>
          
          <button 
            className="player-control-btn" 
            onClick={onNext} 
            disabled={isLockedByHost} 
            title={isLockedByHost ? "Playback controls locked by Host" : "Next"}
            style={{ cursor: isLockedByHost ? 'not-allowed' : 'pointer', opacity: isLockedByHost ? 0.3 : 1 }}
          >
            <SkipForward size={20} />
          </button>
          
          <button 
            className={`player-control-btn ${repeat ? 'active' : ''}`}
            onClick={() => setRepeat(!repeat)}
            title="Repeat (Local)"
          >
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Custom Progress Bar Slider */}
        <div className="player-progressbar-container">
          <span className="player-time">{formatSecs(localProgress)}</span>
          <div className="slider-container" style={{ cursor: isLockedByHost ? 'not-allowed' : 'pointer' }}>
            <input 
              type="range"
              min={0}
              max={duration || 30}
              step={0.1}
              value={localProgress}
              onChange={handleSliderChange}
              onMouseUp={handleSliderMouseUp}
              onTouchEnd={handleSliderMouseUp}
              disabled={isLockedByHost}
              style={{
                width: '100%',
                opacity: 0,
                position: 'absolute',
                zIndex: 2,
                cursor: isLockedByHost ? 'not-allowed' : 'pointer'
              }}
            />
            <div className="slider-track">
              <div 
                className="slider-fill" 
                style={{ 
                  width: `${progressPercent}%`,
                  backgroundColor: 'var(--primary)' 
                }} 
              />
              <div 
                className="slider-handle" 
                style={{ 
                  left: `${progressPercent}%` 
                }} 
              />
            </div>
          </div>
          <span className="player-time">{formatSecs(duration)}</span>
        </div>
      </div>

      {/* Right: Jam Indicators & Volume Controls */}
      <div className="player-right">
        {activeRoom && (
          <div className={`jam-sync-indicator ${activeRoom.host === user.username ? 'host' : ''}`}>
            <Users size={14} />
            <span>
              {activeRoom.host === user.username ? 'Jam Host' : 'Synced to Jam'}
            </span>
          </div>
        )}

        {/* Futuristic Equalizer Sliders Trigger Button */}
        <button 
          className={`player-control-btn ${showEqPanel ? 'active' : ''}`}
          onClick={() => setShowEqPanel(!showEqPanel)}
          title="Configure Audio Equalizer (EQ)"
          style={{ color: showEqPanel ? 'var(--primary)' : 'var(--text-muted)' }}
        >
          <Sliders size={18} />
        </button>

        {/* Volume HUD bar */}
        <div className="volume-bar">
          <button onClick={toggleMute} style={{ color: 'var(--text-muted)' }}>
            {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className="slider-container" style={{ width: '80px' }}>
            <input 
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              style={{
                width: '100%',
                opacity: 0,
                position: 'absolute',
                zIndex: 2,
                cursor: 'pointer'
              }}
            />
            <div className="slider-track" style={{ height: '3px' }}>
              <div 
                className="slider-fill" 
                style={{ width: `${(isMuted ? 0 : volume) * 100}%` }} 
              />
              <div 
                className="slider-handle" 
                style={{ left: `${(isMuted ? 0 : volume) * 100}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* EQUALIZER FLOATING GLASS CARD PANEL */}
      {showEqPanel && (
        <div style={{
          position: 'fixed',
          bottom: '110px',
          right: '24px',
          width: '320px',
          backgroundColor: 'rgba(14, 8, 28, 0.95)',
          border: '2px solid var(--border-neon)',
          boxShadow: 'var(--neon-glow)',
          borderRadius: '16px',
          padding: '20px',
          zIndex: 99,
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          animation: 'slide-in 0.25s ease'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={16} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '0.9rem', fontFamily: 'var(--font-display)', color: 'var(--primary)', fontWeight: 'bold' }}>Cyber Deck EQ</span>
            </div>
            <button 
              onClick={() => setShowEqPanel(false)}
              style={{ color: 'var(--text-muted)', fontSize: '0.8rem', border: 'none', background: 'none', cursor: 'pointer' }}
            >
              Close
            </button>
          </div>

          {/* Presets Select */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>EQ Profile Preset</label>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px',
                borderRadius: '6px',
                backgroundColor: 'rgba(0,0,0,0.5)',
                border: '1px solid var(--border)',
                color: 'white',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="flat">Flat (Bypassed)</option>
              <option value="bassBoost">Bass Booster</option>
              <option value="vocalBoost">Vocal Booster</option>
              <option value="dance">Dance & Electronic</option>
              <option value="acoustic">Acoustic</option>
              <option value="cyberpunk">Cyberpunk Sizzle</option>
              <option value="custom">Custom Configuration</option>
            </select>
          </div>

          {/* Equalizer Gain Bands Grids */}
          <div style={{ display: 'flex', justifyContent: 'space-between', height: '140px', padding: '10px 0' }}>
            {['60Hz', '230Hz', '910Hz', '4kHz', '14kHz'].map((label, idx) => {
              const gain = eqGains[idx];
              return (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', flexGrow: 1 }}>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{gain > 0 ? `+${gain}` : gain}dB</span>
                  <div style={{ height: '100px', width: '6px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', position: 'relative' }}>
                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={gain}
                      onChange={(e) => handleBandGainChange(idx, parseInt(e.target.value))}
                      style={{
                        position: 'absolute',
                        transform: 'rotate(-90deg)',
                        transformOrigin: 'center',
                        width: '100px',
                        height: '6px',
                        top: '47px',
                        left: '-47px',
                        opacity: 0,
                        zIndex: 3,
                        cursor: 'ns-resize'
                      }}
                    />
                    {/* Visual representation of slider track */}
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      width: '6px',
                      height: `${((gain + 12) / 24) * 100}%`,
                      backgroundColor: 'var(--primary)',
                      boxShadow: 'var(--neon-glow)',
                      borderRadius: '3px'
                    }} />
                    <div style={{
                      position: 'absolute',
                      bottom: `calc(${((gain + 12) / 24) * 100}% - 4px)`,
                      left: '-2px',
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      boxShadow: 'var(--neon-glow)'
                    }} />
                  </div>
                  <span style={{ fontSize: '0.6rem', fontWeight: 'bold', color: 'white' }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FULLSCREEN MOBILE NOW-PLAYING OVERLAY (Spotify / Apple Music Style) */}
      {showMobileFullPlayer && currentTrack && (
        <div className="mobile-now-playing-overlay">
          {/* Header Bar */}
          <div className="mobile-np-header">
            <button 
              className="mobile-np-dismiss-btn"
              onClick={() => setShowMobileFullPlayer(false)}
            >
              <ChevronDown size={24} />
            </button>
            <span className="mobile-np-title-badge">Now Playing</span>
            <button 
              className="mobile-np-dismiss-btn"
              onClick={() => {
                setShowMobileFullPlayer(false);
                setShowEqPanel(true);
              }}
            >
              <Sliders size={18} />
            </button>
          </div>

          {/* Large Album Art */}
          <div className="mobile-np-art-container">
            <img 
              className="mobile-np-art"
              src={currentTrack.coverArt} 
              alt={currentTrack.title} 
            />
          </div>

          {/* Song Info */}
          <div className="mobile-np-info">
            <div className="mobile-np-song-title">{currentTrack.title}</div>
            <div className="mobile-np-song-artist">{currentTrack.artist}</div>
          </div>

          {/* Interactive Timeline Seeker */}
          <div className="mobile-np-timeline">
            <div className="slider-container">
              <input 
                type="range"
                min={0}
                max={duration || 30}
                step={0.1}
                value={localProgress}
                onChange={handleSliderChange}
                onMouseUp={handleSliderMouseUp}
                onTouchEnd={handleSliderMouseUp}
                disabled={isLockedByHost}
                style={{
                  width: '100%',
                  opacity: 0,
                  position: 'absolute',
                  zIndex: 2,
                  cursor: 'pointer'
                }}
              />
              <div className="slider-track" style={{ height: '6px', borderRadius: '3px' }}>
                <div 
                  className="slider-fill" 
                  style={{ 
                    width: `${progressPercent}%`,
                    backgroundColor: 'var(--primary)' 
                  }} 
                />
                <div 
                  className="slider-handle" 
                  style={{ 
                    left: `${progressPercent}%` 
                  }} 
                />
              </div>
            </div>
            <div className="mobile-np-time-labels">
              <span>{formatSecs(localProgress)}</span>
              <span>{formatSecs(duration)}</span>
            </div>
          </div>

          {/* Media Playback Controls */}
          <div className="mobile-np-controls">
            <button 
              className={`player-control-btn ${shuffle ? 'active' : ''}`}
              onClick={() => setShuffle(!shuffle)}
            >
              <Shuffle size={20} />
            </button>

            <button 
              className="player-control-btn"
              onClick={onPrev}
              disabled={isLockedByHost}
            >
              <SkipBack size={26} />
            </button>

            <button 
              className="mobile-np-play-btn"
              onClick={handleTogglePlay}
              disabled={isLockedByHost}
            >
              {isPlaying ? <Pause size={28} /> : <Play size={28} style={{ marginLeft: '3px' }} />}
            </button>

            <button 
              className="player-control-btn"
              onClick={onNext}
              disabled={isLockedByHost}
            >
              <SkipForward size={26} />
            </button>

            <button 
              className={`player-control-btn ${repeat ? 'active' : ''}`}
              onClick={() => setRepeat(!repeat)}
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
