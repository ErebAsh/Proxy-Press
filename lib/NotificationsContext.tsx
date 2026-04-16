'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { notifications as initialNotifications, Notification } from '@/lib/data';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  dismiss: (id: string) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifs, setNotifs] = useState<Notification[]>(initialNotifications);
  const unreadCount = notifs.filter(n => !n.isRead).length;

  const markAllRead = () => {
    setNotifs(ns => ns.map(n => ({ ...n, isRead: true })));
  };

  const markRead = (id: string) => {
    setNotifs(ns => ns.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const dismiss = (id: string) => {
    setNotifs(ns => ns.filter(n => n.id !== id));
  };

  return (
    <NotificationsContext.Provider value={{ notifications: notifs, unreadCount, markAllRead, markRead, dismiss }}>
      {children}
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
