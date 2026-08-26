import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Persistent Users File
const USERS_FILE = path.join(__dirname, 'users.json');

// Initialize users database
let users = {};
if (fs.existsSync(USERS_FILE)) {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    users = JSON.parse(data);
  } catch (err) {
    console.error('Error loading users.json:', err);
    users = {};
  }
}

const saveUsers = () => {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (err) {
    console.error('Error saving users.json:', err);
  }
};

// Permanent SoundHelix test streams for failover fallback
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

// Global State
const activeSockets = new Map();
const onlineUsers = new Map();
const rooms = new Map();

// Helper to update and broadcast online users
const broadcastOnlineUsers = () => {
  const usersList = [];
  onlineUsers.forEach((data, username) => {
    usersList.push({
      username,
      avatar: data.avatar,
      status: data.status,
      currentRoom: data.currentRoom,
    });
  });
  io.emit('users:online-list', usersList);
};

// Hybrid password / passwordless auth route (Auto-register + local cache validation)
app.post('/api/auth/login-username', (req, res) => {
  const { username, password, avatar } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  const cleanUsername = username.trim().toLowerCase();
  const existingUser = users[cleanUsername];

  if (existingUser) {
    if (existingUser.password) {
      if (!password) {
        return res.status(401).json({ error: 'This handle is registered as a secure account. Please enter the password.' });
      }
      if (existingUser.password !== password) {
        return res.status(401).json({ error: 'Incorrect password for this cyber handle.' });
      }
    } else {
      if (password) {
        existingUser.password = password;
        if (avatar) existingUser.avatar = avatar;
        users[cleanUsername] = existingUser;
        saveUsers();
        console.log(`Upgraded guest user "${cleanUsername}" to secure password account.`);
      }
    }
  } else {
    users[cleanUsername] = {
      username: username.trim(),
      password: password || null,
      avatar: avatar || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${username.trim()}`,
      createdAt: new Date().toISOString()
    };
    saveUsers();
    console.log(`Registered new user "${cleanUsername}" (${password ? 'Secure' : 'Guest'}).`);
  }

  res.status(200).json({
    message: 'Authentication successful',
    user: {
      username: users[cleanUsername].username,
      avatar: users[cleanUsername].avatar,
      isSecure: !!users[cleanUsername].password
    }
  });
});

// Fetch Real-time Trending Top Charts from iTunes API Feed (Graceful Local Fallback on DNS ENOTFOUND)
app.get('/api/music/trending', async (req, res) => {
  try {
    const response = await fetch('https://rss.applemediaservices.com/api/v2/us/music/most-played/24/songs.json');
    if (!response.ok) throw new Error(`HTTP status ${response.status}`);
    const data = await response.json();
    if (data.feed && data.feed.results) {
      const formatted = data.feed.results.map((item) => ({
        trackId: `trend-${item.id}`,
        title: item.name,
        artist: item.artistName,
        album: item.collectionName || 'Single Chart',
        coverArt: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '400x400bb') : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop',
        audioUrl: '',
        durationMs: 240000,
        source: 'chart'
      }));
      return res.status(200).json({ results: formatted });
    }
    throw new Error('Malformed feed JSON structure');
  } catch (err) {
    console.warn('Trending RSS Feed failed (using local failover suggestion index):', err.message);
    // Gracefully return local suggested tracks to keep client working
    return res.status(200).json({ results: LOCAL_FALLBACK_TRACKS });
  }
});

// Fetch Real-time New Releases worldwide (Graceful Local Fallback)
app.get('/api/music/new-releases', async (req, res) => {
  try {
    const response = await fetch('https://rss.applemediaservices.com/api/v2/us/music/new-releases/24/songs.json');
    if (!response.ok) throw new Error(`HTTP status ${response.status}`);
    const data = await response.json();
    if (data.feed && data.feed.results) {
      const formatted = data.feed.results.map((item) => ({
        trackId: `new-${item.id}`,
        title: item.name,
        artist: item.artistName,
        album: item.collectionName || 'New Single',
        coverArt: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '400x400bb') : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=300&auto=format&fit=crop',
        audioUrl: '',
        durationMs: 240000,
        source: 'new'
      }));
      return res.status(200).json({ results: formatted });
    }
    throw new Error('Malformed feed JSON structure');
  } catch (err) {
    console.warn('New Releases RSS Feed failed (using local failover suggestion index):', err.message);
    // Gracefully return local suggested tracks to keep client working
    return res.status(200).json({ results: LOCAL_FALLBACK_TRACKS });
  }
});

// Universal Search Route: Combines high-quality studio iTunes items + web remixes/bootlegs from YouTube
app.get('/api/music/search', async (req, res) => {
  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'Query is required' });
  
  try {
    // Run search requests concurrently
    const [itunesRes, ytRes] = await Promise.all([
      fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=14`).catch(() => null),
      fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }).catch(() => null)
    ]);

    const itunesTracks = [];
    if (itunesRes && itunesRes.ok) {
      const itunesData = await itunesRes.json();
      if (itunesData.results) {
        itunesData.results.forEach((item) => {
          itunesTracks.push({
            trackId: String(item.trackId),
            title: item.trackName,
            artist: item.artistName,
            album: item.collectionName || 'Single',
            coverArt: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '400x400bb') : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=300&auto=format&fit=crop',
            audioUrl: item.previewUrl || '',
            durationMs: item.trackTimeMillis || 240000,
            source: 'studio'
          });
        });
      }
    }

    // Parse YouTube HTML search items for unofficial remixes, singles, fan edits
    const ytTracks = [];
    if (ytRes && ytRes.ok) {
      const html = await ytRes.text();
      const regex = /"videoRenderer":\{"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"(.*?)"\}\].*?"longBylineText":\{"runs":\[\{"text":"(.*?)"\}/g;
      
      let match;
      let count = 0;
      while ((match = regex.exec(html)) !== null && count < 8) {
        const videoId = match[1];
        const title = match[2]
          .replace(/\\u0026/g, '&')
          .replace(/\\"/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&#39;/g, "'");
        const artist = match[3]
          .replace(/\\u0026/g, '&')
          .replace(/\\"/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&#39;/g, "'");

        ytTracks.push({
          trackId: `yt-${videoId}`,
          title: title,
          artist: artist,
          album: 'YouTube Web Stream',
          coverArt: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          youtubeId: videoId,
          audioUrl: '',
          durationMs: 240000,
          source: 'remix'
        });
        count++;
      }
    }

    // Combine: Official releases first, followed by unofficial remix web streams
    const combined = [...itunesTracks, ...ytTracks];
    return res.status(200).json({ results: combined });
  } catch (err) {
    console.error('Universal search failed:', err);
    return res.status(500).json({ error: 'Search failed' });
  }
});

// Dynamic Resolver: Resolves track names to YouTube Video IDs for full-length streams on-the-fly (In-Memory Cached)
const youtubeCache = new Map();

app.post('/api/music/resolve', async (req, res) => {
  const { title, artist } = req.body;
  if (!title || !artist) return res.status(400).json({ error: 'Title and artist are required' });
  
  const cacheKey = `${artist.trim().toLowerCase()} - ${title.trim().toLowerCase()}`;
  if (youtubeCache.has(cacheKey)) {
    const cached = youtubeCache.get(cacheKey);
    console.log(`[Cache Hit] Resolved instantly from memory: "${cacheKey}"`);
    return res.status(200).json(cached);
  }

  try {
    const query = `${artist} ${title} audio`;
    const searchTerm = `${artist} ${title}`;
    console.log(`[Cache Miss] Resolving streams in parallel: "${artist} - ${title}"`);

    // Fetch YouTube and iTunes in parallel to avoid sequential latency
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

    const result = { youtubeId, audioUrl, durationMs };
    youtubeCache.set(cacheKey, result);

    console.log(`Resolved: videoId="${youtubeId}" audioUrl="${audioUrl}"`);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Failed to resolve track streams:', err);
    res.status(500).json({ error: 'Failed to resolve streams' });
  }
});

// Socket.io Real-time logic
io.on('connection', (socket) => {
  socket.on('user:login', ({ username, avatar }) => {
    if (!username) return;
    const existing = onlineUsers.get(username);
    if (existing) {
      const oldSocket = io.sockets.sockets.get(existing.socketId);
      if (oldSocket) {
        oldSocket.emit('auth:duplicate-login');
        oldSocket.disconnect(true);
      }
    }
    activeSockets.set(socket.id, { username, avatar });
    onlineUsers.set(username, {
      socketId: socket.id,
      avatar,
      status: 'online',
      currentRoom: null,
    });
    broadcastOnlineUsers();
  });

  // Room Management
  socket.on('room:create', ({ roomName, username }) => {
    const roomId = `room-${Math.random().toString(36).substring(2, 9)}`;
    const newRoom = {
      id: roomId,
      name: roomName || `${username}'s Session`,
      host: username,
      members: [username],
      currentTrack: null,
      isPlaying: false,
      progressMs: 0,
      lastUpdated: Date.now(),
      queue: [],
      chat: [],
      isLocked: false
    };
    rooms.set(roomId, newRoom);
    socket.join(roomId);
    
    const userData = onlineUsers.get(username);
    if (userData) {
      userData.status = 'jamming';
      userData.currentRoom = roomId;
      onlineUsers.set(username, userData);
    }
    socket.emit('room:created', newRoom);
    broadcastOnlineUsers();
  });

  socket.on('room:join', ({ roomId, username }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('room:error', 'Room not found');
      return;
    }
    const userData = onlineUsers.get(username);
    if (userData && userData.currentRoom && userData.currentRoom !== roomId) {
      socket.leave(userData.currentRoom);
      const prevRoom = rooms.get(userData.currentRoom);
      if (prevRoom) {
        prevRoom.members = prevRoom.members.filter(m => m !== username);
        if (prevRoom.members.length === 0) {
          rooms.delete(userData.currentRoom);
        } else {
          if (prevRoom.host === username) {
            prevRoom.host = prevRoom.members[0];
          }
          io.to(userData.currentRoom).emit('room:updated', prevRoom);
        }
      }
    }
    socket.join(roomId);
    if (!room.members.includes(username)) {
      room.members.push(username);
    }
    if (userData) {
      userData.status = 'jamming';
      userData.currentRoom = roomId;
      onlineUsers.set(username, userData);
    }
    rooms.set(roomId, room);
    socket.emit('room:joined', room);
    io.to(roomId).emit('room:updated', room);
    
    const systemMsg = {
      id: `msg-${Date.now()}`,
      sender: 'System',
      text: `${username} joined the Jam!`,
      timestamp: Date.now(),
      isSystem: true
    };
    room.chat.push(systemMsg);
    io.to(roomId).emit('room:chat-received', systemMsg);
    broadcastOnlineUsers();
  });

  // Toggle Room Controls Lock
  socket.on('room:toggle-lock', ({ roomId, isLocked }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.isLocked = isLocked;
    rooms.set(roomId, room);
    io.to(roomId).emit('room:updated', room);
    
    const systemMsg = {
      id: `msg-${Date.now()}`,
      sender: 'System',
      text: isLocked ? 'Host locked playback controls (Host Only).' : 'Host unlocked playback controls (Collaborative).',
      timestamp: Date.now(),
      isSystem: true
    };
    room.chat.push(systemMsg);
    io.to(roomId).emit('room:chat-received', systemMsg);
  });

  socket.on('room:leave', ({ roomId, username }) => {
    socket.leave(roomId);
    const room = rooms.get(roomId);
    if (room) {
      room.members = room.members.filter(m => m !== username);
      const systemMsg = {
        id: `msg-${Date.now()}`,
        sender: 'System',
        text: `${username} left the Jam.`,
        timestamp: Date.now(),
        isSystem: true
      };
      room.chat.push(systemMsg);
      io.to(roomId).emit('room:chat-received', systemMsg);
      if (room.members.length === 0) {
        rooms.delete(roomId);
      } else {
        if (room.host === username) {
          room.host = room.members[0];
          const newHostMsg = {
            id: `msg-${Date.now()}`,
            sender: 'System',
            text: `${room.host} is now the host.`,
            timestamp: Date.now(),
            isSystem: true
          };
          room.chat.push(newHostMsg);
          io.to(roomId).emit('room:chat-received', newHostMsg);
        }
        rooms.set(roomId, room);
        io.to(roomId).emit('room:updated', room);
      }
    }
    const userData = onlineUsers.get(username);
    if (userData) {
      userData.status = 'online';
      userData.currentRoom = null;
      onlineUsers.set(username, userData);
    }
    socket.emit('room:left');
    broadcastOnlineUsers();
  });

  // Collaborative Playback Sync
  socket.on('playback:state-change', ({ roomId, currentTrack, isPlaying, progressMs }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.currentTrack = currentTrack;
    room.isPlaying = isPlaying;
    room.progressMs = progressMs;
    room.lastUpdated = Date.now();
    rooms.set(roomId, room);
    socket.to(roomId).emit('playback:sync', {
      currentTrack,
      isPlaying,
      progressMs,
      lastUpdated: room.lastUpdated
    });
  });

  socket.on('playback:seek', ({ roomId, progressMs }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.progressMs = progressMs;
    room.lastUpdated = Date.now();
    rooms.set(roomId, room);
    socket.to(roomId).emit('playback:seek', {
      progressMs,
      lastUpdated: room.lastUpdated
    });
  });

  // Queue Management
  socket.on('queue:add', ({ roomId, track }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const trackWithVotes = { ...track, upvotes: [] };
    room.queue.push(trackWithVotes);
    rooms.set(roomId, room);
    io.to(roomId).emit('room:updated', room);
  });

  // Queue Voting System
  socket.on('queue:upvote', ({ roomId, trackId, username }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const track = room.queue.find(t => t.trackId === trackId);
    if (track) {
      if (!track.upvotes) track.upvotes = [];
      const index = track.upvotes.indexOf(username);
      if (index === -1) {
        track.upvotes.push(username);
      } else {
        track.upvotes.splice(index, 1);
      }
      room.queue.sort((a, b) => (b.upvotes?.length || 0) - (a.upvotes?.length || 0));
      rooms.set(roomId, room);
      io.to(roomId).emit('room:updated', room);
    }
  });

  socket.on('queue:remove', ({ roomId, index }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    if (index >= 0 && index < room.queue.length) {
      room.queue.splice(index, 1);
      rooms.set(roomId, room);
      io.to(roomId).emit('room:updated', room);
    }
  });

  socket.on('queue:clear', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    room.queue = [];
    rooms.set(roomId, room);
    io.to(roomId).emit('room:updated', room);
  });

  // Chat Messages
  socket.on('room:chat-send', ({ roomId, sender, text }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    const message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender,
      text,
      timestamp: Date.now(),
      isSystem: false
    };
    room.chat.push(message);
    if (room.chat.length > 100) room.chat.shift();
    rooms.set(roomId, room);
    io.to(roomId).emit('room:chat-received', message);
  });

  // Live Emojis Reaction
  socket.on('jam:reaction', ({ roomId, username, emoji }) => {
    io.to(roomId).emit('jam:reaction-received', {
      id: `reaction-${Date.now()}-${Math.random()}`,
      username,
      emoji
    });
  });

  // Invites
  socket.on('invite:send', ({ senderUsername, inviteeUsername, roomId, roomName }) => {
    const invitee = onlineUsers.get(inviteeUsername);
    if (invitee && invitee.socketId) {
      io.to(invitee.socketId).emit('invite:receive', { senderUsername, roomId, roomName });
    }
  });

  // Handle Disconnection
  socket.on('disconnect', () => {
    const userSession = activeSockets.get(socket.id);
    if (userSession) {
      const { username } = userSession;
      const userData = onlineUsers.get(username);
      if (userData && userData.currentRoom) {
        const roomId = userData.currentRoom;
        const room = rooms.get(roomId);
        if (room) {
          room.members = room.members.filter(m => m !== username);
          const systemMsg = {
            id: `msg-${Date.now()}`,
            sender: 'System',
            text: `${username} went offline.`,
            timestamp: Date.now(),
            isSystem: true
          };
          room.chat.push(systemMsg);
          io.to(roomId).emit('room:chat-received', systemMsg);
          if (room.members.length === 0) {
            rooms.delete(roomId);
          } else {
            if (room.host === username) {
              room.host = room.members[0];
              const newHostMsg = {
                id: `msg-${Date.now()}`,
                sender: 'System',
                text: `${room.host} is now the host.`,
                timestamp: Date.now(),
                isSystem: true
              };
              room.chat.push(newHostMsg);
              io.to(roomId).emit('room:chat-received', newHostMsg);
            }
            rooms.set(roomId, room);
            io.to(roomId).emit('room:updated', room);
          }
        }
      }
      onlineUsers.delete(username);
      activeSockets.delete(socket.id);
      broadcastOnlineUsers();
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
