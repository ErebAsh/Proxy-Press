'use client';

import React from 'react';
import './CallOverlay.css';

interface CallUser {
  id: string;
  name: string;
  avatar: string;
}

interface CallOverlayProps {
  type: 'voice' | 'video';
  mode: 'incoming' | 'outgoing';
  targetUser: CallUser;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
}

export default function CallOverlay({
  type,
  mode,
  targetUser,
  onAccept,
  onDecline,
  onEnd
}: CallOverlayProps) {
  return (
    <div className="call-overlay ringing">
      {/* Header Info */}
      <div className="call-header">
        <div className="caller-avatar-container">
          <div className="pulse-ring"></div>
          <div className="pulse-ring"></div>
          <img 
            src={targetUser.avatar} 
            alt={targetUser.name} 
            className="caller-avatar" 
          />
        </div>
        <h2 className="caller-name">{targetUser.name}</h2>
        <p className="call-status">
          {mode === 'incoming' 
            ? `Incoming ${type === 'video' ? 'Video' : 'Voice'} Call...` 
            : `${type === 'video' ? 'Video' : 'Voice'} Calling...`}
        </p>
      </div>

      {/* Controls */}
      {mode === 'incoming' ? (
        <div className="incoming-actions">
          <div className="action-wrapper">
            <button className="control-btn end-call" onClick={onDecline}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
                <line x1="23" y1="1" x2="1" y2="23" />
              </svg>
            </button>
            <span className="action-label">Decline</span>
          </div>
          <div className="action-wrapper">
            <button className="control-btn accept-call" onClick={onAccept}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
            <span className="action-label">Accept</span>
          </div>
        </div>
      ) : (
        <div className="call-controls">
          <button className="control-btn end-call" onClick={onEnd}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
