'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { usePathname } from 'next/navigation';
import { OfflineManager } from '@/lib/offline-manager';

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
        
        const newMsg = payload.new as any;
        if (!newMsg) return;

        const conversationId = newMsg.conversationId || newMsg.conversation_id;
        if (!conversationId) return;

        try {
          // Fetch current messages from cache
          const currentMsgs = await OfflineManager.loadData<any[]>(`msgs_${conversationId}`) || [];
          
          // Prevent duplicate messages in cache
          const exists = currentMsgs.some((m: any) => m.id === newMsg.id);
          if (exists) return;

          // Append new message
          const updatedMsgs = [...currentMsgs, {
            id: newMsg.id,
            senderId: newMsg.sender_id || newMsg.senderId,
            text: newMsg.text,
            timestamp: newMsg.created_at || new Date().toISOString(),
            seen: false,
            type: newMsg.type || 'text',
            attachment: newMsg.attachment,
            status: 'sent'
          }];
          
          // Save back to cache
          await OfflineManager.saveData(`msgs_${conversationId}`, updatedMsgs);
        } catch (error) {
          console.error('[Global Realtime] Error updating cache:', error);
        }
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [pathname]);

  return null;
}
