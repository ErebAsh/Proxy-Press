'use client';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Notification } from '@/lib/data';
import { getNotificationsAction, markNotificationRead, dismissNotification } from '@/lib/actions';
import { formatTimeAgo } from './utils';
import NotificationToast from '@/app/components/ui/NotificationToast';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  dismiss: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [activeToast, setActiveToast] = useState<Notification | null>(null);
  const isInitialLoad = useRef(true);
  const unreadCount = notifs.filter(n => !n.isRead).length;

  useEffect(() => {
    async function load() {
      try {
        const dbNotifs = await getNotificationsAction();
        const mapped = dbNotifs.map((n: any) => ({
          id: n.id,
          type: n.type,
          actor: n.actor?.name || 'Someone',
          actorAvatar: n.actor?.profilePicture || n.actor?.avatar || '👤',
          message: n.message,
          timeAgo: formatTimeAgo(n.createdAt || n.timeAgo),
          isRead: n.isRead,
          postTitle: n.post?.title,
        }));

        // Detect new notifications for toast
        if (!isInitialLoad.current && mapped.length > 0) {
          const newNotifs = mapped.filter(n => !n.isRead && !notifs.some(prev => prev.id === n.id));
          if (newNotifs.length > 0) {
            setActiveToast(newNotifs[0]); // Show the newest one
          }
        }

        setNotifs(mapped);
        isInitialLoad.current = false;
      } catch (err) {
        console.error('Failed to load notifications in context:', err);
      }
    }
    load();
    // Poll for notifications
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const markAllRead = () => {
    setNotifs(ns => ns.map(n => ({ ...n, isRead: true })));
  };

  const markRead = (id: string) => {
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, isRead: true } : n));
    markNotificationRead(id).catch(err => console.error('Failed to mark read in DB:', err));
  };

  const dismiss = (id: string) => {
    setNotifs(ns => ns.filter(n => n.id !== id));
    dismissNotification(id).catch(err => console.error('Failed to dismiss in DB:', err));
  };

  return (
    <NotificationsContext.Provider value={{ notifications: notifs, unreadCount, markAllRead, markRead, dismiss }}>
      {children}
      <NotificationToast 
        notification={activeToast} 
        onClose={() => setActiveToast(null)} 
      />
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}
