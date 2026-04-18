'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
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
  seen?: boolean;
  type: 'text' | 'image' | 'heart' | 'voice' | 'video' | 'file';
  replyTo?: string;
  reactions?: string[];
  status?: 'sending' | 'sent' | 'error';
  attachment?: string;
}

interface StorySlide {
  id: string;
  text: string;
  emoji?: string;
  caption?: string;
  gradient: string;
  timestamp: string;
}

interface UserStory {
  userId: string;
  userName: string;
  userAvatar: string;
  slides: StorySlide[];
  seen: boolean;
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
  vanishMode: boolean;
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
    vanishMode: false,
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
    vanishMode: false,
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
    vanishMode: false,
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
    vanishMode: false,
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
    vanishMode: false,
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

const MOCK_STORIES: UserStory[] = [
  {
    userId: 'u1',
    userName: 'Arjun Mehta',
    userAvatar: 'AM',
    seen: false,
    slides: [
      { id: 's1-1', text: 'Just aced my DSA exam!', emoji: '🎯', caption: '3 hours of grinding paid off', gradient: STORY_GRADIENTS[0], timestamp: '2h ago' },
      { id: 's1-2', text: 'Campus sunset hits different', emoji: '🌅', gradient: STORY_GRADIENTS[1], timestamp: '1h ago' },
    ],
  },
  {
    userId: 'u2',
    userName: 'Priya Sharma',
    userAvatar: 'PS',
    seen: false,
    slides: [
      { id: 's2-1', text: 'New semester, new goals ✨', emoji: '📚', caption: 'Ready to grind', gradient: STORY_GRADIENTS[2], timestamp: '4h ago' },
      { id: 's2-2', text: 'Café study sessions > library', emoji: '☕', gradient: STORY_GRADIENTS[3], timestamp: '3h ago' },
      { id: 's2-3', text: 'Weekend plans anyone?', emoji: '🎉', caption: 'Drop your suggestions!', gradient: STORY_GRADIENTS[4], timestamp: '30m ago' },
    ],
  },
  {
    userId: 'u4',
    userName: 'Sneha Patel',
    userAvatar: 'SP',
    seen: false,
    slides: [
      { id: 's4-1', text: 'Hackathon winning team! 🏆', emoji: '🚀', caption: '48 hours well spent', gradient: STORY_GRADIENTS[5], timestamp: '6h ago' },
    ],
  },
  {
    userId: 'u6',
    userName: 'Ananya Gupta',
    userAvatar: 'AG',
    seen: false,
    slides: [
      { id: 's6-1', text: 'Tech meetup was insane!', emoji: '💡', caption: 'Met so many amazing devs', gradient: STORY_GRADIENTS[6], timestamp: '5h ago' },
      { id: 's6-2', text: 'Learning Rust 🦀', emoji: '💻', gradient: STORY_GRADIENTS[7], timestamp: '2h ago' },
    ],
  },
];

const STORY_DURATION = 5000; // 5 seconds per slide

/* ─────────── COMPONENTS ─────────── */
function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>(MOCK_CONVERSATIONS);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showChatInfo, setShowChatInfo] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [longPressMsg, setLongPressMsg] = useState<string | null>(null);
  const [showFutureModal, setShowFutureModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showMuteToast, setShowMuteToast] = useState(false);
  const [showVanishToast, setShowVanishToast] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  /* ─── Story State ─── */
  const [stories, setStories] = useState<UserStory[]>(MOCK_STORIES);
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
  const storyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const savedBlocked = localStorage.getItem('blockedUsers');
    if (savedBlocked) {
      try {
        setBlockedUserIds(JSON.parse(savedBlocked));
      } catch (e) {
        console.error('Error parsing blocked users', e);
      }
    }
  }, []);

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

  const handleBlockUser = () => {
    if (!activeConversation) return;
    const userId = activeConversation.user.id;
    if (blockedUserIds.includes(userId)) {
      setShowBlockConfirm(false);
      return;
    }
    const newBlocked = [...blockedUserIds, userId];
    setBlockedUserIds(newBlocked);
    localStorage.setItem('blockedUsers', JSON.stringify(newBlocked));
    
    // Store names for the settings page too (simulating a DB)
    const savedNames = localStorage.getItem('blockedUserNames') || '{}';
    const namesObj = JSON.parse(savedNames);
    namesObj[userId] = activeConversation.user.name;
    localStorage.setItem('blockedUserNames', JSON.stringify(namesObj));

    setShowBlockConfirm(false);
    setShowChatInfo(false);
    // Optionally remove from active chat
    // Optionally remove from active chat
    setActiveChat(null);
  };

  const toggleVanishMode = () => {
    if (!activeChat) return;
    setConversations(prev => prev.map(c => 
      c.id === activeChat ? { ...c, vanishMode: !c.vanishMode } : c
    ));
    
    setShowVanishToast(true);
    
    // If turning on, we might want to show a toast or something
    const isNowOn = !activeConversation?.vanishMode;
    if (isNowOn) {
      // Logic for Instagram-like behavior (clear messages when closing chat)
      // For now we'll just toggle the UI
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
      result.push({ userId: 'me', userName: 'Your Story', userAvatar: '✦', slides: myStories, seen: true });
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
  }, []);

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
      }
      setActiveStoryUserIdx(prev => (prev !== null ? prev + 1 : null));
      setActiveSlideIdx(0);
      setStoryProgress(0);
    } else {
      // End of all stories
      if (currentUser.userId !== 'me') {
        setStories(prev => prev.map(s => s.userId === currentUser.userId ? { ...s, seen: true } : s));
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

  const handleCreateStory = () => {
    if (!createStoryText.trim()) return;
    const newSlide: StorySlide = {
      id: `my-${Date.now()}`,
      text: createStoryText.trim(),
      gradient: STORY_GRADIENTS[createStoryGradient],
      timestamp: 'Just now',
    };
    setMyStories(prev => [...prev, newSlide]);
    setCreateStoryText('');
    setCreateStoryGradient(0);
    setShowCreateStory(false);
    setShowStorySentToast(true);
    setTimeout(() => setShowStorySentToast(false), 2800);
  };

  // Handle story reply keydown
  const handleStoryReplyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendStoryReply();
    }
  };

  useEffect(() => {
    const chatId = searchParams.get('chatId');
    if (chatId) {
      setActiveChat(chatId);
    }
  }, [searchParams]);

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
      senderId: CURRENT_USER_ID,
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

  const triggerUpload = (ref: React.RefObject<HTMLInputElement | null>) => {
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
            <Link href="/profile" className="msg-info-action-btn" style={{ textDecoration: 'none' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              <span>Profile</span>
            </Link>
            <button className="msg-info-action-btn" onClick={() => setShowFutureModal(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              <span>Audio</span>
            </button>
            <button className="msg-info-action-btn" onClick={() => setShowFutureModal(true)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              <span>Video</span>
            </button>
            <button className="msg-info-action-btn" onClick={() => setShowMuteToast(true)} style={{ cursor: 'pointer' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
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
                    <div className="msg-online-avatar">{conv.user.avatar}</div>
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
                  onClick={() => setActiveChat(c.id)}
                >
                  <div className="msg-online-avatar-ring">
                    <div className="msg-online-avatar">{c.user.avatar}</div>
                  </div>
                  <span className="msg-online-dot" />
                  <span className="msg-online-name">{c.user.name.split(' ')[0]}</span>
                </button>
              ));
            return [...friendsWithStories, ...onlineWithoutStories];
          })()}
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
      <div className={`msg-chat-panel ${activeChat ? 'msg-chat-visible-mobile' : ''} ${activeConversation.vanishMode ? 'vanish-mode' : ''}`}>
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
            <button className="msg-chat-action-btn" aria-label="Audio call" onClick={() => setShowFutureModal(true)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M15.05 5A5 5 0 0 1 19 8.95M15.05 1A9 9 0 0 1 23 8.94m-1 7.98v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
            <button className="msg-chat-action-btn" aria-label="Video call" onClick={() => setShowFutureModal(true)}>
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
              onClick={() => messageInput.trim() ? sendMessage() : setShowFutureModal(true)}
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
            <div className="story-header-avatar">{currentUser.userAvatar}</div>
            <div className="story-header-info">
              <span className="story-header-name">{currentUser.userName}</span>
              <span className="story-header-time">{currentSlide.timestamp}</span>
            </div>
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
              className="story-slide"
              key={currentSlide.id}
              style={{ background: currentSlide.gradient }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {currentSlide.emoji && <span className="story-slide-emoji">{currentSlide.emoji}</span>}
                <span className="story-slide-text">{currentSlide.text}</span>
                {currentSlide.caption && <span className="story-slide-caption">{currentSlide.caption}</span>}
              </div>
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
          {currentUser.userId !== 'me' && (
            <div className="story-footer">
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
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ─── CREATE STORY MODAL ─── */
  const renderCreateStoryModal = () => {
    if (!showCreateStory) return null;
    return (
      <div className="story-create-overlay" onClick={() => setShowCreateStory(false)}>
        <div className="story-create-sheet" onClick={e => e.stopPropagation()}>
          <div className="story-create-handle" />
          <h2 className="story-create-title">Create Story</h2>
          <p className="story-create-subtitle">Share a moment with your friends</p>

          <div className="story-create-input-section">
            <textarea
              className="story-create-textarea"
              placeholder="What's on your mind? ✨"
              value={createStoryText}
              onChange={e => setCreateStoryText(e.target.value)}
              maxLength={120}
            />
          </div>

          <span className="story-create-label">Background</span>
          <div className="story-gradient-grid">
            {STORY_GRADIENTS.map((gradient, idx) => (
              <div
                key={idx}
                className={`story-gradient-option ${createStoryGradient === idx ? 'selected' : ''}`}
                style={{ background: gradient }}
                onClick={() => setCreateStoryGradient(idx)}
              />
            ))}
          </div>

          <button
            className="story-create-post-btn"
            disabled={!createStoryText.trim()}
            onClick={handleCreateStory}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>Share to Story</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="msg-page-wrapper">
      <div className="msg-container">
        {renderConversationList()}
        {renderChatView()}
        {renderChatInfo()}
      </div>

      {/* Story Viewer */}
      {renderStoryViewer()}

      {/* Create Story Modal */}
      {renderCreateStoryModal()}

      {showFutureModal && (
        <div className="msg-future-overlay" onClick={() => setShowFutureModal(false)}>
          <div className="msg-future-sheet" onClick={e => e.stopPropagation()}>
            <div className="msg-future-handle" />
            <div className="msg-future-content">
              <div className="msg-future-icon-wrapper">
                <div className="msg-future-icon-glow" />
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <path d="M12 8v4"/><path d="M12 16h.01"/>
                </svg>
              </div>
              <h2 className="msg-future-title">Premium Feature</h2>
              <p className="msg-future-desc">
                We're currently scaling our infrastructure to support <strong>HD Voice & Video calls</strong>. This encrypted communication suite will be available in a future update.
              </p>
              <button 
                className="msg-future-btn" 
                onClick={() => setShowFutureModal(false)}
              >
                <span>Got it</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
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
                They will no longer be able to message you or find your profile. You can unblock them anytime in settings.
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

      {showMuteToast && (
        <div className="msg-mute-toast">
          <div className="msg-mute-toast-content">
             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
               <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
             </svg>
             <span>Muting features are undergoing maintenance</span>
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
            <span>Vanish Mode {activeConversation.vanishMode ? 'Enabled' : 'Disabled'}</span>
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
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<div className="msg-loading">Loading messages...</div>}>
      <MessagesContent />
    </Suspense>
  );
}
