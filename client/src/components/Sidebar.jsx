import React, { useState } from 'react';
import { Home, Search, Music, Users, Plus, LogOut } from 'lucide-react';

export default function Sidebar({ 
  currentView, 
  setCurrentView, 
  activeRoom, 
  onCreateRoomClick, 
  user, 
  onLogout 
}) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <svg viewBox="0 0 24 24">
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.893-.982-.336.076-.67-.135-.746-.47-.077-.337.135-.67.472-.747 3.854-.88 7.15-.506 9.822 1.13.295.18.387.563.207.862zm1.226-2.723c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.08-1.182-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.673-1.114 8.243-.574 11.346 1.334.367.227.487.708.26 1.08zm.106-2.833C14.39 8.71 8.57 8.517 5.2 9.54c-.523.158-1.077-.143-1.235-.665-.158-.523.143-1.078.665-1.236 3.88-1.178 10.31-.96 14.37 1.45.47.28.625.89.346 1.36-.28.47-.89.625-1.36.347z"/>
        </svg>
        <span>NebulaSync</span>
      </div>

      {/* Navigation */}
      <div className="sidebar-nav-card">
        <a 
          href="#home" 
          className={`sidebar-item ${currentView === 'home' ? 'active' : ''}`}
          onClick={(e) => { e.preventDefault(); setCurrentView('home'); }}
        >
          <Home />
          <span>Home</span>
        </a>
        <a 
          href="#search" 
          className={`sidebar-item ${currentView === 'search' ? 'active' : ''}`}
          onClick={(e) => { e.preventDefault(); setCurrentView('search'); }}
        >
          <Search />
          <span>Search</span>
        </a>
        {activeRoom && (
          <a 
            href="#jam" 
            className={`sidebar-item ${currentView === 'jam' ? 'active' : ''}`}
            onClick={(e) => { e.preventDefault(); setCurrentView('jam'); }}
          >
            <Users style={{ stroke: '#9b59b6' }} />
            <span style={{ color: '#d0a2eb' }}>Active Jam</span>
          </a>
        )}
      </div>

      {/* Library */}
      <div className="library-section">
        <div className="library-header">
          <div className="library-header-title">
            <Music />
            <span>Your Library</span>
          </div>
        </div>

        <div className="library-list">
          {activeRoom ? (
            <div 
              className="library-item" 
              style={{ cursor: 'pointer', borderLeft: '3px solid #9b59b6', paddingLeft: '5px' }}
              onClick={() => setCurrentView('jam')}
            >
              <img 
                className="library-item-img" 
                src={activeRoom.currentTrack?.coverArt || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=100&auto=format&fit=crop'} 
                alt="Jam room" 
              />
              <div className="library-item-info">
                <div className="library-item-title">{activeRoom.name}</div>
                <div className="library-item-subtitle">Collaborative Jam</div>
              </div>
            </div>
          ) : (
            <div className="library-item" style={{ opacity: 0.6 }}>
              <div className="library-item-info" style={{ padding: '8px 4px' }}>
                <div className="library-item-title" style={{ fontSize: '0.85rem' }}>No sessions active</div>
                <div className="library-item-subtitle" style={{ fontSize: '0.75rem' }}>Create a jam below!</div>
              </div>
            </div>
          )}

          {/* Quick Mock Playlists */}
          <div className="library-item">
            <img 
              className="library-item-img" 
              src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=100&auto=format&fit=crop" 
              alt="Liked songs" 
            />
            <div className="library-item-info">
              <div className="library-item-title">Liked Songs</div>
              <div className="library-item-subtitle">Playlist • 48 songs</div>
            </div>
          </div>

          <div className="library-item">
            <img 
              className="library-item-img" 
              src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=100&auto=format&fit=crop" 
              alt="Daily mix" 
            />
            <div className="library-item-info">
              <div className="library-item-title">Chill Vibes Mix</div>
              <div className="library-item-subtitle">Playlist • Spotify</div>
            </div>
          </div>
        </div>

        <button className="create-room-btn" onClick={onCreateRoomClick}>
          <Plus size={18} />
          <span>Create Jam</span>
        </button>

        {/* Logout Button */}
        <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
          <button 
            className="sidebar-item" 
            onClick={onLogout} 
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 4px' }}
          >
            <LogOut size={20} style={{ color: '#ff5e5e' }} />
            <span style={{ color: '#ff5e5e' }}>Log Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
