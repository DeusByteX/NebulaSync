import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Shield, User, HelpCircle } from 'lucide-react';

const AVATAR_SEEDS = [
  'Midnight', 'Starlight', 'Vibe', 'Beat', 
  'Echo', 'Sonic', 'Harmony', 'Groove'
];

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_SEEDS[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const getAvatarUrl = (seed) => {
    return `https://api.dicebear.com/7.x/pixel-art/svg?seed=${seed}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername) {
      setError('Please choose a handle to proceed.');
      return;
    }

    if (cleanUsername.length < 3) {
      setError('Handle must be at least 3 characters.');
      return;
    }

    if (cleanPassword && cleanPassword.length < 4) {
      setError('Passwords must be at least 4 characters to secure account.');
      return;
    }

    setLoading(true);
    const chosenAvatarUrl = getAvatarUrl(selectedAvatar);

    try {
      // 1. Primary DB Flow: Try to query Supabase 'users_data' table
      const { data, error: dbError } = await supabase
        .from('users_data')
        .select('*')
        .eq('username', cleanUsername);

      if (!dbError) {
        // Table exists in Supabase!
        if (data && data.length > 0) {
          const dbUser = data[0];
          
          // Case A: User has a password registered in Supabase
          if (dbUser.password) {
            if (!cleanPassword) {
              throw new Error('This handle is registered as a secure account. Please enter the password.');
            }
            if (dbUser.password !== cleanPassword) {
              throw new Error('Incorrect password for this cyber handle.');
            }
          } 
          
          // Case B: User exists as a guest, but enters a password now (Upgrade account!)
          else if (cleanPassword) {
            console.log('Upgrading guest account to secure in Supabase:', cleanUsername);
            const { error: updateError } = await supabase
              .from('users_data')
              .update({ password: cleanPassword })
              .eq('username', cleanUsername);

            if (updateError) throw updateError;
          }

          // Login successful
          onLogin({
            username: dbUser.username,
            avatar: dbUser.avatar,
            isSecure: !!(dbUser.password || cleanPassword),
            dbSource: 'Supabase'
          });
        } else {
          // User does not exist, insert them (automatic registration!)
          console.log('Registering new user in Supabase:', cleanUsername);
          const { error: insertError } = await supabase
            .from('users_data')
            .insert([{ 
              username: cleanUsername, 
              avatar: chosenAvatarUrl, 
              password: cleanPassword || null 
            }]);

          if (insertError) throw insertError;

          onLogin({
            username: cleanUsername,
            avatar: chosenAvatarUrl,
            isSecure: !!cleanPassword,
            dbSource: 'Supabase'
          });
        }
      } else {
        // Supabase table query failed, fall back to local Express server storage
        console.warn('Supabase query failed, falling back to local server:', dbError.message);
        await fallbackLocalAuth(cleanUsername, cleanPassword, chosenAvatarUrl);
      }
    } catch (err) {
      console.error('Database connection error, falling back to local server:', err);
      // Fallback on any error
      setError(err.message || 'Connecting to fallback server...');
      await fallbackLocalAuth(cleanUsername, cleanPassword, chosenAvatarUrl);
    } finally {
      setLoading(false);
    }
  };

  const fallbackLocalAuth = async (usernameVal, passwordVal, avatarUrlVal) => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/login-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: usernameVal, 
          password: passwordVal || null, 
          avatar: avatarUrlVal 
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Server connection failed');
      }
      onLogin({
        username: data.user.username,
        avatar: data.user.avatar,
        isSecure: data.user.isSecure,
        dbSource: 'Local Server'
      });
    } catch (err) {
      setError(err.message || 'Authentication connection failed.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <svg viewBox="0 0 24 24">
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.893-.982-.336.076-.67-.135-.746-.47-.077-.337.135-.67.472-.747 3.854-.88 7.15-.506 9.822 1.13.295.18.387.563.207.862zm1.226-2.723c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.08-1.182-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.673-1.114 8.243-.574 11.346 1.334.367.227.487.708.26 1.08zm.106-2.833C14.39 8.71 8.57 8.517 5.2 9.54c-.523.158-1.077-.143-1.235-.665-.158-.523.143-1.078.665-1.236 3.88-1.178 10.31-.96 14.37 1.45.47.28.625.89.346 1.36-.28.47-.89.625-1.36.347z"/>
          </svg>
          <span>NebulaSync</span>
        </div>
        
        <p className="login-subtitle">
          Initialize connection. Select an avatar and handle.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          {/* Username Input */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={12} />
              <span>Cyber Handle / Username</span>
            </label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. pilot_x"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              maxLength={15}
              required
            />
          </div>

          {/* Password Input (Optional for Guest, Required if Secured) */}
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={12} />
              <span>Password (Secure Account)</span>
            </label>
            <input 
              type="password" 
              className="form-input" 
              placeholder="Leave blank for Guest entry..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
              <HelpCircle size={10} />
              <span>Leave blank for instant guest access, or enter one to secure your handle.</span>
            </span>
          </div>

          {/* Avatar Selector */}
          <div className="avatar-selector">
            <label className="form-label">Select Avatar Core</label>
            <div className="avatar-grid">
              {AVATAR_SEEDS.map((seed) => (
                <button
                  key={seed}
                  type="button"
                  className={`avatar-option ${selectedAvatar === seed ? 'selected' : ''}`}
                  onClick={() => setSelectedAvatar(seed)}
                  disabled={loading}
                >
                  <img 
                    className="avatar-img" 
                    src={getAvatarUrl(seed)} 
                    alt={seed} 
                  />
                </button>
              ))}
            </div>
          </div>

          <button 
            type="submit" 
            className="auth-submit-btn"
            disabled={loading}
          >
            {loading ? 'INITIATING GRID...' : 'ENTER NEBULA GRID'}
          </button>
        </form>
      </div>
    </div>
  );
}
