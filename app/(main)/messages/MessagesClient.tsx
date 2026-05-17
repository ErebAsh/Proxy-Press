'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MobileBottomNav from '@/app/components/Sidebar/MobileBottomNav';
import CallOverlay from '@/app/components/Messaging/CallOverlay';
import './messages.css';
import { 
  getConversations, 
  getMessages,
  sendMessage as dbSendMessage, 
  uploadMedia, 
  createStory, 
  getStories, 
  getCurrentUser, 
  getUserProfile, 
  markMessagesAsSeen, 
  updateConversationVanishMode,
  blockUser as dbBlockUser,
  unblockUser as dbUnblockUser,
  searchUsersInMessaging,
  getBlockStatus,
  markStoryAsSeen,
  updateConversationMute,
  deleteConversation as dbDeleteConversation,
  editMessage,
  deleteMessage as dbDeleteMessage
} from '@/lib/actions';
import { OfflineManager } from '@/lib/offline-manager';
import { supabase } from '@/lib/supabase';

/* ─────────── TYPES ─────────── */
interface User {
  id: string;
  name: string;
  avatar: string;
  profilePicture?: string;
  online: boolean;
  lastSeen?: string;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  seen?: boolean;
  type: 'text' | 'image' | 'heart' | 'voice' | 'video' | 'file';
  replyTo?: string;
  reactions?: string[];
  status?: 'sending' | 'sent' | 'error';
  attachment?: string;
  expiresAt?: number;
  isEdited?: boolean;
  isDeleted?: boolean;
}

interface StorySlide {
  id: string;
  type: 'text' | 'image' | 'video';
  text?: string;
  emoji?: string;
  caption?: string;
  gradient: string;
  mediaUrl?: string;
  timestamp: string;
}

interface UserStory {
  userId: string;
  userName: string;
  userAvatar: string;
  userProfilePicture?: string;
  slides: StorySlide[];
  seen: boolean;
}

interface Conversation {
  id: string;
  user: User;
  lastMessage: string;
  lastMessageTime: string;
  rawLastMessageTime?: string;
  unreadCount: number;
  isTyping: boolean;
  messages: Message[];
  muted: boolean;
  vanishMode: boolean;
  vanishDuration: number;
  historyLoaded?: boolean;
}

/* ─────────── MOCK DATA ─────────── */
const CURRENT_USER_ID = 'me';

function formatMessageTime(timestamp: string) {
  if (!timestamp) return '';
  if (timestamp === 'Just now') return 'Just now';
  
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    // Less than 1 hour - min
    if (diffMs < 3600000) {
      const mins = Math.floor(diffMs / 60000);
      return mins <= 0 ? 'Just now' : `${mins}m`;
    }

    // Less than 1 day - hour (only if same calendar day)
    if (date.toDateString() === now.toDateString()) {
      const hours = Math.floor(diffMs / 3600000);
      return hours <= 0 ? '1m' : `${hours}h`;
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // Within last 7 days
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    
    // 7 to 30 days - "X days"
    if (diffDays < 31) {
      return `${diffDays} days`;
    }

    // Older than a month - Full date
    return date.toLocaleDateString([], { 
      day: 'numeric', 
      month: 'short', 
      year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined 
    });
  } catch (e) {
    return timestamp;
  }
}

const MOCK_CONVERSATIONS: Conversation[] = [];

const EMOJI_LIST = ['😀', '😂', '❤️', '🔥', '👍', '😍', '🎉', '💯', '🙌', '✨', '😎', '🤔', '👀', '💪', '🚀', '⭐', '🌟', '💫', '🎊', '🥳', '😊', '🤗', '💕', '🙏'];

const STORY_GRADIENTS = [
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #f093fb, #f5576c)',
  'linear-gradient(135deg, #4facfe, #00f2fe)',
  'linear-gradient(135deg, #43e97b, #38f9d7)',
  'linear-gradient(135deg, #fa709a, #fee140)',
  'linear-gradient(135deg, #a18cd1, #fbc2eb)',
  'linear-gradient(135deg, #ffecd2, #fcb69f)',
  'linear-gradient(135deg, #ff9a9e, #fecfef)',
];

const MOCK_STORIES: UserStory[] = [];

const STORY_DURATION = 5000; // 5 seconds per slide

/* ─────────── COMPONENTS ─────────── */
function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [dbConversations, setDbConversations] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('me');
  const [currentUserProfilePic, setCurrentUserProfilePic] = useState<string | undefined>();
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [activeChatVersion, setActiveChatVersion] = useState(0);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const pusherRef = useRef<any>(null);
  const typingTimeouts = useRef<Record<string, NodeJS.Timeout>>({});

  /* ─── Offline Manager Init ─── */
  useEffect(() => {
    OfflineManager.init();

    // Check initial online status
    OfflineManager.isOnline().then(setIsOnline);
    OfflineManager.getPendingCount().then(setPendingCount);

    // Listen for network changes
    const unsubStatus = OfflineManager.onStatusChange((online) => {
      setIsOnline(online);
      if (online) {
        OfflineManager.getPendingCount().then(setPendingCount);
      }
    });

    // Listen for queued messages being successfully sent
    const unsubFlush = OfflineManager.onFlush((msg, result) => {
      if (result.success) {
        // Update the local message from 'sending' to 'sent' and swap temp ID
        setConversations(prev => prev.map(c => {
          if (c.id === msg.conversationId || (result.conversationId && c.id === msg.conversationId)) {
            return {
              ...c,
              id: result.conversationId || c.id,
              messages: c.messages.map(m =>
                m.id === msg.tempId
                  ? { ...m, id: result.id || m.id, status: 'sent' as const }
                  : m
              ),
            };
          }
          return c;
        }));
      } else {
        // Mark message as error after all retries failed
        setConversations(prev => prev.map(c => ({
          ...c,
          messages: c.messages.map(m =>
            m.id === msg.tempId ? { ...m, status: 'error' as const } : m
          ),
        })));
      }
      OfflineManager.getPendingCount().then(setPendingCount);
    });

    return () => {
      unsubStatus();
      unsubFlush();
    };
  }, []);

  /* ─── Instant Cache Load ─── */
  useEffect(() => {
    async function loadCacheOnMount() {
      // 1. Get last user ID instantly from local storage
      const lastId = await OfflineManager.loadData<string>('last_user_id');
      if (lastId) {
        setCurrentUserId(lastId);
        // 2. Load their conversations instantly
        const [cachedConvs, cachedStories, cachedMyStories] = await Promise.all([
          OfflineManager.loadData<Conversation[]>(`convs_${lastId}`),
          OfflineManager.loadData<UserStory[]>(`stories_${lastId}`),
          OfflineManager.loadData<any[]>(`mystories_${lastId}`)
        ]);

        if (cachedConvs && cachedConvs.length > 0) {
          console.log('[Offline] Instant startup for:', lastId);
          setConversations(cachedConvs);
        }
        if (cachedStories) setStories(cachedStories);
        if (cachedMyStories) setMyStories(cachedMyStories);
      }
    }
    loadCacheOnMount();
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      try {
        // Fetch current user in background
        const currentUserPromise = getCurrentUser();
        
        // Use cached ID or wait for fresh one
        const currentUser = await currentUserPromise;
        const myId = currentUser?.id || currentUserId || 'me';
        
        if (currentUser) {
          setCurrentUserId(myId);
          setCurrentUserProfilePic(currentUser?.profilePicture);
          OfflineManager.saveData('last_user_id', myId);
        }

        const targetUserId = searchParams.get('userId');
        
        // Fetch fresh data from Network
        const [convs, dbStories] = await Promise.all([
          getConversations(myId),
          getStories(myId)
        ]);
        
        let mappedConvs: Conversation[] = [];
        if (convs) {
          mappedConvs = convs.map((dbConv: any) => {
            const otherParticipant = dbConv.participants?.find((p: any) => p.userId !== myId);
            const otherUser = otherParticipant?.user;
            
            // Safety: if name looks like a URL/path, use a fallback
            const displayName = (otherUser?.name && otherUser.name.includes('/uploads/')) 
              ? (otherUser.username || 'User') 
              : (otherUser?.name || 'Unknown User');

            return {
              id: dbConv.id,
              user: {
                id: otherUser?.id || 'unknown',
                name: displayName,
                avatar: otherUser?.avatar || (displayName ? displayName.substring(0, 1) : 'U'),
                profilePicture: otherUser?.profilePicture,
                online: true,
              },

              lastMessage: dbConv.lastMessage || '',
              lastMessageTime: formatMessageTime(dbConv.lastMessageTime) || '',
              rawLastMessageTime: dbConv.lastMessageTime || '',
              unreadCount: dbConv.unreadCount || 0,
              isTyping: false,
              muted: dbConv.muted || false,
              vanishMode: dbConv.vanishMode || false,
              vanishDuration: dbConv.vanishDuration || 3600,
              messages: (dbConv.messages || []).map((m: any) => ({
                id: m.id,
                senderId: m.senderId === myId ? 'me' : m.senderId,
                text: m.text,
                timestamp: formatMessageTime(m.timestamp),
                seen: m.seen,
                type: m.type || 'text',
                attachment: m.attachment,
                expiresAt: m.expiresAt,
                isEdited: m.isEdited,
                isDeleted: m.isDeleted,
                replyTo: m.replyTo,
              })).reverse(), // DB returns desc, UI might want asc for chat history
            };
          });

          setConversations(prev => {
            const newDrafts = prev.filter(c => String(c.id).startsWith('new_'));
            
            // Merge with existing conversations to preserve loaded messages
            const merged = mappedConvs.map(newC => {
              const existing = prev.find(p => p.id === newC.id);
              return {
                ...newC,
                messages: (newC.messages.length === 0 && existing) ? existing.messages : newC.messages,
                historyLoaded: existing?.historyLoaded || false
              };
            });

            return [...newDrafts, ...merged];
          });

          // 3. Update Cache with fresh data
          OfflineManager.saveData(`convs_${myId}`, mappedConvs);
        }

        if (dbStories && dbStories.length > 0) {
          // Find current user's stories
          const myDbStory = dbStories.find((s: any) => s.userId === myId);
          if (myDbStory && myDbStory.slides && myDbStory.slides.length > 0) {
            setMyStories(myDbStory.slides.map((s: any) => ({
              ...s,
              type: s.type || 'image',
              timestamp: s.timestamp || 'Just now'
            })));
          } else {
            setMyStories([]);
          }

          // Map other stories to UI format, filtering out those with no slides
          const otherStories = dbStories
            .filter((s: any) => s.userId !== myId && s.slides && s.slides.length > 0)
            .map((s: any) => ({
              userId: s.userId,
              userName: s.user?.name || 'User',
              userAvatar: (s.user?.name || 'U').substring(0, 1),
              userProfilePicture: s.user?.profilePicture,
              seen: s.seen,
              slides: s.slides.map((sl: any) => ({
                ...sl,
                type: sl.type || 'image',
                timestamp: sl.timestamp || 'Just now'
              }))
            }));
          
          setStories(otherStories);

          // 4. Save Stories to cache
          OfflineManager.saveData(`stories_${myId}`, otherStories);
          OfflineManager.saveData(`mystories_${myId}`, myDbStory?.slides || []);
        } else {
           setStories([]);
           setMyStories([]);
           OfflineManager.saveData(`stories_${myId}`, []);
           OfflineManager.saveData(`mystories_${myId}`, []);
        }
      } catch (err) {
        console.error('Failed to load initial messages data:', err);
      }
    }
    loadInitialData();
  }, []);

  // Real-time updates via Supabase Realtime (Replaces Polling)
  useEffect(() => {
    if (!currentUserId || currentUserId === 'me') return;

    // Listen for new messages across all conversations the user is part of
    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'messages'
      }, async (payload) => {
        console.log('[Realtime] Message change detected:', payload);
        
        const newMsg = payload.new as any;
        if (!newMsg) return;

        // Fallback for snake_case keys from Supabase Realtime
        const conversationId = newMsg.conversationId || newMsg.conversation_id;
        const senderId = newMsg.senderId || newMsg.sender_id;

        // Handle NEW message (INSERT)
        if (payload.eventType === 'INSERT') {
          if (senderId === currentUserId) return; // Ignore messages sent by me
          setConversations(prev => {
            return prev.map(c => {
              // If this message belongs to this conversation
              if (String(c.id) === String(conversationId)) {
                // Prevent duplicate messages (e.g. if we sent it and already added it optimistically)
                const exists = c.messages.some(m => m.id === newMsg.id || m.id === `m${new Date(newMsg.created_at).getTime()}`);
                
                let updatedMessages = c.messages;
                if (!exists) {
                  updatedMessages = [...c.messages, {
                    id: newMsg.id,
                    senderId: senderId,
                    text: newMsg.text,
                    timestamp: formatMessageTime(newMsg.created_at || newMsg.createdAt || new Date().toISOString()),
                    seen: false,
                    type: newMsg.type || 'text',
                    attachment: newMsg.attachment,
                    status: 'sent'
                  }];

                  // Save to cache in background
                  setTimeout(() => {
                    OfflineManager.saveData(`msgs_${c.id}`, updatedMessages);
                  }, 0);
                }

                return {
                  ...c,
                  messages: updatedMessages,
                  lastMessage: newMsg.text,
                  lastMessageTime: 'Just now',
                  rawLastMessageTime: newMsg.created_at,
                  // Increment unread count only if it's not the active chat and not sent by me
                  unreadCount: (activeChat === c.id || newMsg.senderId === currentUserId) ? c.unreadCount : c.unreadCount + 1
                };
              }
              return c;
            });
          });
        }
        
        // Handle message update (e.g. seen status)
        if (payload.eventType === 'UPDATE') {
          setConversations(prev => prev.map(c => {
            if (String(c.id) === String(conversationId)) {
              const updatedMessages = c.messages.map(m => m.id === newMsg.id ? { ...m, seen: newMsg.seen } : m);
              
              // Save to cache in background
              setTimeout(() => {
                OfflineManager.saveData(`msgs_${c.id}`, updatedMessages);
              }, 0);

              return {
                ...c,
                messages: updatedMessages
              };
            }
            return c;
          }));
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
        if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Channel error occurred. This usually means RLS policies are blocking read access or Realtime is not enabled for the table in Replication.');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, activeChat]);

  // Handle userId or chatId from URL reactively
  useEffect(() => {
    const targetUserId = searchParams.get('userId');
    const targetChatId = searchParams.get('chatId');
    
    if (targetUserId) {
      // Find a REAL conversation with this user first
      let existing = conversations.find(c => c.user.id === targetUserId && !String(c.id).startsWith('new_'));
      
      // If no real one exists, see if we have a draft
      if (!existing) {
        existing = conversations.find(c => c.user.id === targetUserId);
      }

      if (existing) {
        if (activeChat !== existing.id) setActiveChat(existing.id);
      } else if (currentUserId && currentUserId !== 'me') {
        // If not in conversations yet, we might need to create a temporary new chat entry
        getUserProfile(targetUserId).then(targetUser => {
          if (targetUser) {
            const displayName = (targetUser.name && targetUser.name.includes('/uploads/')) 
              ? (targetUser.username || 'User') 
              : (targetUser.name || 'Unknown User');
              
            const newConv: Conversation = {
              id: `new_${targetUser.id}`,
              user: {
                id: targetUser.id,
                name: displayName,
                avatar: targetUser.profilePicture || (displayName ? displayName.substring(0, 1) : '👤'),
                profilePicture: targetUser.profilePicture,
                online: true,
              },
              lastMessage: '',
              lastMessageTime: '',
              unreadCount: 0,
              isTyping: false,
              muted: false,
              vanishMode: false,
              vanishDuration: 3600,
              messages: [],
            };
            setConversations(prev => {
              if (prev.find(c => c.id === newConv.id || c.user.id === targetUser.id)) return prev;
              return [newConv, ...prev];
            });
            setActiveChat(newConv.id);
          }
        }).catch(err => console.error("Failed to fetch target user for messaging:", err));
      }
    } else if (targetChatId) {
      if (activeChat !== targetChatId) setActiveChat(targetChatId);
    } else {
      // If no chatId or userId in URL, clear active chat
      if (activeChat !== null) {
        setActiveChat(null);
      }
    }
  }, [searchParams, currentUserId, conversations.length, activeChat]);

  // Load messages when active chat changes
  useEffect(() => {
    if (!activeChat || activeChat.startsWith('new_')) return;

    async function loadChatMessages() {
      if (!activeChat) return;
      const chatId = activeChat;
      const existing = conversations.find(c => c.id === chatId);

      // 1. Load messages from Cache FIRST
      if (existing && !existing.historyLoaded) {
        const cachedMsgs = await OfflineManager.loadData<any[]>(`msgs_${chatId}`);
        if (cachedMsgs) {
           console.log(`[Offline] Loading messages from cache for ${chatId}`);
           setConversations(prev => prev.map(c => 
             c.id === chatId ? { ...c, messages: cachedMsgs } : c
           ));
        }
      }

      // 2. Fetch from Network if not loaded yet
      if (existing && !existing.historyLoaded) {
        try {
          const dbMsgs = await getMessages(chatId);
          const mappedMsgs = dbMsgs.map((m: any) => ({
            id: m.id,
            senderId: m.senderId === currentUserId ? 'me' : m.senderId,
            text: m.text,
            timestamp: formatMessageTime(m.timestamp),
            seen: m.seen,
            type: m.type || 'text',
            attachment: m.attachment,
            expiresAt: m.expiresAt ? new Date(m.expiresAt).getTime() : undefined,
            isEdited: m.isEdited,
            isDeleted: m.isDeleted,
            replyTo: m.replyTo,
          })).reverse();

          setConversations(prev => prev.map(c => 
            c.id === chatId ? { ...c, messages: mappedMsgs, historyLoaded: true } : c
          ));

          // 3. Save to Cache
          OfflineManager.saveData(`msgs_${chatId}`, mappedMsgs);
        } catch (err) {
          console.error('Failed to load messages:', err);
        }
      }
    }

    loadChatMessages();
  }, [activeChat, currentUserId, activeChatVersion]); // Only re-run when chat changes OR a new message is detected by polling
  const [messageInput, setMessageInput] = useState('');
  const activeConversation = conversations.find(c => c.id === activeChat);
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [longPressMsg, setLongPressMsg] = useState<string | null>(null);

  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMuteToast, setShowMuteToast] = useState(false);
  const [showVanishToast, setShowVanishToast] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [lightboxMedia, setLightboxMedia] = useState<{ url: string; msgId: string; sender: string; time: string; type: 'image' | 'video' } | null>(null);

  /* ─── Calling State ─── */
  const [activeCall, setActiveCall] = useState<{
    type: 'voice' | 'video';
    mode: 'incoming' | 'outgoing' | 'connected';
    user: any;
    channelName?: string;
  } | null>(null);

  // Sync calling state to URL for global UI awareness (like hiding footer)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeCall) {
      params.set('calling', 'true');
    } else {
      params.delete('calling');
    }
    const newSearch = params.toString();
    const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`;
    window.history.replaceState(null, '', newUrl);

    // Also use body class for instant CSS-based hiding of footer
    if (activeCall) {
      document.body.classList.add('calling-active');
    } else {
      document.body.classList.remove('calling-active');
    }

    return () => {
      document.body.classList.remove('calling-active');
    };
  }, [activeCall]);

  /* ─── Calling Logic (Agora & Pusher) ─── */
  const agoraClient = useRef<any>(null);
  const localTracks = useRef<any[]>([]);

  /* ─── Presence & Messaging Signaling (Pusher) ─── */
  useEffect(() => {
    if (!currentUserId || currentUserId === 'me') return;

    let pusher: any;
    let userChannel: any;
    let presenceChannel: any;

    async function setupPusher() {
      const PusherClient = (await import('pusher-js')).default;
      pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
        authEndpoint: '/api/pusher/auth',
      });
      pusherRef.current = pusher;

      // 1. Presence Channel (Global Messenger Status)
      presenceChannel = pusher.subscribe('presence-messenger');
      
      presenceChannel.bind('pusher:subscription_succeeded', (members: any) => {
        setOnlineUserIds(new Set(Object.keys(members.members)));
      });
      
      presenceChannel.bind('pusher:member_added', (member: any) => {
        setOnlineUserIds(prev => new Set(prev).add(member.id));
      });
      
      presenceChannel.bind('pusher:member_removed', (member: any) => {
        setOnlineUserIds(prev => {
          const next = new Set(prev);
          next.delete(member.id);
          return next;
        });
      });

      // 2. User Private Channel (For Incoming Calls & Personal Signaling)
      userChannel = pusher.subscribe(`private-user-${currentUserId}`);
      
      userChannel.bind('incoming-call', (data: any) => {
        setActiveCall(prev => {
          if (prev) return prev; 
          return {
            type: data.type,
            mode: 'incoming',
            user: data.caller,
            channelName: data.channelName
          };
        });
      });

      userChannel.bind('call-accepted', () => {
        setActiveCall(prev => (prev?.mode === 'outgoing' ? { ...prev, mode: 'connected' } : prev));
      });

      userChannel.bind('call-rejected', () => setActiveCall(null));
      userChannel.bind('call-ended', () => handleEndCall());
    }

    setupPusher();

    return () => {
      if (pusher) pusher.disconnect();
    };
  }, [currentUserId]);

  // ─── Active Chat Signaling (Typing & Specific signaling) ───
  useEffect(() => {
    if (!activeChat || !pusherRef.current || String(activeChat).startsWith('new_')) return;

    const chatChannel = pusherRef.current.subscribe(`private-chat-${activeChat}`);

    chatChannel.bind('client-typing', (data: { userId: string }) => {
      // Update specific conversation isTyping state
      setConversations(prev => prev.map(c => 
        c.user.id === data.userId ? { ...c, isTyping: true } : c
      ));

      // Auto-clear typing indicator after 3 seconds
      if (typingTimeouts.current[data.userId]) {
        clearTimeout(typingTimeouts.current[data.userId]);
      }
      typingTimeouts.current[data.userId] = setTimeout(() => {
        setConversations(prev => prev.map(c => 
          c.user.id === data.userId ? { ...c, isTyping: false } : c
        ));
      }, 3000);
    });

    chatChannel.bind('client-new-message', (data: any) => {
      if (data.senderId === currentUserId) return; // Ignore messages sent by me
      setConversations(prev => prev.map(c => {
        if (c.id === activeChat) {
          const exists = c.messages.some(m => m.id === data.id);
          if (!exists) {
            return {
              ...c,
              messages: [...c.messages, data],
              lastMessage: data.text,
              lastMessageTime: 'Just now',
              rawLastMessageTime: new Date().toISOString()
            };
          }
        }
        return c;
      }));
    });

    return () => {
      chatChannel.unbind_all();
      pusherRef.current.unsubscribe(`private-chat-${activeChat}`);
    };
  }, [activeChat, currentUserId]);

  const lastTypingSent = useRef<number>(0);

  const sendTypingSignal = useCallback(() => {
    if (!activeChat || !pusherRef.current || String(activeChat).startsWith('new_')) return;
    
    const now = Date.now();
    if (now - lastTypingSent.current < 1500) return; // Throttle to 1.5 seconds
    lastTypingSent.current = now;

    try {
      const chatChannel = pusherRef.current.channel(`private-chat-${activeChat}`);
      if (chatChannel) {
        chatChannel.trigger('client-typing', { userId: currentUserId });
      }
    } catch (e) {}
  }, [activeChat, currentUserId]);

  const [lightboxControlsVisible, setLightboxControlsVisible] = useState(true);
  const [lightboxRotation, setLightboxRotation] = useState(0);
  const [showLightboxMenu, setShowLightboxMenu] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardSearch, setForwardSearch] = useState('');
  const [showForwardSuccess, setShowForwardSuccess] = useState(false);





  /* ─── Story State ─── */
  const [stories, setStories] = useState<UserStory[]>([]);
  const [myStories, setMyStories] = useState<StorySlide[]>([]);
  const [activeStoryUserIdx, setActiveStoryUserIdx] = useState<number | null>(null);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyPaused, setStoryPaused] = useState(false);
  const [storyReply, setStoryReply] = useState('');
  const [storyReaction, setStoryReaction] = useState<string | null>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const [createStoryText, setCreateStoryText] = useState('');
  const [createStoryGradient, setCreateStoryGradient] = useState(0);
  const [showStorySentToast, setShowStorySentToast] = useState(false);
  const [createStoryTab, setCreateStoryTab] = useState<'text' | 'photo' | 'video' | 'camera'>('text');
  const [createStoryMedia, setCreateStoryMedia] = useState<string | null>(null);
  const [createStoryMediaType, setCreateStoryMediaType] = useState<'image' | 'video' | null>(null);
  const [createStoryCaption, setCreateStoryCaption] = useState('');
  const storyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const storyMediaInputRef = useRef<HTMLInputElement>(null);
  const storyVideoInputRef = useRef<HTMLInputElement>(null);
  const storyVideoRef = useRef<HTMLVideoElement>(null);

  /* ─── Camera State ─── */
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraRecording, setCameraRecording] = useState(false);
  const [cameraRecordTime, setCameraRecordTime] = useState(0);
  const [cameraCaptured, setCameraCaptured] = useState<string | null>(null);
  const [cameraCapturedType, setCameraCapturedType] = useState<'image' | 'video' | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video'>('photo');
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRecordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lightboxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (cameraActive) {
      document.body.classList.add('camera-active');
    } else {
      document.body.classList.remove('camera-active');
    }
    return () => {
      document.body.classList.remove('camera-active');
    };
  }, [cameraActive]);

  useEffect(() => {
    if (showCreateStory) {
      document.body.classList.add('story-create-active');
    } else {
      document.body.classList.remove('story-create-active');
    }
    return () => {
      document.body.classList.remove('story-create-active');
    };
  }, [showCreateStory]);



  useEffect(() => {
    const handleOrientation = () => {
      if (!lightboxMedia) return;
      // Auto-rotate logic for mobile
      const isLandscape = window.innerWidth > window.innerHeight;
      // If we're on mobile (roughly) and orientation changes, we can suggest or auto-adjust
      // For now, let's just ensure we reset rotation on orientation change to allow native fit
      setLightboxRotation(0);
    };
    window.addEventListener('resize', handleOrientation);
    return () => window.removeEventListener('resize', handleOrientation);
  }, [lightboxMedia]);

  useEffect(() => {
    if (showMuteToast) {

      const timer = setTimeout(() => setShowMuteToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showMuteToast]);

  useEffect(() => {
    if (showVanishToast) {
      const timer = setTimeout(() => setShowVanishToast(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [showVanishToast]);

  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    async function searchGlobal() {
      if (searchQuery.trim().length > 1) {
        const results = await searchUsersInMessaging(searchQuery);
        // Filter out people I already have a conversation with
        const existingUserIds = conversations.map(c => c.user.id);
        setSearchResults(results.filter((u: any) => !existingUserIds.includes(u.id) && u.id !== currentUserId));
      } else {
        setSearchResults([]);
      }
    }
    const timer = setTimeout(searchGlobal, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, conversations, currentUserId]);
  
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [voiceRecordingDuration, setVoiceRecordingDuration] = useState(0);
  const [recordingMediaRecorder, setRecordingMediaRecorder] = useState<MediaRecorder | null>(null);
  const voiceRecordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const cancelRef = useRef(false);

  // Recording timer
  useEffect(() => {
    if (isVoiceRecording) {
      voiceRecordingTimerRef.current = setInterval(() => {
        setVoiceRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (voiceRecordingTimerRef.current) clearInterval(voiceRecordingTimerRef.current);
      setVoiceRecordingDuration(0);
    }
    return () => {
      if (voiceRecordingTimerRef.current) clearInterval(voiceRecordingTimerRef.current);
    };
  }, [isVoiceRecording]);

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        if (audioBlob.size > 0 && !cancelRef.current) {
          await sendVoiceMessage(audioBlob);
        }
        stream.getTracks().forEach(track => track.stop());
      };

      setAudioChunks(chunks);
      setRecordingMediaRecorder(recorder);
      cancelRef.current = false;
      recorder.start();
      setIsVoiceRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      alert('Could not access microphone');
    }
  };

  const stopVoiceRecording = (shouldSend: boolean) => {
    if (recordingMediaRecorder && recordingMediaRecorder.state !== 'inactive') {
      cancelRef.current = !shouldSend;
      recordingMediaRecorder.stop();
      setIsVoiceRecording(false);
    }
  };

  const sendVoiceMessage = async (blob: Blob) => {
    if (!activeChat || !currentUserId) return;

    try {
      // 1. Create FormData for true binary upload
      const formData = new FormData();
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
      formData.append('file', file);
      formData.append('category', 'voice');

      // 2. Upload using universal media action
      const uploadRes = await uploadMedia(formData);
      if (!uploadRes || !uploadRes.url) {
        throw new Error('Upload failed');
      }

      const fileUrl = uploadRes.url;
      const newMsgId = `v-${Date.now()}`;
      const newMsg: Message = {
        id: newMsgId,
        senderId: currentUserId,
        text: 'Voice message',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'sent',
        type: 'voice',
        attachment: fileUrl,
      };

      // 3. Update local state
      setConversations(prev => prev.map(c => 
        c.id === activeChat ? { 
          ...c, 
          lastMessage: '🎤 Voice message', 
          lastMessageTime: 'Just now',
          rawLastMessageTime: new Date().toISOString(),
          messages: [...c.messages, newMsg]
        } : c
      ));

      // 4. Send message reference to DB (with offline fallback)
      const voicePayload = {
        conversationId: activeChat,
        senderId: currentUserId,
        text: 'Voice message',
        type: 'voice',
        attachment: fileUrl
      };

      const online = await OfflineManager.isOnline();

      if (online) {
        try {
          const res = await dbSendMessage(voicePayload);
          if (res.success) {
            setConversations(prev => prev.map(c => 
              c.id === activeChat ? { 
                ...c, 
                messages: c.messages.map(m => m.id === newMsgId ? { ...m, id: res.id as string, status: 'sent' } : m)
              } : c
            ));
          }
        } catch (err) {
           console.error("DB Save failed for voice", err);
        }
      } else {
        // Queue for later
        await OfflineManager.queueMessage({ ...voicePayload, tempId: newMsgId });
        setConversations(prev => prev.map(c => 
          c.id === activeChat ? { 
            ...c, 
            messages: c.messages.map(m => m.id === newMsgId ? { ...m, status: 'sending' } : m)
          } : c
        ));
      }
    } catch (err) {
      console.error('Failed to send voice message:', err);
      alert('Could not send voice message');
    }
  };

  /* ─── Signaling & Calling Logic ─── */
  const startCall = async (type: 'voice' | 'video') => {
    if (!activeConversation) return;
    
    const channelName = `call_${Date.now()}`;
    setActiveCall({
      type,
      mode: 'outgoing',
      user: activeConversation.user,
      channelName
    });

    try {
      // 1. Trigger Signaling via API (Pusher)
      await fetch('/api/messages/call', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: activeConversation.user.id,
          event: 'incoming-call',
          channelName,
          type,
          caller: {
            id: currentUserId,
            name: 'User', // In a real app, use the current user's name
            avatar: ''
          }
        })
      });
    } catch (err) {
      console.error('Failed to start call:', err);
      setActiveCall(null);
    }
  };

  const joinAgoraChannel = async () => {
    if (!activeCall || !activeCall.channelName || agoraClient.current) return;

    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      agoraClient.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID!;
      await agoraClient.current.join(appId, activeCall.channelName, null, null);

      // Create Local Tracks
      if (activeCall.type === 'video') {
        const [audioTrack, videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        localTracks.current = [audioTrack, videoTrack];
        videoTrack.play('local-player');
        await agoraClient.current.publish([audioTrack, videoTrack]);
      } else {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localTracks.current = [audioTrack];
        await agoraClient.current.publish([audioTrack]);
      }

      // Handle Remote Tracks
      agoraClient.current.on('user-published', async (user: any, mediaType: string) => {
        await agoraClient.current.subscribe(user, mediaType);
        if (mediaType === 'video') {
          user.videoTrack.play('remote-player');
        } else {
          user.audioTrack.play();
        }
      });

    } catch (err) {
      console.error('Agora Join Error:', err);
      handleEndCall();
    }
  };

  useEffect(() => {
    if (activeCall?.mode === 'connected' && !agoraClient.current) {
      joinAgoraChannel();
    }
  }, [activeCall?.mode]);

  const handleAcceptCall = async () => {
    if (!activeCall || !activeCall.channelName) return;
    
    // 1. Notify Caller
    await fetch('/api/messages/call', {
      method: 'POST',
      body: JSON.stringify({
        targetUserId: activeCall.user.id,
        event: 'call-accepted'
      })
    });

    // 2. Set mode to connected (the useEffect will trigger joinAgoraChannel)
    setActiveCall({ ...activeCall, mode: 'connected' });
  };

  const handleDeclineCall = async () => {
    if (activeCall) {
      await fetch('/api/messages/call', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: activeCall.user.id,
          event: 'call-rejected'
        })
      });
    }
    setActiveCall(null);
  };

  const handleEndCall = async () => {
    if (activeCall) {
      // Notify Peer
      fetch('/api/messages/call', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: activeCall.user.id,
          event: 'call-ended'
        })
      }).catch(() => {});
    }

    if (agoraClient.current) {
      agoraClient.current.leave();
    }
    localTracks.current.forEach(track => {
      track.stop();
      track.close();
    });
    localTracks.current = [];
    setActiveCall(null);
  };

  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggleVoicePlay = (msgId: string, attachment: string) => {
    if (playingVoiceId === msgId) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(attachment);
      audio.onended = () => setPlayingVoiceId(null);
      audio.play();
      audioRef.current = audio;
      setPlayingVoiceId(msgId);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEditMessage = (msg: Message) => {
    setEditingMessageId(msg.id);
    setEditingText(msg.text);
    setLongPressMsg(null);
  };

  const handleSaveEdit = async () => {
    if (!editingMessageId || !activeChat) return;
    const msgId = editingMessageId;
    const newText = editingText.trim();
    
    // Optimistic update
    setConversations(prev => prev.map(c => 
      c.id === activeChat 
        ? { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, text: newText, isEdited: true } : m) }
        : c
    ));
    
    setEditingMessageId(null);
    setEditingText('');

    try {
      await editMessage(msgId, newText);
    } catch (err) {
      console.error('Failed to save edit:', err);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!activeChat) return;
    
    // Optimistic update
    setConversations(prev => prev.map(c => 
      c.id === activeChat 
        ? { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, isDeleted: true, text: 'This message was deleted', attachment: undefined } : m) }
        : c
    ));
    setLongPressMsg(null);

    try {
      await dbDeleteMessage(msgId);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleBlockUser = async () => {
    if (!activeConversation) return;
    const targetId = activeConversation.user.id;
    
    try {
      await dbBlockUser(targetId);
      setConversations(prev => prev.filter(c => c.user.id !== targetId));
      setShowBlockConfirm(false);
      setShowChatInfo(false);
      closeChat();
    } catch (err) {
      console.error('Failed to block user:', err);
    }
  };

  const [showDeleteToast, setShowDeleteToast] = useState(false);

  const handleDeleteChat = async () => {
    if (!activeChat || activeChat.startsWith('new_')) {
        setShowDeleteConfirm(false);
        setShowChatInfo(false);
        closeChat();
        return;
    }

    const idToDelete = activeChat;
    
    // Optimistic UI update
    setConversations(prev => prev.filter(c => c.id !== idToDelete));
    setShowDeleteConfirm(false);
    setShowChatInfo(false);
    closeChat();
    setShowDeleteToast(true);
    setTimeout(() => setShowDeleteToast(false), 3000);

    try {
      await dbDeleteConversation(idToDelete);
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };


  const closeChat = useCallback(() => {
    if (activeConversation?.vanishMode) {
      // CLEAR SEEN MESSAGES on close in vanish mode
      setConversations(prev => prev.map(c => 
        c.id === activeChat 
          ? { ...c, messages: c.messages.filter(m => !m.seen && m.senderId !== 'me') } 
          : c
      ));
    }
    // Clear URL parameters - the useEffect will handle clearing activeChat
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('userId');
    newParams.delete('chatId');
    router.push(`/messages${newParams.toString() ? `?${newParams.toString()}` : ''}`, { scroll: false });
  }, [activeChat, activeConversation?.vanishMode, searchParams, router]);

  const toggleVanishMode = async () => {
    if (!activeChat || activeChat.startsWith('new_')) return;
    
    const currentConv = conversations.find(c => c.id === activeChat);
    if (!currentConv) return;

    const newVanishMode = !currentConv.vanishMode;
    
    setConversations(prev => prev.map(c => 
      c.id === activeChat ? { ...c, vanishMode: newVanishMode } : c
    ));
    
    setShowVanishToast(true);

    try {
      await updateConversationVanishMode(activeChat, newVanishMode);
    } catch (err) {
      console.error('Failed to toggle vanish mode:', err);
    }
  };
  
  const toggleMute = async () => {
    if (!activeChat || activeChat.startsWith('new_')) return;
    
    const currentConv = conversations.find(c => c.id === activeChat);
    if (!currentConv) return;

    const newMuted = !currentConv.muted;
    
    setConversations(prev => prev.map(c => 
      c.id === activeChat ? { ...c, muted: newMuted } : c
    ));
    
    setShowMuteToast(true);

    try {
      await updateConversationMute(activeChat, newMuted);
    } catch (err) {
      console.error('Failed to toggle mute:', err);
    }
  };

  const handleVanishDurationChange = async (duration: number) => {
    if (!activeChat || activeChat.startsWith('new_')) return;

    setConversations(prev => prev.map(c => 
      c.id === activeChat ? { ...c, vanishDuration: duration } : c
    ));

    try {
      await updateConversationVanishMode(activeChat, true, duration);
    } catch (err) {
      console.error('Failed to update vanish duration:', err);
    }
  };
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyReplyInputRef = useRef<HTMLInputElement>(null);

  /* ─── Story Timer Logic ─── */
  const allViewableStories = useCallback(() => {
    const result: UserStory[] = [];
    if (myStories.length > 0) {
      result.push({ 
        userId: 'me', 
        userName: 'Your Story', 
        userAvatar: '✦', 
        userProfilePicture: currentUserProfilePic,
        slides: myStories, 
        seen: false 
      });
    }
    result.push(...stories);
    return result;
  }, [stories, myStories]);

  const closeStoryViewer = useCallback(() => {
    if (storyTimerRef.current) clearInterval(storyTimerRef.current);
    setActiveStoryUserIdx(null);
    setActiveSlideIdx(0);
    setStoryProgress(0);
    setStoryPaused(false);
    setStoryReply('');
    setStoryReaction(null);
    // Clear story param
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.delete('story');
    router.replace(`/messages${newParams.toString() ? `?${newParams.toString()}` : ''}`, { scroll: false });
  }, [searchParams, router]);

  const goToNextSlide = useCallback(() => {
    const viewable = allViewableStories();
    if (activeStoryUserIdx === null) return;
    const currentUser = viewable[activeStoryUserIdx];
    if (!currentUser) return;

    if (activeSlideIdx < currentUser.slides.length - 1) {
      // Next slide of same user
      setActiveSlideIdx(prev => prev + 1);
      setStoryProgress(0);
    } else if (activeStoryUserIdx < viewable.length - 1) {
      // Next user
      // Mark current user as seen
      if (currentUser.userId !== 'me') {
        setStories(prev => prev.map(s => s.userId === currentUser.userId ? { ...s, seen: true } : s));
        markStoryAsSeen(currentUser.userId);
      }
      setActiveStoryUserIdx(prev => (prev !== null ? prev + 1 : null));
      setActiveSlideIdx(0);
      setStoryProgress(0);
    } else {
      // End of all stories
      if (currentUser.userId !== 'me') {
        setStories(prev => prev.map(s => s.userId === currentUser.userId ? { ...s, seen: true } : s));
        markStoryAsSeen(currentUser.userId);
      }
      closeStoryViewer();
    }
  }, [activeStoryUserIdx, activeSlideIdx, allViewableStories, closeStoryViewer]);

  const goToPrevSlide = useCallback(() => {
    if (activeSlideIdx > 0) {
      setActiveSlideIdx(prev => prev - 1);
      setStoryProgress(0);
    } else if (activeStoryUserIdx !== null && activeStoryUserIdx > 0) {
      const viewable = allViewableStories();
      const prevUser = viewable[activeStoryUserIdx - 1];
      setActiveStoryUserIdx(prev => (prev !== null ? prev - 1 : null));
      setActiveSlideIdx(prevUser ? prevUser.slides.length - 1 : 0);
      setStoryProgress(0);
    }
  }, [activeSlideIdx, activeStoryUserIdx, allViewableStories]);

  // Story auto-advance timer
  useEffect(() => {
    if (activeStoryUserIdx === null || storyPaused) {
      if (storyTimerRef.current) clearInterval(storyTimerRef.current);
      return;
    }

    const interval = 50; // Update every 50ms
    const step = (interval / STORY_DURATION) * 100;

    storyTimerRef.current = setInterval(() => {
      setStoryProgress(prev => {
        if (prev >= 100) {
          goToNextSlide();
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => {
      if (storyTimerRef.current) clearInterval(storyTimerRef.current);
    };
  }, [activeStoryUserIdx, activeSlideIdx, storyPaused, goToNextSlide]);

  const openStory = (userIdx: number) => {
    setActiveStoryUserIdx(userIdx);
    setActiveSlideIdx(0);
    setStoryProgress(0);
    setStoryPaused(false);

    // Set story param
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('story', 'true');
    router.push(`/messages?${newParams.toString()}`, { scroll: false });

    const viewable = allViewableStories();
    const currentUser = viewable[userIdx];
    if (currentUser && currentUser.userId !== 'me') {
       markStoryAsSeen(currentUser.userId);
       setStories(prev => prev.map(s => s.userId === currentUser.userId ? { ...s, seen: true } : s));
    }
  };

  const handleStoryReaction = (emoji: string) => {
    setStoryReaction(emoji);
    setStoryPaused(true);
    setTimeout(() => {
      setStoryReaction(null);
      setStoryPaused(false);
    }, 900);
  };

  const sendStoryReply = () => {
    if (!storyReply.trim()) return;
    // In a real app, this would send a message. For now, just show reaction effect.
    setStoryReaction('💬');
    setStoryReply('');
    setTimeout(() => {
      setStoryReaction(null);
    }, 900);
  };

  const handleCreateStory = async () => {
    let mediaUrl = '';
    let type: 'text' | 'image' | 'video' = 'text';

    try {
      if (createStoryTab === 'text') {
        if (!createStoryText.trim()) return;
        type = 'text';
      } else {
        if (!createStoryMedia) return;
        type = createStoryMediaType === 'video' ? 'video' : 'image';
        
        // 1. Upload media
        const res = await fetch(createStoryMedia);
        const blob = await res.blob();
        const file = new File([blob], `story-${Date.now()}.${type === 'video' ? 'webm' : 'jpg'}`, { type: blob.type });
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('category', 'stories');
        
        const uploadRes = await uploadMedia(formData);
        mediaUrl = uploadRes.url;
      }

      // 2. Persist to DB
      await createStory({
        userId: currentUserId,
        type,
        mediaUrl,
        text: createStoryText.trim() || undefined,
        caption: createStoryCaption.trim() || undefined,
        gradient: STORY_GRADIENTS[createStoryGradient],
      });

      // Update local state for immediate feedback (simplified)
      const newSlide: StorySlide = {
        id: `my-${Date.now()}`,
        type,
        text: createStoryText.trim(),
        mediaUrl: mediaUrl || createStoryMedia || undefined,
        caption: createStoryCaption.trim() || undefined,
        gradient: STORY_GRADIENTS[createStoryGradient],
        timestamp: 'Just now',
      };
      setMyStories(prev => [...prev, newSlide]);

      setCreateStoryText('');
      setCreateStoryGradient(0);
      setCreateStoryMedia(null);
      setCreateStoryMediaType(null);
      setCreateStoryCaption('');
      setCreateStoryTab('text');
      setShowCreateStory(false);
      setShowStorySentToast(true);
      setTimeout(() => setShowStorySentToast(false), 2800);
    } catch (err) {
      console.error('Story creation error:', err);
      alert('Failed to create story.');
    }
  };

  const handleStoryMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const url = URL.createObjectURL(file);
    
    setCreateStoryMedia(url);
    setCreateStoryMediaType(isVideo ? 'video' : 'image');
    setCreateStoryTab(isVideo ? 'video' : 'photo');
    stopCamera();
    
    // Clear input so same file can be selected again if discarded
    e.target.value = '';
  };

  const removeStoryMedia = () => {
    setCreateStoryMedia(null);
    setCreateStoryMediaType(null);
    if (storyMediaInputRef.current) storyMediaInputRef.current.value = '';
    if (storyVideoInputRef.current) storyVideoInputRef.current.value = '';
    
    // Return to the initial page (Text mode) when discarding media
    if (createStoryTab === 'photo' || createStoryTab === 'video') {
      setCreateStoryTab('text');
    }
  };

  /* ─── Camera Functions ─── */
  const startCamera = useCallback(async (facing: 'user' | 'environment' = 'user') => {
    try {
      if (!navigator?.mediaDevices) {
        throw new Error('Camera API not available. Please ensure you are using a secure connection (HTTPS) and a modern browser.');
      }
      // Stop any existing stream first
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      cameraStreamRef.current = stream;
      
      const setPreview = () => {
        if (cameraPreviewRef.current) {
          cameraPreviewRef.current.srcObject = stream;
          cameraPreviewRef.current.play().catch(e => console.warn('Auto-play failed:', e));
          setCameraActive(true);
        }
      };

      // Set immediately if ref exists, otherwise wait a tick
      if (cameraPreviewRef.current) {
        setPreview();
      } else {
        setTimeout(setPreview, 50);
      }
      
      setCameraFacing(facing);
    } catch (err: any) {
      console.error('Camera access error:', err);
      alert(err.message || 'Camera access was denied. Please allow camera permissions and try again.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(t => t.stop());
      cameraStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error('Error stopping recorder in stopCamera:', e);
      }
    }
    if (cameraRecordTimerRef.current) {
      clearInterval(cameraRecordTimerRef.current);
      cameraRecordTimerRef.current = null;
    }
    setCameraActive(false);
    setCameraRecording(false);
    setCameraRecordTime(0);
  }, []);

  const flipCamera = useCallback(() => {
    const newFacing = cameraFacing === 'user' ? 'environment' : 'user';
    startCamera(newFacing);
  }, [cameraFacing, startCamera]);

  const capturePhoto = useCallback(() => {
    if (!cameraPreviewRef.current || !cameraCanvasRef.current) return;
    const video = cameraPreviewRef.current;
    const canvas = cameraCanvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Mirror for front camera
    if (cameraFacing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCameraCaptured(dataUrl);
    setCameraCapturedType('image');
    stopCamera();
  }, [cameraFacing, stopCamera]);

  const startRecording = useCallback(() => {
    if (!cameraStreamRef.current) return;
    if (typeof MediaRecorder === 'undefined') {
      alert('Video recording is not supported in your browser.');
      return;
    }
    
    recordedChunksRef.current = [];
    
    // Define supported mime types to try
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4', // Safari fallback
      'video/ogg'
    ];
    
    let selectedMimeType = '';
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedMimeType = type;
        break;
      }
    }

    try {
      const options = selectedMimeType ? { mimeType: selectedMimeType } : {};
      const recorder = new MediaRecorder(cameraStreamRef.current, options);
      
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (recordedChunksRef.current.length === 0) {
          console.error('No recording chunks collected');
          return;
        }
        
        const blob = new Blob(recordedChunksRef.current, { 
          type: selectedMimeType || 'video/webm' 
        });
        const url = URL.createObjectURL(blob);
        
        setCameraCaptured(url);
        setCameraCapturedType('video');
        
        // Stop the camera stream after capturing
        if (cameraStreamRef.current) {
          cameraStreamRef.current.getTracks().forEach(t => t.stop());
          cameraStreamRef.current = null;
        }
        setCameraActive(false);
      };

      recorder.onerror = (e) => {
        console.error('MediaRecorder error:', e);
        alert('Recording error occurred. Please try again.');
        setCameraRecording(false);
        if (cameraRecordTimerRef.current) clearInterval(cameraRecordTimerRef.current);
      };

      recorder.start(200); // Collect data every 200ms
      mediaRecorderRef.current = recorder;
      setCameraRecording(true);
      setCameraRecordTime(0);
      
      // Ensure preview keeps playing (some browsers pause it when recording starts)
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.play().catch(e => console.warn('Could not resume preview:', e));
      }

      if (cameraRecordTimerRef.current) clearInterval(cameraRecordTimerRef.current);
      cameraRecordTimerRef.current = setInterval(() => {
        setCameraRecordTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Could not start video recording. Please try again or use another browser.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (cameraRecordTimerRef.current) {
      clearInterval(cameraRecordTimerRef.current);
      cameraRecordTimerRef.current = null;
    }
    setCameraRecording(false);
  }, []);

  const discardCameraCapture = useCallback(() => {
    setCameraCaptured(null);
    setCameraCapturedType(null);
    setCameraRecordTime(0);
  }, []);

  const useCameraCapture = useCallback(() => {
    if (!cameraCaptured) return;
    setCreateStoryMedia(cameraCaptured);
    setCreateStoryMediaType(cameraCapturedType);
    setCameraCaptured(null);
    setCameraCapturedType(null);
    setCreateStoryTab(cameraCapturedType === 'video' ? 'video' : 'photo');
  }, [cameraCaptured, cameraCapturedType]);

  // Auto-start camera when switching to camera tab
  useEffect(() => {
    if (createStoryTab === 'camera' && showCreateStory && !cameraCaptured) {
      startCamera(cameraFacing);
    } else if (createStoryTab !== 'camera') {
      stopCamera();
    }
    return () => {
      // Cleanup on unmount / tab switch
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createStoryTab, showCreateStory]);

  // Cleanup camera when modal closes
  useEffect(() => {
    if (!showCreateStory) {
      stopCamera();
      setCameraCaptured(null);
      setCameraCapturedType(null);
    }
  }, [showCreateStory, stopCamera]);

  // Handle story reply keydown
  const handleStoryReplyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendStoryReply();
    }
  };

  // Duplicate useEffect removed

  const scrollToBottom = useCallback((instant = false) => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: instant ? 'auto' : 'smooth',
      block: 'end'
    });
  }, []);

  useEffect(() => {
    if (activeChat) {
      // Use instant scroll for initial chat load
      setTimeout(() => scrollToBottom(true), 10);
      // And again after a bit more time to handle late-loading images/content
      setTimeout(() => scrollToBottom(true), 100);
      // Mark messages as read in DB
      if (currentUserId !== 'me') {
        markMessagesAsSeen(activeChat, currentUserId);
      }
      
      // Update local state
      setConversations(prev => prev.map(c =>
        c.id === activeChat ? { 
          ...c, 
          unreadCount: 0,
          messages: c.messages.map(m => m.senderId !== 'me' ? { ...m, seen: true } : m)
        } : c
      ));
    }
  }, [activeChat, scrollToBottom, currentUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages.length, scrollToBottom]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    const previewUrl = URL.createObjectURL(file);
    const currentConv = conversations.find(c => c.id === activeChat);
    let expiresAt: number | undefined = undefined;
    if (currentConv?.vanishMode && currentConv.vanishDuration) {
      expiresAt = Date.now() + currentConv.vanishDuration * 1000;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: CURRENT_USER_ID,
      text: type === 'image' ? 'Sent an image' : type === 'video' ? 'Sent a video' : `Sent a file: ${file.name}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
      type: type,
      attachment: previewUrl,
      expiresAt: expiresAt,
    };

    // Update local state for immediate response
    // Update local state for immediate response and reorder
    setConversations(prev => {
      const activeIdx = prev.findIndex(c => c.id === activeChat);
      if (activeIdx === -1) return prev;
      
      const updatedConv = {
        ...prev[activeIdx],
        messages: [...prev[activeIdx].messages, newMessage],
        lastMessage: type === 'image' ? '📷 Image' : type === 'video' ? '🎥 Video' : '📄 File',
        lastMessageTime: 'Just now',
        rawLastMessageTime: new Date().toISOString()
      };
      
      const filtered = prev.filter(c => c.id !== activeChat);
      const result = [updatedConv, ...filtered];
      
      // Update both caches instantly
      OfflineManager.saveData(`convs_${currentUserId}`, result);
      OfflineManager.saveData(`msgs_${activeChat}`, updatedConv.messages);
      
      return result;
    });

    setShowShareMenu(false);

    try {
      // 1. Upload to server
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', type === 'video' ? 'videos' : 'images');
      const uploadRes = await uploadMedia(formData);

      // 2. Persist to DB
      const res = await dbSendMessage({
        conversationId: activeChat,
        senderId: currentUserId,
        text: newMessage.text,
        type: type,
        attachment: uploadRes.url,
        replyTo: replyingTo?.id,
      });

      if (res.conversationId && res.conversationId !== activeChat) {
        setActiveChat(res.conversationId);
        setConversations(prev => prev.map(c => c.id === activeChat ? { ...c, id: res.conversationId } : c));
      }

      // Update status to sent
      setConversations(prev => prev.map(conv => {
        if (conv.id === activeChat) {
          return {
            ...conv,
            messages: conv.messages.map(m => m.id === newMessage.id ? { ...m, status: 'sent', attachment: uploadRes.url } : m)
          };
        }
        return conv;
      }));
      setReplyingTo(null);
    } catch (err) {
      console.error('File upload error:', err);
      setConversations(prev => prev.map(conv => {
        if (conv.id === activeChat) {
          return {
            ...conv,
            messages: conv.messages.map(m => m.id === newMessage.id ? { ...m, status: 'error' } : m)
          };
        }
        return conv;
      }));
    }
  };

  const triggerUpload = (ref: React.RefObject<HTMLInputElement | null>) => {
    ref.current?.click();
  };
  const sendMessage = async () => {
    if (!messageInput.trim() || !activeChat) return;
    
    const currentConv = conversations.find(c => c.id === activeChat);
    let expiresAt: number | undefined = undefined;
    if (currentConv?.vanishMode && currentConv.vanishDuration) {
      expiresAt = Date.now() + currentConv.vanishDuration * 1000;
    }

    const tempId = `m${Date.now()}`;
    const msgText = messageInput.trim();

    const newMsg: Message = {
      id: tempId,
      senderId: currentUserId, // Use real user ID instead of 'me'
      text: msgText,
      timestamp: new Date().toISOString(), // Use ISO string for reliable parsing
      seen: false,
      type: 'text',
      replyTo: replyingTo?.id,
      expiresAt: expiresAt,
      status: 'sending',
    };

    // Optimistic UI update — message appears instantly
    const activeIdx = conversations.findIndex(c => c.id === activeChat);
    if (activeIdx !== -1) {
      const updatedConv = { 
        ...conversations[activeIdx], 
        messages: [...conversations[activeIdx].messages, newMsg], 
        lastMessage: newMsg.text, 
        lastMessageTime: 'Just now',
        rawLastMessageTime: new Date().toISOString()
      };

      const filtered = conversations.filter(c => c.id !== activeChat);
      const result = [updatedConv, ...filtered];

      // 1. Update React state instantly
      setConversations(result);

      // 2. Save to Cache in the background (prevents freezing the UI)
      setTimeout(() => {
        OfflineManager.saveData(`convs_${currentUserId}`, result);
        OfflineManager.saveData(`msgs_${activeChat}`, updatedConv.messages);
      }, 0);
    }
    setMessageInput('');
    setReplyingTo(null);
    setShowEmojiPicker(false);

    const messagePayload = {
      conversationId: activeChat,
      senderId: currentUserId,
      text: msgText,
      type: 'text',
      replyTo: newMsg.replyTo,
    };

    // Check network and decide: send now or queue for later
    const online = await OfflineManager.isOnline();

    if (online) {
      try {
        // Trigger Pusher event for instant delivery to the other user
        if (pusherRef.current) {
          const chatChannel = pusherRef.current.channel(`private-chat-${activeChat}`);
          if (chatChannel) {
            try {
              chatChannel.trigger('client-new-message', { ...newMsg, status: 'sent' });
            } catch (e) {
              console.error('Failed to trigger Pusher event:', e);
            }
          }
        }

        const res = await dbSendMessage(messagePayload);

        // Mark as sent in UI
        setConversations(prev => prev.map(c => {
          const isTargetConv = c.id === activeChat || c.id === res.conversationId;
          if (!isTargetConv) return c;
          return {
            ...c,
            id: res.conversationId || c.id,
            messages: c.messages.map(m => m.id === tempId ? { ...m, id: res.id || m.id, status: 'sent' as const } : m),
          };
        }));

        if (res.conversationId && res.conversationId !== activeChat) {
          setActiveChat(res.conversationId);
          const newParams = new URLSearchParams(searchParams.toString());
          newParams.delete('userId');
          newParams.set('chatId', res.conversationId);
          router.replace(`/messages?${newParams.toString()}`, { scroll: false });
        }
      } catch (err) {
        console.error('Send message error, queuing offline:', err);
        // Send failed — queue for background sync
        const offlineId = await OfflineManager.queueMessage(messagePayload);
        setConversations(prev => prev.map(c => ({
          ...c,
          messages: c.messages.map(m => m.id === tempId ? { ...m, id: offlineId, status: 'sending' as const } : m),
        })));
        setPendingCount(await OfflineManager.getPendingCount());
      }
    } else {
      // Device is offline — queue the message
      const offlineId = await OfflineManager.queueMessage(messagePayload);
      setConversations(prev => prev.map(c => ({
        ...c,
        messages: c.messages.map(m => m.id === tempId ? { ...m, id: offlineId, status: 'sending' as const } : m),
      })));
      setPendingCount(await OfflineManager.getPendingCount());
    }
  };


  const sendHeart = async () => {
    if (!activeChat) return;
    const tempId = `m${Date.now()}`;
    const heartMsg: Message = {
      id: tempId,
      senderId: CURRENT_USER_ID,
      text: '❤️',
      timestamp: 'Just now',
      seen: false,
      type: 'heart',
      status: 'sending',
    };
    
    setConversations(prev => {
      const activeIdx = prev.findIndex(c => c.id === activeChat);
      if (activeIdx === -1) return prev;

      const updatedConv = { 
        ...prev[activeIdx], 
        messages: [...prev[activeIdx].messages, heartMsg], 
        lastMessage: '❤️', 
        lastMessageTime: 'Just now',
        rawLastMessageTime: new Date().toISOString()
      };

      const filtered = prev.filter(c => c.id !== activeChat);
      const result = [updatedConv, ...filtered];
      
      // Update both caches instantly
      OfflineManager.saveData(`convs_${currentUserId}`, result);
      OfflineManager.saveData(`msgs_${activeChat}`, updatedConv.messages);
      
      return result;
    });

    const heartPayload = {
      conversationId: activeChat,
      senderId: currentUserId,
      text: '❤️',
      type: 'heart',
    };

    const online = await OfflineManager.isOnline();

    if (online) {
      try {
        const res = await dbSendMessage(heartPayload);
        setConversations(prev => prev.map(c => ({
          ...c,
          messages: c.messages.map(m => m.id === tempId ? { ...m, id: res.id || m.id, status: 'sent' as const } : m),
        })));
      } catch (err) {
        console.error('Send heart error, queuing offline:', err);
        const offlineId = await OfflineManager.queueMessage(heartPayload);
        setConversations(prev => prev.map(c => ({
          ...c,
          messages: c.messages.map(m => m.id === tempId ? { ...m, id: offlineId, status: 'sending' as const } : m),
        })));
        setPendingCount(await OfflineManager.getPendingCount());
      }
    } else {
      const offlineId = await OfflineManager.queueMessage(heartPayload);
      setConversations(prev => prev.map(c => ({
        ...c,
        messages: c.messages.map(m => m.id === tempId ? { ...m, id: offlineId, status: 'sending' as const } : m),
      })));
      setPendingCount(await OfflineManager.getPendingCount());
    }
  };

  const addReaction = (msgId: string, emoji: string) => {
    if (!activeChat) return;
    setConversations(prev => prev.map(c =>
      c.id === activeChat
        ? {
          ...c,
          messages: c.messages.map(m =>
            m.id === msgId
              ? { ...m, reactions: [...(m.reactions || []), emoji] }
              : m
          ),
        }
        : c
    ));
    setLongPressMsg(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };



  const filteredConversations = conversations
    .filter(c => {
      // Show if it has messages OR if it's the currently active chat
      const isNew = String(c.id).startsWith('new_');
      if (isNew) {
        return c.id === activeChat || c.messages.length > 0;
      }
      // For existing chats, search by name
      return c.user.name.toLowerCase().includes(searchQuery.toLowerCase());
    })

    .sort((a, b) => {
      // 1. Draft conversations (new_) always on top
      const aNew = String(a.id).startsWith('new_');
      const bNew = String(b.id).startsWith('new_');
      if (aNew !== bNew) return aNew ? -1 : 1;

      // 2. Prioritize conversations with unread messages
      if (a.unreadCount !== b.unreadCount) {
        return b.unreadCount - a.unreadCount;
      }

      // 3. Sort by raw timestamp (ISO string) desc
      const getTime = (c: any) => {
        if (c.rawLastMessageTime) {
          const t = new Date(c.rawLastMessageTime).getTime();
          if (!isNaN(t)) return t;
        }
        return 0;
      };

      const timeA = getTime(a);
      const timeB = getTime(b);

      if (timeA !== timeB) {
        return timeB - timeA;
      }

      // 4. Fallback for "Just now" (though rawLastMessageTime should handle it)
      if (a.lastMessageTime === 'Just now' && b.lastMessageTime !== 'Just now') return -1;
      if (a.lastMessageTime !== 'Just now' && b.lastMessageTime === 'Just now') return 1;

      return 0;
    });

  const handleMsgTouchStart = (msg: Message) => {
    longPressTimer.current = setTimeout(() => {
      setSelectedMessage(msg);
      // We can keep reaction popover or move it too. User said "option will appear in header"
      // so we'll move actions to header.
    }, 500);
  };

  const handleMsgTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  /* ─── CHAT INFO PANEL ─── */
  const renderChatInfo = () => {
    if (!activeConversation || !showChatInfo) return null;
    const { user } = activeConversation;
    return (
      <div className="msg-chat-info-overlay" onClick={() => setShowChatInfo(false)}>
        <div className="msg-chat-info-panel" onClick={e => e.stopPropagation()}>
          <button className="msg-chat-info-close" onClick={() => setShowChatInfo(false)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
            <Link href={user.id === 'me' ? '/profile' : `/profile/${user.id}`} className="msg-info-avatar-section" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className={`msg-info-avatar-ring ${user.online ? 'online' : ''}`}>
                <div className="msg-info-avatar-circle">
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : user.avatar}
                </div>
              </div>
              <h2 className="msg-info-name">{user.name}</h2>
              <span className="msg-info-status">{onlineUserIds.has(user.id) ? 'Active now' : `Offline`}</span>
            </Link>
          <div className="msg-info-actions">
            <Link href={`/profile/${user.id}`} className="msg-info-action-btn" style={{ textDecoration: 'none' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>Profile</span>
            </Link>
            <button className="msg-info-action-btn" onClick={() => { startCall('voice'); setShowChatInfo(false); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span>Audio</span>
            </button>
            <button className="msg-info-action-btn" onClick={() => { startCall('video'); setShowChatInfo(false); }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <span>Video</span>
            </button>
            <button 
              className={`msg-info-action-btn ${activeConversation.muted ? 'active' : ''}`} 
              onClick={toggleMute} 
              style={{ cursor: 'pointer' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill={activeConversation.muted ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {activeConversation.muted ? (
                  <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                ) : (
                  <>
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  </>
                )}
              </svg>
              <span>{activeConversation.muted ? 'Unmute' : 'Mute'}</span>
            </button>
          </div>
          <div className="msg-info-section">
            <h3>Chat Settings</h3>
            <div className={`msg-info-option ${activeConversation.vanishMode ? 'active' : ''}`} onClick={toggleVanishMode} style={{ cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill={activeConversation.vanishMode ? 'var(--primary)' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Vanish Mode</span>
              <div className={`msg-toggle-switch ${activeConversation.vanishMode ? 'on' : ''}`}>
                <div className="msg-toggle-slider" />
              </div>
            </div>
            <div className="msg-info-option danger" onClick={() => setShowBlockConfirm(true)} style={{ cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              <span>Block User</span>
            </div>
            <div className="msg-info-option danger" onClick={() => setShowDeleteConfirm(true)} style={{ cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Delete Chat</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ─── CONVERSATION LIST ─── */
  const renderConversationList = () => {
    return (
      <div className={`msg-list-panel ${activeChat ? 'msg-list-hidden-mobile' : ''}`}>
      {/* Header */}
      <div className="msg-list-header">
        <div className="msg-list-header-top">
          <h1 className="msg-list-title">Messages</h1>
        </div>
        {/* Search */}
        <div className="msg-search-wrapper">
          <svg className="msg-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="msg-search-input"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        {/* Story + Online now row */}
        <div className="msg-online-row">
          {/* Your Story */}
          <div className="msg-online-avatar-btn add-story-btn">
            <div 
              className={`msg-online-avatar-ring ${myStories.length > 0 ? 'has-story' : 'add-story'}`}
              onClick={() => myStories.length > 0 ? openStory(0) : setShowCreateStory(true)}
              style={{ cursor: 'pointer' }}
            >
              {myStories.length > 0 ? (
                <div className="msg-online-avatar" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>✦</div>
              ) : (
                <div className="msg-add-story-icon-wrapper">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
              {/* Always keep the "+" badge reachable for adding more stories */}
              <div 
                className="msg-add-story-plus" 
                onClick={(e) => { e.stopPropagation(); setShowCreateStory(true); }}
                title="Add to story"
              >+</div>
            </div>
            <span className="msg-online-name">Your story</span>
          </div>
          {/* Friends with stories first, then online without stories */}
          {(() => {
            const viewable = allViewableStories();
            const storyUserIds = stories.map(s => s.userId);
            const friendsWithStories = stories.map((story, idx) => {
              const conv = conversations.find(c => c.user.id === story.userId);
              if (!conv) return null;
              const storyIdx = myStories.length > 0 ? idx + 1 : idx;
              return (
                <button
                  key={`story-${story.userId}`}
                  className="msg-online-avatar-btn"
                  onClick={() => openStory(storyIdx)}
                >
                  <div className={`msg-online-avatar-ring ${story.seen ? 'story-seen' : 'has-story'}`}>
                    <div className="msg-online-avatar">
                      {conv.user.profilePicture ? (
                        <img src={conv.user.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      ) : conv.user.avatar}
                    </div>
                  </div>
                  {conv.user.online && <span className="msg-online-dot" />}
                  <span className="msg-online-name">{conv.user.name.split(' ')[0]}</span>
                </button>
              );
            });
            const onlineWithoutStories = conversations
              .filter(c => c.user.online && !storyUserIds.includes(c.user.id))
              .map(c => (
                <button
                  key={c.id}
                  className="msg-online-avatar-btn"
                  onClick={() => router.push(`/messages?chatId=${c.id}`, { scroll: false })}
                >
                  <div className="msg-online-avatar-ring">
                    <div className="msg-online-avatar">
                      {c.user.profilePicture ? (
                        <img src={c.user.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      ) : c.user.avatar}
                    </div>
                  </div>
                  <span className="msg-online-dot" />
                  <span className="msg-online-name">{c.user.name.split(' ')[0]}</span>
                </button>
              ));
            return friendsWithStories.filter(Boolean);
          })()}
        </div>
      </div>

      {/* Conversation items */}
      <div className="msg-conversation-list">
        {filteredConversations.length === 0 && searchQuery.trim() && searchResults.length === 0 && (
          <div className="msg-search-empty">No conversations found</div>
        )}

        {filteredConversations.map(conv => (
          <button
            key={conv.id}
            className={`msg-conversation-item ${activeChat === conv.id ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`}
            onClick={() => router.push(`/messages?chatId=${conv.id}`, { scroll: false })}
          >
            <div className="msg-conv-avatar-wrapper">
              <div className={`msg-conv-avatar ${onlineUserIds.has(conv.user.id) ? 'online' : ''}`}>
                {conv.user.profilePicture ? (
                  <img src={conv.user.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : conv.user.avatar}
              </div>
              {onlineUserIds.has(conv.user.id) && <span className="msg-conv-online-dot" />}
            </div>
            <div className="msg-conv-content">
              <div className="msg-conv-top">
                <span className="msg-conv-name">{conv.user.name}</span>
                <span className={`msg-conv-time ${conv.unreadCount > 0 ? 'unread' : ''}`}>
                  {conv.lastMessageTime}
                </span>
              </div>
              <div className="msg-conv-bottom">
                <span className={`msg-conv-preview ${conv.unreadCount > 0 ? 'unread' : ''}`}>
                  {conv.isTyping ? (
                    <span className="msg-typing-text">typing<span className="msg-typing-dots"><span>.</span><span>.</span><span>.</span></span></span>
                  ) : (
                    conv.lastMessage
                  )}
                </span>
                {conv.unreadCount > 0 && (
                  <span className="msg-conv-badge">{conv.unreadCount}</span>
                )}
                {conv.muted && (
                  <svg className="msg-conv-muted-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                  </svg>
                )}
              </div>
            </div>
          </button>
        ))}

        {/* Global Search Results */}
        {searchResults.length > 0 && (
          <div className="msg-search-results-section">
            <h3 className="msg-search-results-title">Other Users</h3>
            {searchResults.map(user => {
              const displayName = (user.name && user.name.includes('/uploads/')) 
                ? (user.username || 'User') 
                : (user.name || 'Unknown User');
              
              return (
                <button
                  key={user.id}
                  className="msg-conversation-item search-result"
                  onClick={async () => {
                    const newConv: Conversation = {
                      id: `new_${user.id}`,
                      user: {
                        id: user.id,
                        name: displayName,
                        avatar: displayName ? displayName.substring(0, 1) : '👤',
                        profilePicture: user.profilePicture,
                        online: false,
                      },
                      lastMessage: '',
                      lastMessageTime: '',
                      rawLastMessageTime: '',
                      unreadCount: 0,
                      isTyping: false,
                      muted: false,
                      vanishMode: false,
                      vanishDuration: 3600,
                      messages: [],
                    };
                    setConversations(prev => {
                        if (prev.find(c => c.id === newConv.id)) return prev;
                        return [newConv, ...prev];
                    });
                    router.push(`/messages?userId=${user.id}`, { scroll: false });
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                >
                  <div className="msg-conv-avatar-wrapper">
                    <div className="msg-conv-avatar">
                      {user.profilePicture ? <img src={user.profilePicture} alt="" /> : displayName.charAt(0)}
                    </div>
                  </div>
                  <div className="msg-conv-content">
                    <div className="msg-conv-top">
                      <span className="msg-conv-name">{displayName}</span>
                    </div>
                    <div className="msg-conv-bottom">
                      <span className="msg-conv-preview">@{user.username}</span>
                    </div>
                  </div>
                </button>
              );
            })}

          </div>
        )}
      </div>
    </div>
    );
  };

  /* ─── CHAT VIEW ─── */
  const renderChatView = () => {
    if (!activeConversation) {
      return (
        <div className={`msg-chat-panel msg-empty-state ${activeChat === null ? '' : ''}`}>
          <div className="msg-empty-content">
            <div className="msg-empty-icon-wrapper">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                <path d="M8 12h.01" strokeWidth="2.5" />
                <path d="M12 12h.01" strokeWidth="2.5" />
                <path d="M16 12h.01" strokeWidth="2.5" />
              </svg>
            </div>
            <h2>Your Messages</h2>
            <p>Send private messages to friends and classmates</p>
            <button className="msg-empty-cta">Send Message</button>
          </div>
        </div>
      );
    }

    const { user, messages } = activeConversation;

    return (
      <div className={`msg-chat-panel ${activeChat ? 'msg-chat-visible-mobile' : ''} ${activeConversation.vanishMode ? 'vanish-mode' : ''}`}>
        {/* Chat Header */}
        <div className={`msg-chat-header ${selectedMessage ? 'message-selected' : ''}`}>
          {selectedMessage ? (
            <div className="msg-header-selection-mode">
              <button className="msg-header-action-back" onClick={() => setSelectedMessage(null)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <span className="msg-header-selection-count">1 Selected</span>
              <div className="msg-header-selection-actions">
                <button className="msg-header-action-btn" title="Reply" onClick={() => { setReplyingTo(selectedMessage); setSelectedMessage(null); }}>
                   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 14l-5-5 5-5"/><path d="M4 9h12a5 5 0 0 1 0 10H7"/></svg>
                </button>
                {(selectedMessage.type === 'file' || selectedMessage.type === 'image' || selectedMessage.type === 'video') && selectedMessage.attachment && (
                  <a 
                    href={selectedMessage.attachment} 
                    download 
                    className="msg-header-action-btn" 
                    title="Download"
                    onClick={() => setSelectedMessage(null)}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </a>
                )}
                {(selectedMessage.senderId === 'me' || selectedMessage.senderId === currentUserId) && selectedMessage.type === 'text' && (
                  <button className="msg-header-action-btn" title="Edit" onClick={() => { handleEditMessage(selectedMessage); setSelectedMessage(null); }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                )}
                {(selectedMessage.senderId === 'me' || selectedMessage.senderId === currentUserId) && (
                  <button className="msg-header-action-btn danger" title="Delete" onClick={() => { handleDeleteMessage(selectedMessage.id); setSelectedMessage(null); }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                )}
              </div>

            </div>
          ) : (
            <>
              <button className="msg-back-btn" onClick={closeChat}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <div className="msg-chat-header-user">
                <div className={`msg-chat-header-avatar ${user.online ? 'online' : ''}`}>
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                  ) : user.avatar}
                </div>
                <div className="msg-chat-header-info">
                  <span className="msg-chat-header-name">{user.name}</span>
                  <span className="msg-chat-header-status">
                    {activeConversation.isTyping ? (
                      <span className="msg-typing-indicator">typing<span className="msg-typing-dots"><span>.</span><span>.</span><span>.</span></span></span>
                    ) : onlineUserIds.has(user.id) ? 'Active now' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="msg-chat-header-actions">
                <button className="msg-chat-action-btn" aria-label="Audio call" onClick={() => startCall('voice')}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </button>
                <button className="msg-chat-action-btn" aria-label="Video call" onClick={() => startCall('video')}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polygon points="23 7 16 12 23 17 23 7" />
                    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                  </svg>
                </button>
                <button className="msg-chat-action-btn" aria-label="More options" onClick={() => setShowChatInfo(!showChatInfo)}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Offline Banner */}
        {!isOnline && (
          <div className="msg-offline-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" />
            </svg>
            <span>No internet {pendingCount > 0 ? `· ${pendingCount} message${pendingCount > 1 ? 's' : ''} queued` : '· Messages will send when you reconnect'}</span>
          </div>
        )}

        {/* Messages Area */}
        <div className={`msg-messages-area ${activeConversation.vanishMode ? 'vanish-mode' : ''}`}>
          {activeConversation.vanishMode && (
            <div className="msg-vanish-notice">
              <div className="msg-vanish-notice-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </div>
              <span>Vanish mode is on</span>
              <p>Seen messages will disappear when you close the chat.</p>
            </div>
          )}
          {/* Chat intro */}
          <Link href={user.id === 'me' ? '/profile' : `/profile/${user.id}`} className="msg-chat-intro" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className={`msg-intro-avatar-ring ${user.online ? 'online' : ''}`}>
              <div className="msg-intro-avatar">
                {user.profilePicture ? (
                  <img src={user.profilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : user.avatar}
              </div>
            </div>
            <h3 className="msg-intro-name">{user.name}</h3>
            <p className="msg-intro-subtitle">ProxyPress · You both follow each other</p>
          </Link>

          {/* Message bubbles */}
          {messages.map((msg, i) => {
            const isMine = msg.senderId !== user.id;

            const isLastInGroup = i === messages.length - 1 || messages[i + 1]?.senderId !== msg.senderId;

            return (
              <div
                key={msg.id}
                className={`msg-bubble-row ${isMine ? 'mine' : 'theirs'} ${isLastInGroup ? 'last-in-group' : ''} ${selectedMessage?.id === msg.id ? 'selected' : ''}`}
                onMouseDown={() => handleMsgTouchStart(msg)}
                onMouseUp={handleMsgTouchEnd}
                onTouchStart={() => handleMsgTouchStart(msg)}
                onTouchEnd={handleMsgTouchEnd}
              >

                <div className="msg-bubble-content-wrapper">
                  <div className={`msg-bubble ${isMine ? 'mine' : 'theirs'} ${msg.type === 'heart' ? 'heart-msg' : ''} ${msg.attachment ? 'has-attachment' : ''} ${msg.isDeleted ? 'deleted' : ''}`}>
                    {msg.isDeleted ? (
                      <p className="msg-bubble-text deleted-text">
                        This message was deleted
                      </p>
                    ) : editingMessageId === msg.id ? (
                      <div className="msg-edit-wrapper">
                        <input
                          autoFocus
                          className="msg-edit-input"
                          value={editingText}
                          onChange={e => setEditingText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveEdit();
                            if (e.key === 'Escape') setEditingMessageId(null);
                          }}
                        />
                        <div className="msg-edit-actions">
                           <button onClick={() => setEditingMessageId(null)}>Cancel</button>
                           <button onClick={handleSaveEdit} className="save">Save</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {msg.replyTo && (
                          <div className="msg-quoted-reply">
                            {(() => {
                              const quoted = messages.find(m => m.id === msg.replyTo);
                              const getQuotedText = () => {
                                if (!quoted) return 'Message unavailable';
                                if (quoted.isDeleted) return 'Deleted message';
                                if (quoted.type === 'image') return '📷 Photo';
                                if (quoted.type === 'video') return '🎥 Video';
                                if (quoted.type === 'voice') return '🎤 Voice message';
                                if (quoted.type === 'file') return '📄 File';
                                if (quoted.type === 'heart') return '❤️ Love';
                                return quoted.text;
                              };
                              return (
                                <>
                                  <span className="msg-quoted-name">{quoted?.senderId === 'me' ? 'You' : user.name}</span>
                                  <p className="msg-quoted-text">{getQuotedText()}</p>
                                </>
                              );
                            })()}
                          </div>
                        )}
                        {msg.type === 'heart' ? (
                          <span className="msg-heart-emoji">❤️</span>
                         ) : msg.attachment && msg.type === 'image' ? (
                           <div 
                             className="msg-image-attachment"
                             onClick={(e) => {
                               e.stopPropagation();
                               setLightboxMedia({
                                 url: msg.attachment!,
                                 msgId: msg.id,
                                 sender: isMine ? 'You' : user.name,
                                 time: msg.timestamp,
                                 type: 'image'
                               });
                               setLightboxControlsVisible(true);
                             }}

                           >
                             <img src={msg.attachment} alt="Uploaded" className="msg-attachment-media" />
                           </div>

                         ) : msg.attachment && msg.type === 'video' ? (
                           <div 
                             className="msg-video-attachment"
                             onClick={(e) => {
                               e.stopPropagation();
                               setLightboxMedia({
                                 url: msg.attachment!,
                                 msgId: msg.id,
                                 sender: isMine ? 'You' : user.name,
                                 time: msg.timestamp,
                                 type: 'video'
                               });
                               setLightboxControlsVisible(true);
                             }}
                           >
                             <video src={msg.attachment} className="msg-attachment-media" controls={false} />
                             <div className="msg-video-overlay">
                               <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                             </div>
                           </div>

                        ) : msg.attachment && msg.type === 'file' ? (
                          <div className="msg-file-attachment">
                            <div className="msg-file-icon">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            </div>
                            <div className="msg-file-info">
                              <span className="msg-file-name">{msg.text.replace('Sent a file: ', '')}</span>
                              <span className="msg-file-size">File Attachment</span>
                            </div>
                          </div>
                        ) : msg.attachment && msg.type === 'voice' ? (
                          <div className="msg-voice-attachment">
                            <div 
                              className="msg-voice-play-btn"
                              onClick={() => toggleVoicePlay(msg.id, msg.attachment!)}
                            >
                              {playingVoiceId === msg.id ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                  <rect x="6" y="4" width="4" height="16" />
                                  <rect x="14" y="4" width="4" height="16" />
                                </svg>
                              ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              )}
                            </div>
                            <div className="msg-voice-waveform">
                              <div className={`msg-voice-line ${playingVoiceId === msg.id ? 'playing' : ''}`} style={{ height: '40%' }} />
                              <div className={`msg-voice-line ${playingVoiceId === msg.id ? 'playing' : ''}`} style={{ height: '70%' }} />
                              <div className={`msg-voice-line ${playingVoiceId === msg.id ? 'playing' : ''}`} style={{ height: '100%' }} />
                              <div className={`msg-voice-line ${playingVoiceId === msg.id ? 'playing' : ''}`} style={{ height: '60%' }} />
                              <div className={`msg-voice-line ${playingVoiceId === msg.id ? 'playing' : ''}`} style={{ height: '80%' }} />
                              <div className={`msg-voice-line ${playingVoiceId === msg.id ? 'playing' : ''}`} style={{ height: '50%' }} />
                              <div className={`msg-voice-line ${playingVoiceId === msg.id ? 'playing' : ''}`} style={{ height: '30%' }} />
                            </div>
                          </div>
                        ) : (
                          <p className="msg-bubble-text">{msg.text}</p>
                        )}
                        <div className="msg-bubble-status-row">
                          {msg.isEdited && <span className="msg-edited-tag">Edited</span>}
                          {(msg as any).expiresAt && (
                            <div className="msg-vanish-timer" title="This message will vanish">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {/* Reactions */}
                  {msg.reactions && msg.reactions.length > 0 && (
                    <div className={`msg-reactions ${isMine ? 'mine' : 'theirs'}`}>
                      {msg.reactions.map((r, ri) => (
                        <span key={ri} className="msg-reaction">{r}</span>
                      ))}
                    </div>
                  )}
                  {/* Timestamp + seen */}
                  {isLastInGroup && (
                    <div className={`msg-meta ${isMine ? 'mine' : 'theirs'}`}>
                      <span className="msg-time">{formatMessageTime(msg.timestamp)}</span>
                      {isMine && (
                        <div className={`msg-seen-status ${msg.seen ? 'seen' : ''}`}>
                          {msg.status === 'sending' ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                          ) : msg.status === 'error' ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ff4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                          ) : (
                            <div className={`msg-status-icons ${msg.seen ? 'seen' : ''}`}>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="tick-1">
                                <polyline points="4 12 9 17 20 6" />
                              </svg>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="tick-2">
                                <polyline points="4 12 9 17 20 6" />
                              </svg>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Reactions popover (optional, keeping for emoji only if needed, but moving all to header for now) */}
                  {longPressMsg === msg.id && !msg.isDeleted && (
                    <div className="msg-reaction-popover">
                      {['❤️', '😂', '😮', '😢', '😡', '👍'].map(emoji => (
                        <button key={emoji} className="msg-reaction-choice" onClick={() => addReaction(msg.id, emoji)}>
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {activeConversation.isTyping && (
            <div className="msg-bubble-row theirs">

              <div className="msg-bubble theirs">
                <div className="msg-typing-bubble">
                  <span className="msg-typing-dot" />
                  <span className="msg-typing-dot" />
                  <span className="msg-typing-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Reply bar */}
        {replyingTo && (
          <div className="msg-reply-bar">
            <div className="msg-reply-bar-content">
              <span className="msg-reply-bar-label">Replying to</span>
              <span className="msg-reply-bar-text">{replyingTo.text}</span>
            </div>
            <button className="msg-reply-bar-close" onClick={() => setReplyingTo(null)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div className="msg-emoji-picker">
            <div className="msg-emoji-grid">
              {EMOJI_LIST.map(emoji => (
                <button
                  key={emoji}
                  className="msg-emoji-btn"
                  onClick={() => {
                    setMessageInput(prev => prev + emoji);
                    inputRef.current?.focus();
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Share Menu Popup */}
        {showShareMenu && (
          <div className="msg-share-menu">
            <button className="msg-share-item" onClick={() => triggerUpload(imageInputRef)}>
              <div className="msg-share-icon-circle blue">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
              <span>Image</span>
            </button>
            <button className="msg-share-item" onClick={() => triggerUpload(videoInputRef)}>
              <div className="msg-share-icon-circle purple">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
              <span>Video</span>
            </button>
            <button className="msg-share-item" onClick={() => triggerUpload(docInputRef)}>
              <div className="msg-share-icon-circle green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <span>Document</span>
            </button>
          </div>
        )}

        {/* Input Area */}
        <div className="msg-input-area">
          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={imageInputRef}
            className="msg-hidden-input"
            accept="image/*"
            onChange={e => handleFileUpload(e, 'image')}
          />
          <input
            type="file"
            ref={videoInputRef}
            className="msg-hidden-input"
            accept="video/*"
            onChange={e => handleFileUpload(e, 'video')}
          />
          <input
            type="file"
            ref={docInputRef}
            className="msg-hidden-input"
            accept=".pdf,.doc,.docx,.txt"
            onChange={e => handleFileUpload(e, 'file')}
          />
          
          <div className="msg-input-row">
            {!isVoiceRecording ? (
              <>
                <button
                  className={`msg-input-icon-btn ${showShareMenu ? 'active' : ''}`}
                  onClick={() => setShowShareMenu(!showShareMenu)}
                  aria-label="Share options"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </button>
                <div className="msg-input-wrapper">
                  <input
                    ref={inputRef}
                    type="text"
                    className="msg-text-input"
                    placeholder="Message..."
                    value={messageInput}
                    onChange={e => {
                      setMessageInput(e.target.value);
                      sendTypingSignal();
                    }}
                    onKeyDown={handleKeyDown}
                  />
                  <button
                    className={`msg-input-emoji-inline-btn ${showEmojiPicker ? 'active' : ''}`}
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    aria-label="Emoji"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                      <line x1="9" y1="9" x2="9.01" y2="9" />
                      <line x1="15" y1="9" x2="15.01" y2="9" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="msg-recording-bar">
                <div className="msg-recording-indicator">
                  <div className="msg-recording-dot" />
                  <span className="msg-recording-timer">{formatDuration(voiceRecordingDuration)}</span>
                </div>
                <button className="msg-recording-cancel" onClick={() => stopVoiceRecording(false)}>
                  Cancel
                </button>
              </div>
            )}

            <button 
              className={`msg-send-btn ${!messageInput.trim() && !isVoiceRecording ? 'mic-mode' : ''} ${isVoiceRecording ? 'recording' : ''}`}
              onClick={() => {
                if (isVoiceRecording) {
                  stopVoiceRecording(true);
                } else if (messageInput.trim()) {
                  sendMessage();
                } else {
                  startVoiceRecording();
                }
              }}
              aria-label={messageInput.trim() ? "Send message" : isVoiceRecording ? "Stop recording" : "Voice message"}
            >
              {messageInput.trim() ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              ) : isVoiceRecording ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="msg-send-vibe">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ─── OVERLAY DISMISS ─── */
  useEffect(() => {
    const handler = () => {
      setLongPressMsg(null);
      setShowShareMenu(false);
    };
    if (longPressMsg || showShareMenu) {
      document.addEventListener('click', handler);
      return () => document.removeEventListener('click', handler);
    }
  }, [longPressMsg, showShareMenu]);

  /* ─── STORY VIEWER ─── */
  const renderStoryViewer = () => {
    if (activeStoryUserIdx === null) return null;
    const viewable = allViewableStories();
    const currentUser = viewable[activeStoryUserIdx];
    if (!currentUser) return null;
    const currentSlide = currentUser.slides[activeSlideIdx];
    if (!currentSlide) return null;

    return (
      <div className="story-viewer-overlay">
        <div className="story-viewer-container">
          {/* Progress bars */}
          <div className="story-progress-row">
            {currentUser.slides.map((slide, idx) => (
              <div
                key={slide.id}
                className={`story-progress-bar ${idx < activeSlideIdx ? 'completed' : ''} ${idx > activeSlideIdx ? 'upcoming' : ''}`}
              >
                <div
                  className="story-progress-fill"
                  style={{
                    width: idx === activeSlideIdx ? `${storyProgress}%` : idx < activeSlideIdx ? '100%' : '0%',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="story-header">
            <Link 
              href={!currentUser.userId ? '/profile' : (currentUser.userId === 'me' ? '/profile' : `/profile/${currentUser.userId}`)} 
              className="story-header-info-link"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', color: 'inherit' }}
            >
              <div className="story-header-avatar">
                {currentUser.userProfilePicture ? (
                  <img src={currentUser.userProfilePicture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <div className="story-avatar-initials">{currentUser.userAvatar}</div>
                )}
              </div>
              <div className="story-header-info">
                <span className="story-header-name">{currentUser.userName}</span>
                <span className="story-header-time">{currentSlide.timestamp}</span>
              </div>
            </Link>
            <button className="story-close-btn" onClick={closeStoryViewer}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div
            className="story-content-area"
            onMouseDown={() => setStoryPaused(true)}
            onMouseUp={() => setStoryPaused(false)}
            onTouchStart={() => setStoryPaused(true)}
            onTouchEnd={() => setStoryPaused(false)}
          >
            <div
              className={`story-slide ${currentSlide.type !== 'text' ? 'story-slide-media' : ''}`}
              key={currentSlide.id}
              style={{ background: currentSlide.type === 'text' ? currentSlide.gradient : '#000' }}
            >
              {currentSlide.type === 'image' && currentSlide.mediaUrl && (
                <>
                  <img 
                    src={currentSlide.mediaUrl} 
                    alt="Story" 
                    className="story-media-img" 
                    draggable={false}
                  />
                  {currentSlide.caption && (
                    <div className="story-media-caption-bar">
                      <span className="story-media-caption">{currentSlide.caption}</span>
                    </div>
                  )}
                </>
              )}
              {currentSlide.type === 'video' && currentSlide.mediaUrl && (
                <>
                  <video 
                    ref={storyVideoRef}
                    src={currentSlide.mediaUrl} 
                    className="story-media-video" 
                    autoPlay 
                    playsInline
                    loop
                  />
                  {currentSlide.caption && (
                    <div className="story-media-caption-bar">
                      <span className="story-media-caption">{currentSlide.caption}</span>
                    </div>
                  )}
                </>
              )}
              {currentSlide.type === 'text' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  {currentSlide.emoji && <span className="story-slide-emoji">{currentSlide.emoji}</span>}
                  <span className="story-slide-text">{currentSlide.text}</span>
                  {currentSlide.caption && <span className="story-slide-caption">{currentSlide.caption}</span>}
                </div>
              )}
            </div>

            {/* Tap zones */}
            <div className="story-tap-left" onClick={goToPrevSlide} />
            <div className="story-tap-right" onClick={goToNextSlide} />

            {/* Pause indicator */}
            {storyPaused && !storyReaction && (
              <div className="story-paused-indicator">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              </div>
            )}

            {/* Reaction animation */}
            {storyReaction && (
              <div className="story-reaction-toast">{storyReaction}</div>
            )}
          </div>

          {/* Footer - Reply + reactions */}
          <div className="story-footer">
            {currentUser.userId !== 'me' ? (
              <>
                <div className="story-quick-reactions">
                  {['❤️', '😂', '😮', '🔥'].map(emoji => (
                    <button key={emoji} className="story-quick-reaction-btn" onClick={() => handleStoryReaction(emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="story-reply-row">
                  <input
                    ref={storyReplyInputRef}
                    type="text"
                    className="story-reply-input"
                    placeholder={`Reply to ${currentUser.userName.split(' ')[0]}...`}
                    value={storyReply}
                    onChange={e => setStoryReply(e.target.value)}
                    onKeyDown={handleStoryReplyKeyDown}
                    onFocus={() => setStoryPaused(true)}
                    onBlur={() => setStoryPaused(false)}
                  />
                  <button className="story-reply-send-btn" onClick={sendStoryReply}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="story-footer-my-view">
                <div className="story-quick-reactions">
                  {['❤️', '😂', '😮', '🔥'].map(emoji => (
                    <button key={emoji} className="story-quick-reaction-btn" onClick={() => handleStoryReaction(emoji)}>
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="story-my-stats">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  <span>Activity</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ─── CREATE STORY MODAL (WhatsApp-Style Full Screen) ─── */
  const renderCreateStoryModal = () => {
    if (!showCreateStory) return null;

    const canPost = createStoryTab === 'text' 
      ? createStoryText.trim().length > 0 
      : createStoryTab === 'camera'
        ? false
        : createStoryMedia !== null;

    const closeCreateModal = () => {
      setShowCreateStory(false);
      removeStoryMedia();
      setCreateStoryTab('text');
      stopCamera();
      setCameraCaptured(null);
      setCameraCapturedType(null);
    };

    const currentGradient = STORY_GRADIENTS[createStoryGradient];

    return (
      <div className="wa-story-fullscreen" id="create-story-screen">
        {/* Hidden file inputs */}
        <input
          type="file"
          ref={storyMediaInputRef}
          style={{ display: 'none' }}
          accept="image/*,video/*"
          onChange={handleStoryMediaUpload}
        />
        {/* We can safely remove storyVideoInputRef since unified input handles both */}
        <canvas ref={cameraCanvasRef} style={{ display: 'none' }} />

        {/* ═══ TEXT MODE ═══ */}
        {createStoryTab === 'text' && (
          <div className="wa-story-text-mode" style={{ background: currentGradient }}>
            {/* Top bar */}
            <div className="wa-story-topbar">
              <button className="wa-story-close-btn" onClick={closeCreateModal} id="story-close-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className="wa-story-topbar-actions">
                <button
                  className="wa-story-icon-btn"
                  onClick={() => setCreateStoryGradient(prev => (prev + 1) % STORY_GRADIENTS.length)}
                  title="Change background"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/><circle cx="8.5" cy="15.5" r="2.5"/>
                    <path d="M13.5 9a5 5 0 0 1 4 6M13.5 9a5 5 0 0 0-4 6"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Text Input Area - centered */}
            <div className="wa-story-text-center">
              <textarea
                className="wa-story-text-input"
                placeholder="Type a status..."
                value={createStoryText}
                onChange={e => setCreateStoryText(e.target.value)}
                maxLength={200}
                autoFocus
              />
            </div>

            {/* Gradient Selector Strip */}
            <div className="wa-story-gradient-strip">
              {STORY_GRADIENTS.map((gradient, idx) => (
                <button
                  key={idx}
                  className={`wa-story-gradient-dot ${createStoryGradient === idx ? 'active' : ''}`}
                  style={{ background: gradient }}
                  onClick={() => setCreateStoryGradient(idx)}
                />
              ))}
            </div>

            {/* Bottom Controls */}
            <div className="wa-story-bottom-bar">
              <div className="wa-story-mode-switcher">
                <button className={`wa-story-mode-btn ${createStoryTab === 'text' ? 'active' : ''}`} onClick={() => setCreateStoryTab('text')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
                  </svg>
                  <span>Text</span>
                </button>
                <button className={`wa-story-mode-btn ${(createStoryTab as string) === 'camera' ? 'active' : ''}`} onClick={() => setCreateStoryTab('camera')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                  </svg>
                  <span>Camera</span>
                </button>
              </div>
              <button
                className="wa-story-send-fab"
                disabled={!canPost}
                onClick={handleCreateStory}
                id="story-send-btn"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ═══ CAMERA MODE ═══ */}
        {createStoryTab === 'camera' && (
          <div className="wa-story-camera-mode">
            {/* Camera viewfinder */}
            <div className="wa-story-camera-vf">
              {!cameraCaptured ? (
                <>
                  <video
                    ref={cameraPreviewRef}
                    className={`wa-story-cam-feed ${cameraFacing === 'user' ? 'mirrored' : ''}`}
                    autoPlay
                    playsInline
                    muted
                  />
                  {!cameraActive && (
                    <div className="wa-story-cam-loading">
                      <div className="wa-story-cam-spinner" />
                      <span>Starting camera...</span>
                    </div>
                  )}
                  {cameraRecording && (
                    <div className="wa-story-rec-indicator">
                      <span className="wa-story-rec-dot" />
                      <span>{String(Math.floor(cameraRecordTime / 60)).padStart(2, '0')}:{String(cameraRecordTime % 60).padStart(2, '0')}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {cameraCapturedType === 'image' ? (
                    <img src={cameraCaptured} alt="Captured" className="wa-story-cam-feed" />
                  ) : (
                    <video 
                      key={cameraCaptured}
                      src={cameraCaptured} 
                      className="wa-story-cam-feed" 
                      autoPlay 
                      loop 
                      playsInline 
                    />
                  )}
                </>
              )}
            </div>

            {/* Top bar on camera */}
            <div className="wa-story-topbar wa-story-topbar-cam">
              <button 
                className="wa-story-close-btn" 
                onClick={closeCreateModal}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className="wa-story-topbar-actions">
                {!cameraCaptured && (
                  <button className="wa-story-icon-btn" onClick={flipCamera} title="Flip camera">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                      <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Camera bottom controls */}
            <div className="wa-story-cam-bottom">
              {!cameraCaptured ? (
                <>
                  {/* Gallery button */}
                  <button className="wa-story-gallery-btn" onClick={() => storyMediaInputRef.current?.click()} title="Gallery">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </button>

                  {/* Shutter / Record */}
                  <div className="wa-story-shutter-area">
                    {!cameraRecording ? (
                      <button 
                        className={`wa-story-shutter ${cameraMode === 'video' ? 'video-mode' : ''}`} 
                        onClick={cameraMode === 'video' ? startRecording : capturePhoto} 
                        id="story-shutter-btn"
                      >
                        <div className={`wa-story-shutter-ring ${cameraMode === 'video' ? 'video-mode' : ''}`}>
                          <div className={`wa-story-shutter-inner ${cameraMode === 'video' ? 'video-mode' : ''}`} />
                        </div>
                      </button>
                    ) : (
                      <button className="wa-story-shutter recording" onClick={stopRecording}>
                        <div className="wa-story-shutter-ring recording">
                          <div className="wa-story-shutter-stop" />
                        </div>
                      </button>
                    )}
                    {!cameraRecording && cameraMode === 'photo' && (
                      <span className="wa-story-shutter-hint">Tap for photo</span>
                    )}
                    {!cameraRecording && cameraMode === 'video' && (
                      <span className="wa-story-shutter-hint">Tap to record</span>
                    )}
                  </div>

                  {/* Photo/Video Mode Toggle - since flip is at top */}
                  {!cameraRecording && (
                    <button 
                      className="wa-story-icon-btn" 
                      onClick={() => setCameraMode(prev => prev === 'photo' ? 'video' : 'photo')} 
                      title={cameraMode === 'photo' ? "Switch to Video" : "Switch to Photo"}
                    >
                      {cameraMode === 'photo' ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                        </svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                        </svg>
                      )}
                    </button>
                  )}
                </>
              ) : (
                /* Review captured media */
                <div className="wa-story-review-bar">
                  <button className="wa-story-review-btn discard" onClick={discardCameraCapture}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                    <span>Retake</span>
                  </button>
                  <button className="wa-story-review-btn accept" onClick={() => {
                    useCameraCapture();
                    // After using the capture, if it's a photo, go to photo tab, else video
                    // useCameraCapture already handles this
                  }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Use {cameraCapturedType === 'video' ? 'Video' : 'Photo'}</span>
                  </button>
                </div>
              )}

              {/* Mode switcher at bottom */}
              {!cameraCaptured && !cameraRecording && (
                <div className="wa-story-mode-switcher cam-mode">
                  <button className={`wa-story-mode-btn ${(createStoryTab as string) === 'text' ? 'active' : ''}`} onClick={() => setCreateStoryTab('text')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
                    </svg>
                    <span>Text</span>
                  </button>
                  <button className={`wa-story-mode-btn ${(createStoryTab as string) === 'camera' ? 'active' : ''}`} onClick={() => setCreateStoryTab('camera')}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                    </svg>
                    <span>Camera</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ PHOTO / VIDEO REVIEW MODE ═══ */}
        {(createStoryTab === 'photo' || createStoryTab === 'video') && (
          <div className="wa-story-media-mode">
            {/* Top bar */}
            <div className="wa-story-topbar wa-story-topbar-cam">
              <button 
                className="wa-story-close-btn" 
                onClick={createStoryMedia ? removeStoryMedia : closeCreateModal} 
                title={createStoryMedia ? "Discard media" : "Close"}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  {createStoryMedia ? (
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  ) : (
                    <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                  )}
                </svg>
              </button>
            </div>

            {/* Media Preview Area */}
            <div className="wa-story-media-viewport">
              {!createStoryMedia ? (
                <button 
                  className="wa-story-media-empty"
                  onClick={() => createStoryTab === 'photo' ? storyMediaInputRef.current?.click() : storyVideoInputRef.current?.click()}
                >
                  <div className="wa-story-media-empty-icon">
                    {createStoryTab === 'photo' ? (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                      </svg>
                    ) : (
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                      </svg>
                    )}
                  </div>
                  <span className="wa-story-media-empty-title">
                    Tap to select {createStoryTab === 'photo' ? 'a photo' : 'a video'}
                  </span>
                  <span className="wa-story-media-empty-hint">Choose from your gallery</span>
                </button>
              ) : (
                <div className="wa-story-media-full">
                  {createStoryMediaType === 'video' ? (
                    <video src={createStoryMedia} className="wa-story-media-content" autoPlay loop playsInline muted />
                  ) : (
                    <img src={createStoryMedia} alt="Story preview" className="wa-story-media-content" />
                  )}
                </div>
              )}
            </div>

            {/* Caption + Send */}
            <div className="wa-story-media-bottom">
              <div className="wa-story-caption-row">
                <input
                  className="wa-story-caption-input"
                  placeholder="Add a caption..."
                  value={createStoryCaption}
                  onChange={e => setCreateStoryCaption(e.target.value)}
                  maxLength={100}
                />
                <button
                  className="wa-story-send-fab small"
                  disabled={!canPost}
                  onClick={handleCreateStory}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>
              </div>

            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`msg-page-wrapper ${(activeChat || activeStoryUserIdx !== null || showCreateStory || lightboxMedia) ? 'chat-active' : ''}`}>
      <div className="msg-container animate-settingsFadeIn">
        {renderConversationList()}
        {renderChatView()}
        {renderChatInfo()}
      </div>

      {/* Story Viewer */}
      {renderStoryViewer()}

      {/* Create Story Modal */}
      {renderCreateStoryModal()}


      {showBlockConfirm && activeConversation && (
        <div className="msg-future-overlay" onClick={() => setShowBlockConfirm(false)}>
          <div className="msg-future-sheet" onClick={e => e.stopPropagation()}>
            <div className="msg-future-handle" />
            <div className="msg-future-content">
              <div className="msg-future-icon-wrapper" style={{ color: '#EF4444', marginBottom: '8px' }}>
                <div className="msg-future-icon-glow" style={{ backgroundColor: '#EF4444' }} />
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                </svg>
              </div>
              <h2 className="msg-future-title">Block {activeConversation.user.name}?</h2>
              <p className="msg-future-desc">
                They will no longer be able to find your profile or see your messages. The conversation and stories will be hidden from both of you until you unblock them.
              </p>
              <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '12px' }}>
                <button 
                  className="msg-future-btn" 
                  style={{ background: 'var(--surface-2)', color: 'var(--text-primary)', boxShadow: 'none' }}
                  onClick={() => setShowBlockConfirm(false)}
                >
                  Cancel
                </button>
                <button 
                  className="msg-future-btn" 
                  style={{ background: '#EF4444', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
                  onClick={handleBlockUser}
                >
                  <span>Block User</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && activeConversation && (
        <div className="msg-future-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="msg-future-sheet" onClick={e => e.stopPropagation()}>
            <div className="msg-future-handle" />
            <div className="msg-future-content">
              <div className="msg-future-icon-wrapper" style={{ color: '#EF4444', marginBottom: '8px' }}>
                <div className="msg-future-icon-glow" style={{ backgroundColor: '#EF4444' }} />
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </div>
              <h2 className="msg-future-title">Delete Chat?</h2>
              <p className="msg-future-desc">
                This will permanently remove this conversation from your list. This action cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '12px' }}>
                <button 
                  className="msg-future-btn" 
                  style={{ background: 'var(--surface-2)', color: 'var(--text-primary)', boxShadow: 'none' }}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
                <button 
                  className="msg-future-btn" 
                  style={{ background: '#EF4444', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)' }}
                  onClick={handleDeleteChat}
                >
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMuteToast && activeConversation && (
        <div className="msg-mute-toast">
          <div className="msg-mute-toast-content">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
               {activeConversation.muted ? (
                 <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
               ) : (
                 <>
                   <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                   <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                 </>
               )}
             </svg>
             <span>Chat {activeConversation.muted ? 'Muted' : 'Notifications On'}</span>
          </div>
        </div>
      )}

      {showVanishToast && activeConversation && (
        <div className="msg-vanish-toast">
          <div className="msg-vanish-toast-content">
            <div className={`msg-vanish-toast-icon ${activeConversation.vanishMode ? 'on' : 'off'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                {activeConversation.vanishMode ? (
                   <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>
                ) : (
                   <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                )}
              </svg>
            </div>
            <span>Vanish Mode {activeConversation.vanishMode ? 'On • 1h' : 'Off'}</span>
          </div>
        </div>
      )}

      {/* Story Sent Toast */}
      {showStorySentToast && (
        <div className="story-sent-toast">
          <div className="story-sent-toast-content">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Story shared successfully!</span>
          </div>
        </div>
      )}

      {/* Delete Chat Toast */}

      {showDeleteToast && (
        <div className="msg-mute-toast" style={{ background: '#EF4444' }}>
          <div className="msg-mute-toast-content">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            <span>Conversation deleted</span>
          </div>
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxMedia && (
        <div 
          ref={lightboxRef}
          className={`msg-lightbox-overlay ${lightboxControlsVisible ? 'controls-visible' : 'controls-hidden'}`}
          onClick={() => {
            setLightboxControlsVisible(!lightboxControlsVisible);
            setShowLightboxMenu(false);
          }}
        >


          {/* Header (HUD) */}
          <div className="msg-lightbox-header" onClick={(e) => e.stopPropagation()}>
            <div className="msg-lightbox-header-left">
              <button className="msg-lightbox-header-btn" onClick={() => {
                setLightboxMedia(null);
                setLightboxRotation(0);
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </button>

              <div className="msg-lightbox-meta">
                <span className="msg-lightbox-sender">{lightboxMedia.sender}</span>
                <span className="msg-lightbox-time">{lightboxMedia.time}</span>
              </div>
            </div>
            <div className="msg-lightbox-header-right">
              {/* Rotate (Direct Access) */}
              <button className="msg-lightbox-header-btn" title="Rotate" onClick={(e) => {
                e.stopPropagation();
                setLightboxRotation(prev => {
                  const currentMod = prev % 360;
                  if (currentMod === 0) return prev + 90;
                  if (currentMod === 90) return prev + 180; // Skip 180, go to 270
                  if (currentMod === 270) return prev + 90; // Back to 0 (360)
                  return prev + 90;
                });
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
              </button>




              {/* Hamburger Menu */}

              <div className="msg-lightbox-menu-wrapper">
                <button className="msg-lightbox-header-btn" onClick={() => setShowLightboxMenu(!showLightboxMenu)}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                </button>
                
                {showLightboxMenu && (
                  <div className="msg-lightbox-dropdown">
                    <button className="msg-lightbox-dropdown-item" onClick={() => {
                      setShowForwardModal(true);
                      setShowLightboxMenu(false);
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      <span>Forward</span>
                    </button>

                    <a href={lightboxMedia.url} download className="msg-lightbox-dropdown-item">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      <span>Download</span>
                    </a>
                    <button 
                      className="msg-lightbox-dropdown-item danger" 
                      onClick={async () => {
                        if (confirm('Delete this photo for everyone?')) {
                          const ok = await dbDeleteMessage(lightboxMedia.msgId);
                          if (ok) {
                            setLightboxMedia(null);
                            setLightboxRotation(0);
                          }
                        }
                        setShowLightboxMenu(false);
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="msg-lightbox-content">
            {lightboxMedia.type === 'video' ? (
              <video 
                src={lightboxMedia.url} 
                controls 
                autoPlay 
                controlsList="nodownload noplaybackrate nofullscreen"
                disablePictureInPicture
                playsInline

                className="msg-lightbox-video"
                style={{ 
                  transform: `rotate(${lightboxRotation}deg)`,
                  maxHeight: (lightboxRotation % 180 !== 0) ? '100vw' : '100vh',
                  maxWidth: (lightboxRotation % 180 !== 0) ? '100vh' : '100vw'
                }}
              />

            ) : (
              <img 
                src={lightboxMedia.url} 
                alt="Full screen" 
                className="msg-lightbox-img" 
                style={{ 
                  transform: `rotate(${lightboxRotation}deg)`,
                  maxHeight: (lightboxRotation % 180 !== 0) ? '100vw' : '100vh',
                  maxWidth: (lightboxRotation % 180 !== 0) ? '100vh' : '100vw'
                }}
              />
            )}
          </div>

        </div>
      )}


      {/* Forward Modal */}
      {showForwardModal && (
        <div className="msg-modal-overlay" onClick={() => setShowForwardModal(false)}>
          <div className="msg-forward-modal" onClick={(e) => e.stopPropagation()}>
            <div className="msg-forward-header">
              <h3>Forward to</h3>
              <button className="msg-forward-close" onClick={() => setShowForwardModal(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            
            <div className="msg-forward-search">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input 
                type="text" 
                placeholder="Search..." 
                value={forwardSearch}
                onChange={(e) => setForwardSearch(e.target.value)}
              />
            </div>

            <div className="msg-forward-list">
              {conversations
                .filter(c => c.user.name.toLowerCase().includes(forwardSearch.toLowerCase()))
                .map(conv => (
                  <div key={conv.id} className="msg-forward-item">
                    <Link href={`/profile/${conv.user.id}`} className="msg-forward-user" style={{ textDecoration: 'none', color: 'inherit' }}>
                      <div className="msg-forward-avatar" style={{ background: 'var(--accent-gradient)' }}>
                        {conv.user.profilePicture ? (
                          <img src={conv.user.profilePicture} alt="" />
                        ) : conv.user.avatar}
                      </div>
                      <span className="msg-forward-name">{conv.user.name}</span>
                    </Link>
                    <button 
                      className="msg-forward-send-btn"
                      onClick={async () => {
                        if (!lightboxMedia) return;
                        await dbSendMessage({
                          conversationId: conv.id,
                          senderId: currentUserId,
                          text: 'Forwarded a photo',
                          type: 'image',
                          attachment: lightboxMedia.url
                        });

                        setShowForwardSuccess(true);
                        setTimeout(() => setShowForwardSuccess(false), 2000);
                      }}
                    >
                      Send
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {showForwardSuccess && (
        <div className="msg-forward-toast">
          <div className="msg-forward-toast-content">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Sent successfully</span>
          </div>
        </div>
      )}

      {/* Call Overlay */}
      {activeCall && (
        <CallOverlay
          type={activeCall.type}
          mode={activeCall.mode === 'connected' ? 'connected' : activeCall.mode as any}
          targetUser={{
            id: activeCall.user.id,
            name: activeCall.user.name,
            avatar: activeCall.user.profilePicture || activeCall.user.avatar
          }}
          onAccept={handleAcceptCall}
          onDecline={handleDeclineCall}
          onEnd={handleEndCall}
        />
      )}
    </div>


  );
}

export default MessagesContent;

