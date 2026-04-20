'use client';

import { useEffect, useState } from 'react';
import { Notification } from '@/lib/data';
import Link from 'next/link';

interface Props {
  notification: Notification | null;
  onClose: () => void;
}

export default function NotificationToast({ notification, onClose }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for fade out animation
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification) return null;

  return (
    <div className={`notification-toast ${isVisible ? 'visible' : ''}`}>
      <Link 
        href="/notifications" 
        onClick={onClose}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none', width: '100%' }}
      >
        <div className="toast-avatar">
          {notification.actorAvatar.length > 2 ? (
            <img src={notification.actorAvatar} alt="" />
          ) : (
            <div className="avatar-emoji">{notification.actorAvatar}</div>
          )}
        </div>
        <div className="toast-content">
          <p className="toast-text">
            <span className="toast-actor">{notification.actor}</span> {notification.message}
          </p>
          <span className="toast-time">{notification.timeAgo}</span>
        </div>
      </Link>
      <button className="toast-close" onClick={() => setIsVisible(false)}>×</button>
    </div>
  );
}
