'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useIdentity } from '@/lib/IdentityContext';
import CallOverlay from '@/app/components/Messaging/CallOverlay';

interface GlobalCallState {
  type: 'voice' | 'video';
  mode: 'incoming' | 'outgoing';
  user: {
    id: string;
    name: string;
    avatar: string;
  };
  channelName: string;
}

export default function GlobalCallManager() {
  const { currentUserId, currentUser } = useIdentity();
  const [activeCall, setActiveCall] = useState<GlobalCallState | null>(null);
  
  const activeCallRef = useRef<GlobalCallState | null>(null);
  const pusherRef = useRef<any>(null);

  // Sync ref to avoid stale closures in event handlers
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // Sync calling state to URL and body class for global UI awareness (like hiding footer)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const params = new URLSearchParams(window.location.search);
    if (activeCall) {
      params.set('calling', 'true');
      document.body.classList.add('calling-active');
    } else {
      params.delete('calling');
      document.body.classList.remove('calling-active');
    }
    const newSearch = params.toString();
    const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`;
    window.history.replaceState(null, '', newUrl);

    return () => {
      document.body.classList.remove('calling-active');
    };
  }, [activeCall]);

  // 1. Pusher Subscriptions for Real-Time Call Events (Active Foreground App)
  useEffect(() => {
    if (!currentUserId || currentUserId === 'me') return;

    let pusher: any;
    let userChannel: any;

    async function setupPusherCalling() {
      try {
        const PusherClient = (await import('pusher-js')).default;
        pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
          authEndpoint: '/api/pusher/auth',
        });
        pusherRef.current = pusher;

        userChannel = pusher.subscribe(`private-user-${currentUserId}`);

        // Listen for Incoming Calls (when app is in foreground)
        userChannel.bind('incoming-call', (data: any) => {
          console.log('[Global Call] Pusher incoming-call event:', data);
          
          if (activeCallRef.current) {
            console.log('[Global Call] Busy: Rejecting call');
            fetch('/api/messages/call', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                targetUserId: data.caller.id,
                event: 'call-rejected'
              })
            }).catch(() => {});
            return;
          }

          setActiveCall({
            type: data.type || 'voice',
            mode: 'incoming',
            user: {
              id: data.caller.id,
              name: data.caller.name || 'Someone',
              avatar: data.caller.avatar || ''
            },
            channelName: data.channelName
          });
        });

        // Listen for Peer Accepting Call → launch native connected call activity
        userChannel.bind('call-accepted', () => {
          console.log('[Global Call] Pusher call-accepted event');
          if (activeCallRef.current?.mode === 'outgoing') {
            const current = activeCallRef.current;
            // Launch native ConnectedCallActivity
            try {
              if ((window as any).AndroidCallBridge?.launchConnectedCall) {
                (window as any).AndroidCallBridge.launchConnectedCall(
                  current.channelName,
                  current.user.id,
                  current.user.name,
                  current.type
                );
              }
            } catch (err) {
              console.error('[Global Call] Error launching native call:', err);
            }
            // Dismiss the WebView overlay
            setActiveCall(null);
          }
        });

        // Listen for Peer Rejecting Call
        userChannel.bind('call-rejected', () => {
          console.log('[Global Call] Pusher call-rejected event');
          setActiveCall(null);
        });

        // Listen for Peer Ending Call
        userChannel.bind('call-ended', () => {
          console.log('[Global Call] Pusher call-ended event');
          setActiveCall(null);
        });
      } catch (err) {
        console.error('[Global Call] Pusher setup error:', err);
      }
    }

    setupPusherCalling();

    return () => {
      if (userChannel) userChannel.unbind_all();
      if (pusher) pusher.disconnect();
    };
  }, [currentUserId]);

  // 2. Listen to Custom Event to start Outgoing Call from Chat UI
  useEffect(() => {
    const handleInitiateCall = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { type, channelName, user, currentUserId: callerId } = customEvent.detail;
      console.log('[Global Call] Outgoing call initiated:', type, channelName, user);

      setActiveCall({
        type,
        mode: 'outgoing',
        user: {
          id: user.id,
          name: user.name,
          avatar: user.profilePicture || user.avatar || ''
        },
        channelName
      });

      try {
        await fetch('/api/messages/call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetUserId: user.id,
            event: 'incoming-call',
            channelName,
            type,
            caller: {
              id: callerId,
              name: currentUser?.name || 'User',
              avatar: currentUser?.profilePicture || currentUser?.avatar || ''
            }
          })
        });
      } catch (err) {
        console.error('[Global Call] Outgoing call start failed:', err);
        setActiveCall(null);
      }
    };

    window.addEventListener('initiate-global-call', handleInitiateCall);
    return () => {
      window.removeEventListener('initiate-global-call', handleInitiateCall);
    };
  }, [currentUser]);

  // Accept: notify caller + launch native ConnectedCallActivity
  const handleAcceptCall = async () => {
    const current = activeCallRef.current;
    if (!current || !current.channelName) return;

    // Notify caller
    try {
      await fetch('/api/messages/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: current.user.id,
          event: 'call-accepted'
        })
      });
    } catch (err) {
      console.error('[Global Call] Error notifying caller of accept:', err);
    }

    // Launch native connected call activity
    try {
      if ((window as any).AndroidCallBridge?.launchConnectedCall) {
        (window as any).AndroidCallBridge.launchConnectedCall(
          current.channelName,
          current.user.id,
          current.user.name,
          current.type
        );
      }
    } catch (err) {
      console.error('[Global Call] Error launching native call:', err);
    }

    // Dismiss the overlay
    setActiveCall(null);
  };

  const handleDeclineCall = async () => {
    const current = activeCallRef.current;
    if (current) {
      await fetch('/api/messages/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: current.user.id,
          event: 'call-rejected'
        })
      }).catch(() => {});
    }
    setActiveCall(null);
  };

  const handleEndCall = async () => {
    const current = activeCallRef.current;
    if (current) {
      fetch('/api/messages/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: current.user.id,
          event: 'call-ended'
        })
      }).catch(() => {});
    }
    setActiveCall(null);
  };

  if (!activeCall) return null;

  return (
    <CallOverlay
      type={activeCall.type}
      mode={activeCall.mode}
      targetUser={{
        id: activeCall.user.id,
        name: activeCall.user.name,
        avatar: activeCall.user.avatar || 'https://via.placeholder.com/150'
      }}
      onAccept={handleAcceptCall}
      onDecline={handleDeclineCall}
      onEnd={handleEndCall}
    />
  );
}
