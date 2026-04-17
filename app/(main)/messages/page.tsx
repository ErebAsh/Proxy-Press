'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import MobileBottomNav from '@/app/components/Sidebar/MobileBottomNav';
import './messages.css';

/* ─────────── TYPES ─────────── */
interface User {
  id: string;
  name: string;
  avatar: string;
  online: boolean;
  lastSeen?: string;
}

interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  seen: boolean;
  type: 'text' | 'image' | 'heart' | 'voice';
  replyTo?: string;
  reactions?: string[];
}

interface Conversation {
  id: string;
  user: User;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isTyping: boolean;
  messages: Message[];
  muted: boolean;
}

/* ─────────── MOCK DATA ─────────── */
const CURRENT_USER_ID = 'me';

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: '1',
    user: { id: 'u1', name: 'Arjun Mehta', avatar: 'AM', online: true },
    lastMessage: 'Did you see the new campus event? 🎉',
    lastMessageTime: '2m',
    unreadCount: 3,
    isTyping: false,
    muted: false,
    messages: [
      { id: 'm1', senderId: 'u1', text: 'Hey! How are you doing?', timestamp: '10:30 AM', seen: true, type: 'text' },
      { id: 'm2', senderId: CURRENT_USER_ID, text: 'I\'m great! Just finished my assignment 📝', timestamp: '10:32 AM', seen: true, type: 'text' },
      { id: 'm3', senderId: 'u1', text: 'Nice! Wanna grab lunch later?', timestamp: '10:33 AM', seen: true, type: 'text' },
      { id: 'm4', senderId: CURRENT_USER_ID, text: 'Sure, where do you wanna go?', timestamp: '10:35 AM', seen: true, type: 'text' },
      { id: 'm5', senderId: 'u1', text: 'Let\'s try the new café near the library ☕', timestamp: '10:36 AM', seen: true, type: 'text' },
      { id: 'm6', senderId: CURRENT_USER_ID, text: 'Sounds perfect! See you at 1?', timestamp: '10:38 AM', seen: true, type: 'text' },
      { id: 'm7', senderId: 'u1', text: '👍 Done!', timestamp: '10:39 AM', seen: true, type: 'text' },
      { id: 'm8', senderId: 'u1', text: 'Did you see the new campus event? 🎉', timestamp: '11:02 AM', seen: false, type: 'text' },
    ],
  },
  {
    id: '2',
    user: { id: 'u2', name: 'Priya Sharma', avatar: 'PS', online: true },
    lastMessage: 'Sent a photo',
    lastMessageTime: '15m',
    unreadCount: 1,
    isTyping: true,
    muted: false,
    messages: [
      { id: 'm1', senderId: 'u2', text: 'Check out this sunset from the rooftop! 🌅', timestamp: '9:15 AM', seen: true, type: 'text' },
      { id: 'm2', senderId: CURRENT_USER_ID, text: 'Wow that\'s beautiful!', timestamp: '9:20 AM', seen: true, type: 'text' },
      { id: 'm3', senderId: 'u2', text: 'Right? We should go there together sometime', timestamp: '9:21 AM', seen: true, type: 'text' },
      { id: 'm4', senderId: CURRENT_USER_ID, text: 'Definitely! Maybe this weekend?', timestamp: '9:25 AM', seen: true, type: 'text' },
      { id: 'm5', senderId: 'u2', text: 'Sent a photo', timestamp: '9:30 AM', seen: false, type: 'image' },
    ],
  },
  {
    id: '3',
    user: { id: 'u3', name: 'Rahul Verma', avatar: 'RV', online: false, lastSeen: '1h ago' },
    lastMessage: 'Sure, I\'ll send you the notes tonight',
    lastMessageTime: '1h',
    unreadCount: 0,
    isTyping: false,
    muted: false,
    messages: [
      { id: 'm1', senderId: CURRENT_USER_ID, text: 'Hey Rahul, can you share the Physics notes?', timestamp: '8:00 AM', seen: true, type: 'text' },
      { id: 'm2', senderId: 'u3', text: 'Sure, I\'ll send you the notes tonight', timestamp: '8:05 AM', seen: true, type: 'text' },
    ],
  },
  {
    id: '4',
    user: { id: 'u4', name: 'Sneha Patel', avatar: 'SP', online: true },
    lastMessage: 'The hackathon was amazing! 🚀',
    lastMessageTime: '3h',
    unreadCount: 0,
    isTyping: false,
    muted: true,
    messages: [
      { id: 'm1', senderId: 'u4', text: 'Did you register for the hackathon?', timestamp: 'Yesterday', seen: true, type: 'text' },
      { id: 'm2', senderId: CURRENT_USER_ID, text: 'Yes! Our team is ready 💪', timestamp: 'Yesterday', seen: true, type: 'text' },
      { id: 'm3', senderId: 'u4', text: 'The hackathon was amazing! 🚀', timestamp: '6:00 AM', seen: true, type: 'text' },
    ],
  },
  {
    id: '5',
    user: { id: 'u5', name: 'Karan Singh', avatar: 'KS', online: false, lastSeen: '3h ago' },
    lastMessage: 'Thanks for the help!',
    lastMessageTime: '5h',
    unreadCount: 0,
    isTyping: false,
    muted: false,
    messages: [
      { id: 'm1', senderId: 'u5', text: 'Can you help me with the project?', timestamp: 'Yesterday', seen: true, type: 'text' },
      { id: 'm2', senderId: CURRENT_USER_ID, text: 'Of course! What do you need?', timestamp: 'Yesterday', seen: true, type: 'text' },
      { id: 'm3', senderId: 'u5', text: 'I need help with the database schema', timestamp: 'Yesterday', seen: true, type: 'text' },
      { id: 'm4', senderId: CURRENT_USER_ID, text: 'I\'ll review it and send feedback', timestamp: 'Yesterday', seen: true, type: 'text' },
      { id: 'm5', senderId: 'u5', text: 'Thanks for the help!', timestamp: '4:00 AM', seen: true, type: 'text' },
    ],
  },
  {
    id: '6',
    user: { id: 'u6', name: 'Ananya Gupta', avatar: 'AG', online: true },
    lastMessage: 'See you at the meetup! 👋',
    lastMessageTime: '1d',
    unreadCount: 0,
    isTyping: false,
    muted: false,
    messages: [
      { id: 'm1', senderId: 'u6', text: 'Are you going to the tech meetup?', timestamp: 'Mon', seen: true, type: 'text' },
      { id: 'm2', senderId: CURRENT_USER_ID, text: 'Wouldn\'t miss it!', timestamp: 'Mon', seen: true, type: 'text' },
      { id: 'm3', senderId: 'u6', text: 'See you at the meetup! 👋', timestamp: 'Mon', seen: true, type: 'text' },
    ],
  },
  {
    id: '7',
    user: { id: 'u7', name: 'Vikram Joshi', avatar: 'VJ', online: false, lastSeen: 'Yesterday' },
    lastMessage: 'Let me know when you\'re free',
    lastMessageTime: '2d',
    unreadCount: 0,
    isTyping: false,
    muted: false,
    messages: [
      { id: 'm1', senderId: 'u7', text: 'Hey, wanna practice for the interview?', timestamp: 'Sun', seen: true, type: 'text' },
      { id: 'm2', senderId: CURRENT_USER_ID, text: 'Good idea! Let me check my schedule', timestamp: 'Sun', seen: true, type: 'text' },
      { id: 'm3', senderId: 'u7', text: 'Let me know when you\'re free', timestamp: 'Sun', seen: true, type: 'text' },
    ],
  },
];

const EMOJI_LIST = ['😀', '😂', '❤️', '🔥', '👍', '😍', '🎉', '💯', '🙌', '✨', '😎', '🤔', '👀', '💪', '🚀', '⭐', '🌟', '💫', '🎊', '🥳', '😊', '🤗', '💕', '🙏'];

/* ─────────── COMPONENT ─────────── */
export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [longPressMsg, setLongPressMsg] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeConversation = conversations.find(c => c.id === activeChat);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (activeChat) {
      scrollToBottom();
      // Mark messages as read
      setConversations(prev => prev.map(c =>
        c.id === activeChat ? { ...c, unreadCount: 0 } : c
      ));
    }
  }, [activeChat, scrollToBottom]);

  useEffect(() => {
    scrollToBottom();
  }, [activeConversation?.messages.length, scrollToBottom]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: 'currentUser',
      text: type === 'image' ? 'Sent an image' : type === 'video' ? 'Sent a video' : `Sent a file: ${file.name}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
      type: type,
      attachment: URL.createObjectURL(file)
    };

    setConversations(prev => prev.map(conv => {
      if (conv.id === activeChat) {
        return {
          ...conv,
          messages: [...conv.messages, newMessage],
          lastMessage: type === 'image' ? '📷 Image' : type === 'video' ? '🎥 Video' : '📄 File',
          lastMessageTime: 'Just now'
        };
      }
      return conv;
    }));

    setShowShareMenu(false);
    // Simulate server confirmation
    setTimeout(() => {
      setConversations(prev => prev.map(conv => {
        if (conv.id === activeChat) {
          return {
            ...conv,
            messages: conv.messages.map(m => m.id === newMessage.id ? { ...m, status: 'sent' } : m)
          };
        }
        return conv;
      }));
    }, 1500);
  };

  const triggerUpload = (ref: React.RefObject<HTMLInputElement>) => {
    ref.current?.click();
  };
  const sendMessage = () => {
    if (!messageInput.trim() || !activeChat) return;
    
    const newMsg: Message = {
      id: `m${Date.now()}`,
      senderId: CURRENT_USER_ID,
      text: messageInput.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      seen: false,
      type: 'text',
      replyTo: replyingTo?.id,
    };

    setConversations(prev => prev.map(c =>
      c.id === activeChat
        ? { ...c, messages: [...c.messages, newMsg], lastMessage: newMsg.text, lastMessageTime: 'now' }
        : c
    ));
    setMessageInput('');
    setReplyingTo(null);
    setShowEmojiPicker(false);

    // Simulate auto-reply after 2 seconds
    setTimeout(() => {
      const replies = [
        'That sounds great! 😊',
        'Haha, I know right?',
        'Let me think about it...',
        'Absolutely! 🎉',
        'Good point!',
        'I\'ll get back to you on that',
        'Wow, really? 😮',
        '👍',
      ];
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      const replyMsg: Message = {
        id: `m${Date.now() + 1}`,
        senderId: activeConversation?.user.id || '',
        text: randomReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        seen: false,
        type: 'text',
      };
      setConversations(prev => prev.map(c =>
        c.id === activeChat
          ? { ...c, messages: [...c.messages, replyMsg], lastMessage: replyMsg.text, lastMessageTime: 'now' }
          : c
      ));
    }, 2000);
  };

  const sendHeart = () => {
    if (!activeChat) return;
    const heartMsg: Message = {
      id: `m${Date.now()}`,
      senderId: CURRENT_USER_ID,
      text: '❤️',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      seen: false,
      type: 'heart',
    };
    setConversations(prev => prev.map(c =>
      c.id === activeChat
        ? { ...c, messages: [...c.messages, heartMsg], lastMessage: '❤️', lastMessageTime: 'now' }
        : c
    ));
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

  const filteredConversations = conversations.filter(c =>
    c.user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMsgTouchStart = (msgId: string) => {
    longPressTimer.current = setTimeout(() => {
      setLongPressMsg(msgId);
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div className="msg-info-avatar-section">
            <div className={`msg-info-avatar-ring ${user.online ? 'online' : ''}`}>
              <div className="msg-info-avatar-circle">{user.avatar}</div>
            </div>
            <h2 className="msg-info-name">{user.name}</h2>
            <span className="msg-info-status">{user.online ? 'Active now' : `Last seen ${user.lastSeen || 'recently'}`}</span>
          </div>
          <div className="msg-info-actions">
            <button className="msg-info-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              <span>Profile</span>
            </button>
            <button className="msg-info-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span>Audio</span>
            </button>
            <button className="msg-info-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <span>Video</span>
            </button>
            <button className="msg-info-action-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              <span>{activeConversation.muted ? 'Unmute' : 'Mute'}</span>
            </button>
          </div>
          <div className="msg-info-section">
            <h3>Chat Settings</h3>
            <div className="msg-info-option">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>Encryption</span>
              <span className="msg-info-option-value">On</span>
            </div>
            <div className="msg-info-option">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>Vanish Mode</span>
              <span className="msg-info-option-value">Off</span>
            </div>
            <div className="msg-info-option danger">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              <span>Block User</span>
            </div>
            <div className="msg-info-option danger">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              <span>Delete Chat</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ─── CONVERSATION LIST ─── */
  const renderConversationList = () => (
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
        {/* Online now row */}
        <div className="msg-online-row">
          <button className="msg-online-avatar-btn add-story-btn">
            <div className="msg-online-avatar-ring add-story">
              <div className="msg-add-story-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <div className="msg-add-story-plus">+</div>
              </div>
            </div>
            <span className="msg-online-name">Your story</span>
          </button>
          {conversations.filter(c => c.user.online).map(c => (
            <button
              key={c.id}
              className="msg-online-avatar-btn"
              onClick={() => setActiveChat(c.id)}
            >
              <div className="msg-online-avatar-ring">
                <div className="msg-online-avatar">{c.user.avatar}</div>
              </div>
              <span className="msg-online-dot" />
              <span className="msg-online-name">{c.user.name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation items */}
      <div className="msg-conversation-list">
        {filteredConversations.map(conv => (
          <button
            key={conv.id}
            className={`msg-conversation-item ${activeChat === conv.id ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`}
            onClick={() => setActiveChat(conv.id)}
          >
            <div className="msg-conv-avatar-wrapper">
              <div className={`msg-conv-avatar ${conv.user.online ? 'online' : ''}`}>
                {conv.user.avatar}
              </div>
              {conv.user.online && <span className="msg-conv-online-dot" />}
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
      </div>
      <div className="msg-list-footer">
        <MobileBottomNav />
      </div>
    </div>
  );

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
      <div className={`msg-chat-panel ${activeChat ? 'msg-chat-visible-mobile' : ''}`}>
        {/* Chat Header */}
        <div className="msg-chat-header">
          <button className="msg-back-btn" onClick={() => setActiveChat(null)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="msg-chat-header-user" onClick={() => setShowChatInfo(true)}>
            <div className={`msg-chat-header-avatar ${user.online ? 'online' : ''}`}>
              {user.avatar}
            </div>
            <div className="msg-chat-header-info">
              <span className="msg-chat-header-name">{user.name}</span>
              <span className="msg-chat-header-status">
                {activeConversation.isTyping ? (
                  <span className="msg-typing-indicator">typing<span className="msg-typing-dots"><span>.</span><span>.</span><span>.</span></span></span>
                ) : user.online ? 'Active now' : `${user.lastSeen || 'Offline'}`}
              </span>
            </div>
          </div>
          <div className="msg-chat-header-actions">
            <button className="msg-chat-action-btn" aria-label="Audio call">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
            <button className="msg-chat-action-btn" aria-label="Video call">
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
        </div>

        {/* Messages Area */}
        <div className="msg-messages-area">
          {/* Chat intro */}
          <div className="msg-chat-intro">
            <div className={`msg-intro-avatar-ring ${user.online ? 'online' : ''}`}>
              <div className="msg-intro-avatar">{user.avatar}</div>
            </div>
            <h3 className="msg-intro-name">{user.name}</h3>
            <p className="msg-intro-subtitle">ProxyPress · You both follow each other</p>
          </div>

          {/* Message bubbles */}
          {messages.map((msg, i) => {
            const isMine = msg.senderId === CURRENT_USER_ID;
            const showAvatar = !isMine && (i === 0 || messages[i - 1].senderId === CURRENT_USER_ID);
            const isLastInGroup = i === messages.length - 1 || messages[i + 1]?.senderId !== msg.senderId;

            return (
              <div
                key={msg.id}
                className={`msg-bubble-row ${isMine ? 'mine' : 'theirs'} ${isLastInGroup ? 'last-in-group' : ''}`}
                onMouseDown={() => handleMsgTouchStart(msg.id)}
                onMouseUp={handleMsgTouchEnd}
                onTouchStart={() => handleMsgTouchStart(msg.id)}
                onTouchEnd={handleMsgTouchEnd}
              >
                {!isMine && showAvatar && (
                  <div className="msg-bubble-avatar">{user.avatar}</div>
                )}
                {!isMine && !showAvatar && <div className="msg-bubble-avatar-spacer" />}
                <div className="msg-bubble-content-wrapper">
                  {replyingTo && msg.replyTo && (
                    <div className="msg-reply-preview-in-bubble">
                      <span>Replying to a message</span>
                    </div>
                  )}
                  <div className={`msg-bubble ${isMine ? 'mine' : 'theirs'} ${msg.type === 'heart' ? 'heart-msg' : ''} ${msg.attachment ? 'has-attachment' : ''}`}>
                    {msg.type === 'heart' ? (
                      <span className="msg-heart-emoji">❤️</span>
                    ) : msg.attachment && msg.type === 'image' ? (
                      <div className="msg-image-attachment">
                        <img src={msg.attachment} alt="Uploaded" className="msg-attachment-media" />
                      </div>
                    ) : msg.attachment && msg.type === 'video' ? (
                      <div className="msg-video-attachment">
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
                    ) : (
                      <p className="msg-bubble-text">{msg.text}</p>
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
                      <span className="msg-time">{msg.timestamp}</span>
                      {isMine && (
                        <span className={`msg-seen-status ${msg.seen ? 'seen' : ''}`}>
                          {msg.seen ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="2 12 7 17 12 12" /><polyline points="12 12 17 17 22 12" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Long press reaction popover */}
                  {longPressMsg === msg.id && (
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
              <div className="msg-bubble-avatar">{user.avatar}</div>
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
                onChange={e => setMessageInput(e.target.value)}
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
            <button 
              className={`msg-send-btn ${!messageInput.trim() ? 'mic-mode' : ''}`}
              onClick={() => messageInput.trim() ? sendMessage() : alert('Voice recording feature coming soon!')}
              aria-label={messageInput.trim() ? "Send message" : "Voice message"}
            >
              {messageInput.trim() ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
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

  return (
    <div className="msg-page-wrapper">
      <div className="msg-container">
        {renderConversationList()}
        {renderChatView()}
        {renderChatInfo()}
      </div>
    </div>
  );
}
