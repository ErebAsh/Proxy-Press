'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';

export default function GlobalRealtimeListener() {
  const pathname = usePathname();

  useEffect(() => {
    // We only need this if we are NOT on the messages page!
    // MessagesClient handles it when we are on the messages page.
    if (pathname?.startsWith('/messages')) return;

    // Listen for new messages across all conversations
    const channel = supabase
      .channel('global-messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, async (payload) => {
        console.log('[Global Realtime] New message received:', payload);
        
        // Here you can add code to show a toast or update global unread counts
        // if you have a global state manager or context.
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [pathname]);

  return null;
}
