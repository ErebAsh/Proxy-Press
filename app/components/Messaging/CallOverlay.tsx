'use client';

import React, { useState, useEffect } from 'react';
import './CallOverlay.css';

interface CallUser {
  id: string;
  name: string;
  avatar: string;
}

interface CallOverlayProps {
  type: 'voice' | 'video';
  mode: 'incoming' | 'outgoing' | 'connected';
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
  const status = mode === 'connected' ? 'connected' : 'ringing';
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Timer for connected state
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={`call-overlay ${status === 'ringing' ? 'ringing' : ''} ${status === 'connected' ? 'connected' : ''}`}>
      {/* Background Video (Connected State Only) */}
      {status === 'connected' && type === 'video' && (
        <div className="video-container">
          <div id="remote-player" className="remote-video"></div>
          <div id="local-player" className="local-video"></div>
        </div>
      )}

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
          {status === 'connected' 
            ? formatTime(callDuration) 
            : mode === 'incoming' 
              ? `Incoming ${type === 'video' ? 'Video' : 'Voice'} Call...` 
              : `${type === 'video' ? 'Video' : 'Voice'} Calling...`}
        </p>
      </div>

      {/* Controls */}
      {mode === 'incoming' && status === 'ringing' ? (
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
          <button 
            className={`control-btn ${isMuted ? 'muted' : ''}`}
            onClick={() => setIsMuted(!isMuted)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isMuted ? (
                <>
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </>
              ) : (
                <>
                  <path d="M12 1v11a3 3 0 0 1-3-3V4a3 3 0 0 1 6 0v5a3 3 0 0 1-3 3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </>
              )}
            </svg>
          </button>

          <button className="control-btn end-call" onClick={onEnd}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
            </svg>
          </button>

          {type === 'video' && (
            <button 
              className={`control-btn ${isVideoOff ? 'muted' : ''}`}
              onClick={() => setIsVideoOff(!isVideoOff)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {isVideoOff ? (
                  <>
                    <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </>
                )}
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
