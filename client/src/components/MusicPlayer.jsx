import React, { useEffect, useRef, useState } from 'react';
import { 
  Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, 
  RefreshCw, Shuffle, Disc, Users 
} from 'lucide-react';

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
  
  // Track synchronization locking (prevents infinite updates)
  const isUpdatingRef = useRef(false);

  // YouTube Player States & Fallbacks
  const [ytReady, setYtReady] = useState(false);
  const [ytPlayFailed, setYtPlayFailed] = useState(false);
  const ytPlayerRef = useRef(null);
  const ytIntervalRef = useRef(null);

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
            // Error codes: 2 (invalid video id), 5 (HTML5 error), 100 (not found/removed), 101/150 (not embeddable)
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

      {/* Left: Album cover details */}
      <div className="player-left">
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
    </div>
  );
}
