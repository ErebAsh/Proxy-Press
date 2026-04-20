'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import MobileBottomNav from '@/app/components/Sidebar/MobileBottomNav';
import './messages.css';
import { getConversations, sendMessage as dbSendMessage, uploadMedia, createStory, getStories, getCurrentUser, getUserProfile } from '@/lib/actions';

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

  useEffect(() => {
    async function loadInitialData() {
      try {
        const currentUser = await getCurrentUser();
        const myId = currentUser?.id || 'me';
        setCurrentUserId(myId);

        const targetUserId = searchParams.get('userId');
        const [convs, dbStories] = await Promise.all([
          getConversations(myId),
          getStories()
        ]);
        
        let mappedConvs: Conversation[] = [];
        if (convs && convs.length > 0) {
          console.log('Loaded conversations from DB:', convs);
          
          mappedConvs = convs.map((dbConv: any) => {
            // Find the other participant
            const otherParticipant = dbConv.participants?.find((p: any) => p.userId !== myId);
            const otherUser = otherParticipant?.user;
            
            return {
              id: dbConv.id,
              user: {
                id: otherUser?.id || 'unknown',
                name: otherUser?.name || 'Unknown User',
                avatar: otherUser?.avatar || 'U',
                online: true, // Simplified
              },
              lastMessage: dbConv.lastMessage || '',
              lastMessageTime: dbConv.lastMessageTime || '',
              unreadCount: dbConv.unreadCount || 0,
              isTyping: false,
              muted: dbConv.muted || false,
              vanishMode: dbConv.vanishMode || false,
              messages: (dbConv.messages || []).map((m: any) => ({
                id: m.id,
                senderId: m.senderId === myId ? 'me' : m.senderId,
                text: m.text,
                timestamp: m.timestamp,
                seen: m.seen,
                type: m.type || 'text',
                attachment: m.attachment,
              })).reverse(), // DB returns desc, UI might want asc for chat history
            };
          });

          setConversations(mappedConvs);
        }

        if (targetUserId) {
           const existing = mappedConvs.find(c => c.user.id === targetUserId);
           if (existing) {
             setActiveChat(existing.id);
           } else {
             const targetUser = await getUserProfile(targetUserId);
             if (targetUser) {
               const newConv: Conversation = {
                 id: `new_${targetUserId}`,
                 user: {
                   id: targetUser.id,
                   name: targetUser.name,
                   avatar: targetUser.profilePicture || '👤',
                   online: true,
                 },
                 lastMessage: '',
                 lastMessageTime: '',
                 unreadCount: 0,
                 isTyping: false,
                 muted: false,
                 vanishMode: false,
                 messages: [],
               };
               setConversations(prev => {
                   if (prev.find(c => c.id === newConv.id)) return prev;
                   return [newConv, ...prev];
               });
               setActiveChat(newConv.id);
             }
           }
        } else {
            const chatId = searchParams.get('chatId');
            if (chatId) {
                setActiveChat(chatId);
            }
        }

        if (dbStories && dbStories.length > 0) {
          // Find current user's stories
          const myDbStory = dbStories.find((s: any) => s.userId === myId);
          if (myDbStory && myDbStory.slides) {
            setMyStories(myDbStory.slides.map((s: any) => ({
              ...s,
              type: s.type || 'image',
              timestamp: s.timestamp || 'Just now'
            })));
          }

          // Map other stories to UI format
          const otherStories = dbStories
            .filter((s: any) => s.userId !== myId)
            .map((s: any) => ({
              userId: s.userId,
              userName: s.user?.name || 'User',
              userAvatar: (s.user?.name || 'U').substring(0, 1),
              seen: s.seen,
              slides: s.slides.map((sl: any) => ({
                ...sl,
                type: sl.type || 'image',
                timestamp: sl.timestamp || 'Just now'
              }))
            }));
          
          if (otherStories.length > 0) {
            setStories(otherStories);
          } else {
            setStories([]);
          }
        } else {
           setStories([]);
           setConversations([]);
        }
      } catch (err) {
        console.error('Failed to load initial messages data:', err);
      }
    }
    loadInitialData();
  }, []);
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
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const cameraCanvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRecordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
      result.push({ userId: 'me', userName: 'Your Story', userAvatar: '✦', slides: myStories, seen: false });
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

  const handleStoryMediaUpload = (e: React.ChangeEvent<HTMLInputElement>, mediaType: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCreateStoryMedia(url);
    setCreateStoryMediaType(mediaType);
  };

  const removeStoryMedia = () => {
    setCreateStoryMedia(null);
    setCreateStoryMediaType(null);
    if (storyMediaInputRef.current) storyMediaInputRef.current.value = '';
    if (storyVideoInputRef.current) storyVideoInputRef.current.value = '';
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
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = stream;
      }
      setCameraActive(true);
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
      mediaRecorderRef.current.stop();
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
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm';
    const recorder = new MediaRecorder(cameraStreamRef.current, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setCameraCaptured(url);
      setCameraCapturedType('video');
      stopCamera();
    };
    recorder.start(100);
    mediaRecorderRef.current = recorder;
    setCameraRecording(true);
    setCameraRecordTime(0);
    cameraRecordTimerRef.current = setInterval(() => {
      setCameraRecordTime(prev => prev + 1);
    }, 1000);
  }, [stopCamera]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
    const file = e.target.files?.[0];
    if (!file || !activeChat) return;

    const previewUrl = URL.createObjectURL(file);
    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: CURRENT_USER_ID,
      text: type === 'image' ? 'Sent an image' : type === 'video' ? 'Sent a video' : `Sent a file: ${file.name}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending',
      type: type,
      attachment: previewUrl
    };

    // Update local state for immediate response
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

    try {
      const res = await dbSendMessage({
        conversationId: activeChat,
        senderId: currentUserId,
        text: newMsg.text,
        type: 'text',
      });

      if (res.conversationId && res.conversationId !== activeChat) {
        setActiveChat(res.conversationId);
        setConversations(prev => prev.map(c => c.id === activeChat ? { ...c, id: res.conversationId } : c));
      }
    } catch (err) {
      console.error('Send message error:', err);
    }
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
            <Link href={`/profile/${user.id}`} className="msg-info-action-btn" style={{ textDecoration: 'none' }}>
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

    return (
      <div className="story-create-overlay" onClick={closeCreateModal}>
        <div className="story-create-sheet" onClick={e => e.stopPropagation()}>
          <div className="story-create-handle" />
          <h2 className="story-create-title">Create Story</h2>
          <p className="story-create-subtitle">Share a moment with your friends</p>

          {/* Hidden file inputs */}
          <input
            type="file"
            ref={storyMediaInputRef}
            style={{ display: 'none' }}
            accept="image/*"
            onChange={e => handleStoryMediaUpload(e, 'image')}
          />
          <input
            type="file"
            ref={storyVideoInputRef}
            style={{ display: 'none' }}
            accept="video/*"
            onChange={e => handleStoryMediaUpload(e, 'video')}
          />

          {/* Tab Switcher */}
          <div className="story-create-tabs">
            <button 
              className={`story-create-tab ${createStoryTab === 'text' ? 'active' : ''}`}
              onClick={() => setCreateStoryTab('text')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
              </svg>
              <span>Text</span>
            </button>
            <button 
              className={`story-create-tab ${createStoryTab === 'photo' ? 'active' : ''}`}
              onClick={() => setCreateStoryTab('photo')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>Photo</span>
            </button>
            <button 
              className={`story-create-tab ${createStoryTab === 'video' ? 'active' : ''}`}
              onClick={() => setCreateStoryTab('video')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
              </svg>
              <span>Video</span>
            </button>
            <button 
              className={`story-create-tab ${createStoryTab === 'camera' ? 'active' : ''}`}
              onClick={() => setCreateStoryTab('camera')}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span>Camera</span>
            </button>
          </div>

          {/* Tab Content */}
          {createStoryTab === 'text' && (
            <>
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
            </>
          )}

          {createStoryTab === 'photo' && (
            <div className="story-media-upload-section">
              {!createStoryMedia ? (
                <button 
                  className="story-media-dropzone"
                  onClick={() => storyMediaInputRef.current?.click()}
                >
                  <div className="story-dropzone-icon">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                  </div>
                  <span className="story-dropzone-title">Add a Photo</span>
                  <span className="story-dropzone-hint">Tap to select from your gallery</span>
                </button>
              ) : (
                <div className="story-media-preview-wrap">
                  <img src={createStoryMedia} alt="Preview" className="story-media-preview" />
                  <button className="story-media-remove-btn" onClick={removeStoryMedia}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
              <textarea
                className="story-create-textarea story-caption-input"
                placeholder="Add a caption... ✍️"
                value={createStoryCaption}
                onChange={e => setCreateStoryCaption(e.target.value)}
                maxLength={100}
                rows={2}
              />
            </div>
          )}

          {createStoryTab === 'video' && (
            <div className="story-media-upload-section">
              {!createStoryMedia ? (
                <button 
                  className="story-media-dropzone"
                  onClick={() => storyVideoInputRef.current?.click()}
                >
                  <div className="story-dropzone-icon video">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                  </div>
                  <span className="story-dropzone-title">Add a Video</span>
                  <span className="story-dropzone-hint">Tap to select from your gallery</span>
                </button>
              ) : (
                <div className="story-media-preview-wrap">
                  <video src={createStoryMedia} className="story-media-preview" muted autoPlay loop playsInline />
                  <button className="story-media-remove-btn" onClick={removeStoryMedia}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )}
              <textarea
                className="story-create-textarea story-caption-input"
                placeholder="Add a caption... ✍️"
                value={createStoryCaption}
                onChange={e => setCreateStoryCaption(e.target.value)}
                maxLength={100}
                rows={2}
              />
            </div>
          )}

          {/* Camera Tab */}
          {createStoryTab === 'camera' && (
            <div className="story-camera-section">
              {/* Hidden canvas for photo capture */}
              <canvas ref={cameraCanvasRef} style={{ display: 'none' }} />

              {!cameraCaptured ? (
                <>
                  <div className="story-camera-viewport">
                    <video
                      ref={cameraPreviewRef}
                      className={`story-camera-preview ${cameraFacing === 'user' ? 'mirrored' : ''}`}
                      autoPlay
                      playsInline
                      muted
                    />
                    {!cameraActive && (
                      <div className="story-camera-loading">
                        <div className="story-camera-loading-spinner" />
                        <span>Starting camera...</span>
                      </div>
                    )}
                    {cameraRecording && (
                      <div className="story-camera-rec-badge">
                        <span className="story-rec-dot" />
                        <span>{String(Math.floor(cameraRecordTime / 60)).padStart(2, '0')}:{String(cameraRecordTime % 60).padStart(2, '0')}</span>
                      </div>
                    )}
                  </div>
                  <div className="story-camera-controls">
                    <button className="story-camera-flip-btn" onClick={flipCamera} title="Flip camera">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
                        <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
                      </svg>
                    </button>
                    {!cameraRecording ? (
                      <button className="story-camera-shutter" onClick={capturePhoto}>
                        <div className="story-shutter-inner" />
                      </button>
                    ) : (
                      <button className="story-camera-shutter recording" onClick={stopRecording}>
                        <div className="story-shutter-stop" />
                      </button>
                    )}
                    {!cameraRecording ? (
                      <button className="story-camera-record-btn" onClick={startRecording} title="Record video">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                        </svg>
                      </button>
                    ) : (
                      <div style={{ width: 46 }} />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="story-camera-viewport captured">
                    {cameraCapturedType === 'image' ? (
                      <img src={cameraCaptured} alt="Captured" className="story-camera-capture-preview" />
                    ) : (
                      <video src={cameraCaptured} className="story-camera-capture-preview" autoPlay loop playsInline muted />
                    )}
                  </div>
                  <div className="story-camera-review-actions">
                    <button className="story-camera-retake-btn" onClick={discardCameraCapture}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      <span>Retake</span>
                    </button>
                    <button className="story-camera-use-btn" onClick={useCameraCapture}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Use {cameraCapturedType === 'video' ? 'Video' : 'Photo'}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {createStoryTab !== 'camera' && (
            <button
              className="story-create-post-btn"
              disabled={!canPost}
              onClick={handleCreateStory}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span>Share to Story</span>
            </button>
          )}
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
