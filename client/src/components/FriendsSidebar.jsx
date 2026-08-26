import React from 'react';
import { Share2, Volume2 } from 'lucide-react';

export default function FriendsSidebar({ user, onlineUsers, activeRoom, onSendInvite, className = '' }) {
  // Exclude the current user from the list
  const otherUsers = onlineUsers.filter(u => u.username !== user.username);

  return (
    <aside className={`friends-sidebar ${className}`}>
      {/* Current User Card */}
      <div className="user-profile-badge">
        <img className="user-avatar" src={user.avatar} alt={user.username} />
        <div className="user-profile-info">
          <div className="user-profile-name">{user.username}</div>
          <div className="user-profile-status">
            <span className="status-indicator online" style={{ position: 'static', display: 'inline-block', width: '8px', height: '8px' }}></span>
            <span>Online</span>
          </div>
        </div>
      </div>

      {/* Friends Header */}
      <div className="friends-header">
        <h3>Friend Activity</h3>
        <Share2 size={16} style={{ color: 'var(--text-muted)' }} />
      </div>

      {/* List of other online users */}
      <div className="friend-list">
        {otherUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No other friends online. Open another tab and log in to test jamming!
          </div>
        ) : (
          otherUsers.map((friend) => {
            const isJamming = friend.status === 'jamming';
            const isInSameRoom = activeRoom && friend.currentRoom === activeRoom.id;
            
            // Format status label
            let statusLabel = 'Online';
            if (isJamming) {
              statusLabel = isInSameRoom ? 'In your Jam' : 'Jamming';
            }

            return (
              <div className="friend-card" key={friend.username}>
                <div className="friend-main-info">
                  <div className="friend-avatar-container">
                    <img className="friend-avatar" src={friend.avatar} alt={friend.username} />
                    <span className={`status-indicator ${friend.status}`}></span>
                  </div>
                  <div className="friend-details">
                    <div className="friend-name">{friend.username}</div>
                    <div className="friend-status-text">
                      {isJamming && !isInSameRoom ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b987db' }}>
                          <Volume2 size={12} />
                          Listening
                        </span>
                      ) : (
                        statusLabel
                      )}
                    </div>
                  </div>
                </div>

                {/* Invite Button */}
                <button
                  className="invite-btn"
                  disabled={!activeRoom || isInSameRoom}
                  onClick={() => onSendInvite(friend.username)}
                  title={!activeRoom ? 'Join or create a Jam Room to invite friends' : isInSameRoom ? 'Already in this Jam' : `Invite ${friend.username} to Jam`}
                >
                  Invite
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
