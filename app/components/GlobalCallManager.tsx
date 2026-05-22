'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useIdentity } from '@/lib/IdentityContext';
import CallOverlay from '@/app/components/Messaging/CallOverlay';

interface GlobalCallState {
  type: 'voice' | 'video';
  mode: 'incoming' | 'outgoing' | 'connected';
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
  
  const agoraClient = useRef<any>(null);
  const localTracks = useRef<any[]>([]);
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

  // Handle Agora RTC connection when transition to 'connected'
  useEffect(() => {
    if (activeCall?.mode === 'connected' && !agoraClient.current) {
      joinAgoraChannel();
    }
  }, [activeCall?.mode]);

  // Clean up RTC on component unmount
  useEffect(() => {
    return () => {
      cleanupRTC();
    };
  }, []);

  // 1. Pusher Subscriptions for Real-Time Call Events (Active Foreground App)
  useEffect(() => {
    if (!currentUserId || currentUserId === 'me') return;

    let pusher: any;
    let userChannel: any;

    async function setupPusherCalling() {
      try {
        const PusherClient = (await import('pusher-js')).default;
        // Re-use existing Pusher client if available globally, or create new
        pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
          cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
          authEndpoint: '/api/pusher/auth',
        });
        pusherRef.current = pusher;

        userChannel = pusher.subscribe(`private-user-${currentUserId}`);

        // Listen for Incoming Calls
        userChannel.bind('incoming-call', (data: any) => {
          console.log('[Global Call] Pusher incoming-call event:', data);
          
          // Only accept if not already in a call
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

        // Listen for Peer Accepting Call
        userChannel.bind('call-accepted', () => {
          console.log('[Global Call] Pusher call-accepted event');
          if (activeCallRef.current?.mode === 'outgoing') {
            setActiveCall(prev => prev ? { ...prev, mode: 'connected' } : null);
          }
        });

        // Listen for Peer Rejecting Call
        userChannel.bind('call-rejected', () => {
          console.log('[Global Call] Pusher call-rejected event');
          setActiveCall(null);
          cleanupRTC();
        });

        // Listen for Peer Ending Call
        userChannel.bind('call-ended', () => {
          console.log('[Global Call] Pusher call-ended event');
          setActiveCall(null);
          cleanupRTC();
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

  // 2. Capacitor Android Calling Bridge (Native Call Intent & Cold Start Hooks)
  useEffect(() => {
    // A. Listen to Warm Start / Backgrounded Call Accepted events
    const handleNativeCallAccepted = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { channel, callerId, callerName, callType } = customEvent.detail;
      console.log('[Global Call] Warm start call accepted from Native activity:', channel, callerId, callerName, callType);

      // Notify caller
      fetch('/api/messages/call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: callerId,
          event: 'call-accepted'
        })
      }).catch(err => console.error('[Global Call] Error sending call accepted notification:', err));

      setActiveCall({
        type: callType === 'video' ? 'video' : 'voice',
        mode: 'connected',
        user: {
          id: callerId,
          name: callerName || 'Incoming Caller',
          avatar: ''
        },
        channelName: channel
      });
    };

    if (!currentUserId || currentUserId === 'me') return;

    window.addEventListener('native-call-accepted', handleNativeCallAccepted);

    // B. Check for Cold Start/Warm Start Accepted Calls via Native bridge
    const checkColdStartCall = () => {
      try {
        if (typeof window !== 'undefined' && (window as any).AndroidCallBridge) {
          const pendingCallStr = (window as any).AndroidCallBridge.getPendingAcceptedCall();
          if (pendingCallStr) {
            const pendingCall = JSON.parse(pendingCallStr);
            console.log('[Global Call] Accepted call loaded from Native bridge:', pendingCall);

            // Clear the pending call on the native side only AFTER we successfully read it
            if ((window as any).AndroidCallBridge.clearPendingAcceptedCall) {
              (window as any).AndroidCallBridge.clearPendingAcceptedCall();
            }

            // Notify caller
            fetch('/api/messages/call', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                targetUserId: pendingCall.callerId,
                event: 'call-accepted'
              })
            }).catch(err => console.error('[Global Call] Error sending accepted notification:', err));

            setActiveCall({
              type: pendingCall.callType === 'video' ? 'video' : 'voice',
              mode: 'connected',
              user: {
                id: pendingCall.callerId,
                name: pendingCall.callerName || 'Incoming Caller',
                avatar: ''
              },
              channelName: pendingCall.channel
            });
          }
        }
      } catch (err) {
        console.error('[Global Call] Cold/Warm start checking error:', err);
      }
    };

    checkColdStartCall();
    // Periodically poll to catch any bridge instantiation or delayed intents
    const timer = setInterval(checkColdStartCall, 800);

    // Fast-track check when app receives focus or is brought to foreground
    const handleFocusOrVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        checkColdStartCall();
      }
    };

    window.addEventListener('focus', checkColdStartCall);
    document.addEventListener('visibilitychange', handleFocusOrVisibility);

    return () => {
      window.removeEventListener('native-call-accepted', handleNativeCallAccepted);
      window.removeEventListener('focus', checkColdStartCall);
      document.removeEventListener('visibilitychange', handleFocusOrVisibility);
      clearInterval(timer);
    };
  }, [currentUserId]);

  // 3. Listen to Custom Event to start Outgoing Call from standard Chat interfaces
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
        // Trigger Signaling via API (which triggers Pusher and high-priority FCM notification)
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

  // Agora RTC Connection logic
  const joinAgoraChannel = async () => {
    const current = activeCallRef.current;
    if (!current || !current.channelName || agoraClient.current) return;

    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      agoraClient.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      // Handle Remote Tracks immediately BEFORE joining or creating local tracks
      agoraClient.current.on('user-published', async (remoteUser: any, mediaType: string) => {
        try {
          await agoraClient.current.subscribe(remoteUser, mediaType);
          if (mediaType === 'video') {
            remoteUser.videoTrack.play('remote-player');
          } else {
            remoteUser.audioTrack.play();
          }
        } catch (subErr) {
          console.error('[Global Call] Subscribing error:', subErr);
        }
      });

      // Join the Agora room (using demo AppID - empty token for simplicity)
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID || '14f09d846c4f46a2a51fde2c92e947d1'; 
      await agoraClient.current.join(appId, current.channelName, null, null);
      console.log('[Global Call] Successfully joined Agora channel:', current.channelName);

      // Create Local Tracks (Mic/Camera)
      if (current.type === 'video') {
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        localTracks.current = [audioTrack, videoTrack];
        
        await agoraClient.current.publish([audioTrack, videoTrack]);
        videoTrack.play('local-player');
      } else {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localTracks.current = [audioTrack];
        await agoraClient.current.publish([audioTrack]);
      }
      console.log('[Global Call] Published local tracks');
    } catch (err) {
      console.error('[Global Call] Agora join/publish failed:', err);
      handleEndCall();
    }
  };

  const handleAcceptCall = async () => {
    const current = activeCallRef.current;
    if (!current || !current.channelName) return;

    await fetch('/api/messages/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUserId: current.user.id,
        event: 'call-accepted'
      })
    });

    setActiveCall({ ...current, mode: 'connected' });
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
    cleanupRTC();
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
    cleanupRTC();
  };

  const cleanupRTC = () => {
    if (agoraClient.current) {
      try {
        agoraClient.current.leave();
      } catch (err) {
        console.error('[Global Call] Agora leaving failed:', err);
      }
      agoraClient.current = null;
    }
    localTracks.current.forEach(track => {
      try {
        track.stop();
        track.close();
      } catch (err) {
        console.error('[Global Call] Track closing failed:', err);
      }
    });
    localTracks.current = [];
  };

  if (!activeCall) return null;

  return (
    <CallOverlay
      type={activeCall.type}
      mode={activeCall.mode === 'connected' ? 'connected' : activeCall.mode}
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
