import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import Sidebar from './components/Sidebar';
import FriendsSidebar from './components/FriendsSidebar';
import Dashboard from './components/Dashboard';
import MusicPlayer from './components/MusicPlayer';
import Login from './components/Login';
import { Bell, X, Users } from 'lucide-react';
import { getBackendUrl } from './config';

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('spotify_jam_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.warn('Failed to parse cached user login:', e);
      localStorage.removeItem('spotify_jam_user');
      return null;
    }
  });

  const [view, setView] = useState('home'); // 'home', 'search', 'jam'
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [toasts, setToasts] = useState([]); // List of active invites
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [showMobileFriends, setShowMobileFriends] = useState(false);
  
  // Collaborative Reactions state
  const [reactions, setReactions] = useState([]);

  // Local Playback States (Used when NOT in a collaborative Jam room)
  const [localCurrentTrack, setLocalCurrentTrack] = useState(null);
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [localProgressMs, setLocalProgressMs] = useState(0);

  // Check URL query parameters for auto-join link on load
  const [pendingRoomJoin, setPendingRoomJoin] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('join') || null;
  });

  // 1. Initialize Socket.io Connection
  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const socketUrl = getBackendUrl();
    console.log('Connecting to socket server at:', socketUrl);
    const newSocket = io(socketUrl, {
      transports: ['websocket'],
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      console.log('Socket connected successfully:', newSocket.id);
      newSocket.emit('user:login', {
        username: user.username,
        avatar: user.avatar
      });

      // Auto-join pending room if link was clicked
      if (pendingRoomJoin) {
        console.log('Auto joining pending room:', pendingRoomJoin);
        newSocket.emit('room:join', {
          roomId: pendingRoomJoin,
          username: user.username
        });
        window.history.replaceState({}, document.title, window.location.pathname);
        setPendingRoomJoin(null);
      }
    });

    newSocket.on('users:online-list', (usersList) => {
      setOnlineUsers(usersList);
    });

    newSocket.on('room:created', (room) => {
      setActiveRoom(room);
      setChatMessages(room.chat || []);
      
      // Stop local audio before entering Room Sync
      setLocalIsPlaying(false);
      
      setView('jam');
      setShowCreateModal(false);
      setNewRoomName('');
    });

    newSocket.on('room:joined', (room) => {
      setActiveRoom(room);
      setChatMessages(room.chat || []);
      
      // Stop local audio before entering Room Sync
      setLocalIsPlaying(false);
      
      setView('jam');
    });

    newSocket.on('room:updated', (room) => {
      setActiveRoom(room);
    });

    newSocket.on('room:left', () => {
      setActiveRoom(null);
      setChatMessages([]);
      if (view === 'jam') {
        setView('home');
      }
    });

    newSocket.on('room:chat-received', (message) => {
      setChatMessages((prev) => [...prev, message]);
    });

    newSocket.on('jam:reaction-received', ({ id, username, emoji }) => {
      setReactions((prev) => [...prev, { id, username, emoji }]);
      setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2500);
    });

    newSocket.on('invite:receive', ({ senderUsername, roomId, roomName }) => {
      const toastId = `toast-${Date.now()}`;
      setToasts((prev) => [
        ...prev,
        {
          id: toastId,
          senderUsername,
          roomId,
          roomName,
          message: `${senderUsername} invited you to join their Jam: "${roomName}"`
        }
      ]);

      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-200.wav');
        audio.volume = 0.3;
        audio.play();
      } catch (e) {}
    });

    newSocket.on('playback:sync', ({ currentTrack, isPlaying, progressMs, lastUpdated }) => {
      setActiveRoom((prevRoom) => {
        if (!prevRoom) return null;
        const latency = Date.now() - lastUpdated;
        const adjustedProgress = isPlaying ? progressMs + latency : progressMs;
        return {
          ...prevRoom,
          currentTrack,
          isPlaying,
          progressMs: adjustedProgress
        };
      });
    });

    newSocket.on('playback:sync-seek', ({ progressMs, lastUpdated }) => {
      setActiveRoom((prevRoom) => {
        if (!prevRoom) return null;
        const latency = Date.now() - lastUpdated;
        const adjustedProgress = prevRoom.isPlaying ? progressMs + latency : progressMs;
        return { ...prevRoom, progressMs: adjustedProgress };
      });
    });

    newSocket.on('auth:duplicate-login', () => {
      alert('You have logged in from another device/window. Disconnecting this session.');
      handleLogout();
    });

    newSocket.on('room:error', (errorMsg) => {
      alert(`Room Error: ${errorMsg}`);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, pendingRoomJoin]);

  // 2. Auth handlers
  const handleLogin = (userData) => {
    localStorage.setItem('spotify_jam_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('spotify_jam_user');
    setUser(null);
    setActiveRoom(null);
    setChatMessages([]);
    setView('home');
    setLocalCurrentTrack(null);
    setLocalIsPlaying(false);
    if (socket) {
      socket.disconnect();
      setSocket(null);
    }
  };

  // 3. Playback triggers (Handles both local solo playback and room synchronized playback)
  const handlePlaySong = (track) => {
    if (!activeRoom) {
      // SOLO LOCAL PLAYBACK
      console.log('Playing song locally (Solo Mode):', track.title);
      setLocalCurrentTrack(track);
      setLocalIsPlaying(true);
      setLocalProgressMs(0);
      return;
    }
    
    // ROOM COLLABORATIVE PLAYBACK
    if (socket) {
      socket.emit('playback:state-change', {
        roomId: activeRoom.id,
        currentTrack: track,
        isPlaying: true,
        progressMs: 0
      });
    }
  };

  const handlePlayPause = (isPlayingState) => {
    if (!activeRoom) {
      setLocalIsPlaying(isPlayingState);
      return;
    }
    if (socket) {
      socket.emit('playback:state-change', {
        roomId: activeRoom.id,
        currentTrack: activeRoom.currentTrack,
        isPlaying: isPlayingState,
        progressMs: activeRoom.progressMs || 0
      });
    }
  };

  const handleSeek = (progressMsValue) => {
    if (!activeRoom) {
      setLocalProgressMs(progressMsValue);
      return;
    }
    if (socket) {
      socket.emit('playback:seek', {
        roomId: activeRoom.id,
        progressMs: progressMsValue
      });
    }
  };

  const handleNextTrack = () => {
    if (!activeRoom) {
      // Local next: just stop or repeat
      setLocalIsPlaying(false);
      return;
    }
    if (activeRoom.queue && activeRoom.queue.length > 0) {
      const nextTrack = activeRoom.queue[0];
      socket.emit('queue:remove', { roomId: activeRoom.id, index: 0 });
      socket.emit('playback:state-change', {
        roomId: activeRoom.id,
        currentTrack: nextTrack,
        isPlaying: true,
        progressMs: 0
      });
    } else {
      handlePlayPause(false);
    }
  };

  const handlePrevTrack = () => {
    handleSeek(0);
  };

  // 4. Queue / Upvote triggers
  const handleAddToQueue = (track) => {
    if (!activeRoom || !socket) return;
    socket.emit('queue:add', { roomId: activeRoom.id, track });
  };

  const handleUpvoteTrack = (trackId) => {
    if (!activeRoom || !socket) return;
    socket.emit('queue:upvote', {
      roomId: activeRoom.id,
      trackId,
      username: user.username
    });
  };

  const handleRemoveFromQueue = (index) => {
    if (!activeRoom || !socket) return;
    socket.emit('queue:remove', { roomId: activeRoom.id, index });
  };

  const handleClearQueue = () => {
    if (!activeRoom || !socket) return;
    socket.emit('queue:clear', { roomId: activeRoom.id });
  };

  // Host toggle settings lock
  const handleToggleRoomLock = (isLocked) => {
    if (!activeRoom || !socket) return;
    socket.emit('room:toggle-lock', {
      roomId: activeRoom.id,
      isLocked
    });
  };

  // Send live reactions
  const handleSendReaction = (emoji) => {
    if (!activeRoom || !socket) return;
    socket.emit('jam:reaction', {
      roomId: activeRoom.id,
      username: user.username,
      emoji
    });
  };

  // 5. Chat triggers
  const handleSendChatMessage = (text) => {
    if (!activeRoom || !socket) return;
    socket.emit('room:chat-send', {
      roomId: activeRoom.id,
      sender: user.username,
      text
    });
  };

  // 6. Invite triggers
  const handleSendInvite = (inviteeUsername) => {
    if (!activeRoom || !socket) return;
    socket.emit('invite:send', {
      senderUsername: user.username,
      inviteeUsername,
      roomId: activeRoom.id,
      roomName: activeRoom.name
    });
  };

  const handleAcceptInvite = (roomId) => {
    if (!socket) return;
    socket.emit('room:join', { roomId, username: user.username });
    setToasts((prev) => prev.filter((t) => t.roomId !== roomId));
  };

  const handleDeclineInvite = (roomId) => {
    setToasts((prev) => prev.filter((t) => t.roomId !== roomId));
  };

  // 7. Room Creation
  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!newRoomName.trim() || !socket) return;
    socket.emit('room:create', {
      roomName: newRoomName.trim(),
      username: user.username
    });
  };

  const handleLeaveRoom = () => {
    if (!activeRoom || !socket) return;
    socket.emit('room:leave', { roomId: activeRoom.id, username: user.username });
  };

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-container">
      {/* Mobile Friends Sidebar Toggle Button */}
      <button
        onClick={() => setShowMobileFriends(!showMobileFriends)}
        className="mobile-friends-toggle"
        title="Toggle Online Users list"
      >
        <Users size={18} />
      </button>
      {/* Toast Notification Overlay */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            <div className="toast-header">
              <Bell size={14} />
              <span>Jam Invitation</span>
            </div>
            <div className="toast-message">{toast.message}</div>
            <div className="toast-actions">
              <button 
                className="toast-btn toast-btn-accept" 
                onClick={() => handleAcceptInvite(toast.roomId)}
              >
                Accept
              </button>
              <button 
                className="toast-btn toast-btn-decline" 
                onClick={() => handleDeclineInvite(toast.roomId)}
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Floating Reactions Overlay */}
      <div style={{
        position: 'fixed',
        bottom: '120px',
        right: '360px',
        zIndex: 50,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column-reverse',
        gap: '10px'
      }}>
        {reactions.map((react) => (
          <div 
            key={react.id} 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: 'rgba(14, 8, 28, 0.85)',
              border: '1px solid rgba(0, 255, 204, 0.3)',
              padding: '6px 12px',
              borderRadius: '20px',
              color: 'white',
              fontSize: '0.8rem',
              animation: 'slide-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
              boxShadow: '0 0 10px rgba(0, 255, 204, 0.15)'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>{react.emoji}</span>
            <strong>{react.username}</strong>
          </div>
        ))}
      </div>

      {/* Create Room Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="modal-title">Create a Jam Session</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateRoom} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Jam Room Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={`e.g. ${user.username}'s Space Grid`}
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="jam-btn jam-btn-secondary" 
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="jam-btn jam-btn-primary"
                >
                  Create Room
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sidebar navigation */}
      <Sidebar 
        currentView={view} 
        setCurrentView={setView} 
        activeRoom={activeRoom}
        onCreateRoomClick={() => setShowCreateModal(true)}
        user={user}
        onLogout={handleLogout}
      />

      {/* Central View Dashboard */}
      <Dashboard 
        user={user}
        view={view}
        setView={setView}
        activeRoom={activeRoom}
        onLeaveRoom={handleLeaveRoom}
        onPlaySong={handlePlaySong}
        onAddToQueue={handleAddToQueue}
        onUpvoteTrack={handleUpvoteTrack}
        onRemoveFromQueue={handleRemoveFromQueue}
        onClearQueue={handleClearQueue}
        onToggleRoomLock={handleToggleRoomLock}
        onSendReaction={handleSendReaction}
        chatMessages={chatMessages}
        onSendChatMessage={handleSendChatMessage}
      />

      {/* Right Online status sidebar */}
      <FriendsSidebar 
        user={user}
        onlineUsers={onlineUsers}
        activeRoom={activeRoom}
        onSendInvite={handleSendInvite}
        className={showMobileFriends ? 'show-mobile-sidebar' : ''}
      />

      {/* Bottom Music playback bar */}
      <MusicPlayer 
        currentTrack={activeRoom ? activeRoom.currentTrack : localCurrentTrack}
        isPlaying={activeRoom ? activeRoom.isPlaying : localIsPlaying}
        progressMs={activeRoom ? activeRoom.progressMs : localProgressMs}
        onPlayPause={handlePlayPause}
        onSeek={handleSeek}
        onNext={handleNextTrack}
        onPrev={handlePrevTrack}
        activeRoom={activeRoom}
        user={user}
      />
    </div>
  );
}
