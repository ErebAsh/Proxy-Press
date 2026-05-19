'use client';

import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { sqliteService } from './sqlite-db';

/* ─────────── TYPES ─────────── */
export interface PendingMessage {
  tempId: string;
  conversationId: string;
  senderId: string;
  text: string;
  type: string;
  attachment?: string;
  replyTo?: string;
  queuedAt: string;
  retryCount: number;
}

const QUEUE_KEY = 'pp_offline_message_queue';
const MAX_RETRIES = 5;

/* ─────────── OFFLINE MANAGER ─────────── */
/**
 * Capacitor-native offline message queue manager.
 * 
 * Messages are stored in Capacitor Preferences (survives app restarts)
 * and automatically flushed when the device regains connectivity.
 */
export const OfflineManager = {
  _initialized: false,
  _flushCallbacks: [] as Array<(msg: PendingMessage, result: { success: boolean; id?: string; conversationId?: string }) => void>,
  _statusCallbacks: [] as Array<(online: boolean) => void>,

  /**
   * Initialize the offline manager. Should be called once at app startup.
   * Sets up network change listener for automatic background sync.
   */
  async init() {
    if (this._initialized) return;
    this._initialized = true;

    // Initialize SQLite
    try {
      await sqliteService.initDB();
      console.log('[OfflineManager] SQLite DB Ready.');
    } catch (err) {
      console.error('[OfflineManager] Failed to init SQLite:', err);
    }

    // Listen for network status changes
    Network.addListener('networkStatusChange', (status) => {
      console.log('[OfflineManager] Network status changed:', status.connected ? 'ONLINE' : 'OFFLINE');
      
      // Notify status listeners
      this._statusCallbacks.forEach(cb => cb(status.connected));

      if (status.connected) {
        // Small delay to let the connection stabilize
        setTimeout(() => this.flushQueue(), 1500);
      }
    });

    // Check for pending messages on startup
    const status = await Network.getStatus();
    if (status.connected) {
      this.flushQueue();
    }

    console.log('[OfflineManager] Initialized. Online:', (await Network.getStatus()).connected);
  },

  /**
   * Subscribe to network status changes.
   * Returns an unsubscribe function.
   */
  onStatusChange(callback: (online: boolean) => void): () => void {
    this._statusCallbacks.push(callback);
    return () => {
      this._statusCallbacks = this._statusCallbacks.filter(cb => cb !== callback);
    };
  },

  /**
   * Subscribe to flush results (when queued messages are successfully sent).
   * Returns an unsubscribe function.
   */
  onFlush(callback: (msg: PendingMessage, result: { success: boolean; id?: string; conversationId?: string }) => void): () => void {
    this._flushCallbacks.push(callback);
    return () => {
      this._flushCallbacks = this._flushCallbacks.filter(cb => cb !== callback);
    };
  },

  /**
   * Check if the device is currently online.
   */
  async isOnline(): Promise<boolean> {
    try {
      const status = await Network.getStatus();
      return status.connected;
    } catch {
      // Fallback to navigator.onLine for web
      return typeof navigator !== 'undefined' ? navigator.onLine : true;
    }
  },

  /**
   * Add a message to the offline queue.
   * The message will be sent automatically when the device is back online.
   */
  async queueMessage(messageData: Omit<PendingMessage, 'tempId' | 'queuedAt' | 'retryCount'> & { tempId?: string }): Promise<string> {
    const tempId = messageData.tempId || `offline_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const pendingMsg: PendingMessage = {
      ...messageData,
      tempId,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
    };

    // Save to SQLite as 'pending'
    await sqliteService.saveMessage({
      ...pendingMsg,
      id: tempId,
      timestamp: pendingMsg.queuedAt
    }, 'pending');
    
    // Also keep in Preferences for backward compatibility/quick access if needed
    const queue = await this._getQueue();
    queue.push(pendingMsg);
    await this._saveQueue(queue);
    
    console.log(`[OfflineManager] Queued message in SQLite: ${tempId}`);
    return tempId;
  },

  /**
   * Attempt to send all pending messages in the queue.
   * Called automatically on network reconnection and on app startup.
   */
  async flushQueue() {
    const online = await this.isOnline();
    if (!online) {
      console.log('[OfflineManager] Still offline, skipping flush.');
      return;
    }

    const queue = await this._getQueue();
    if (queue.length === 0) return;

    console.log(`[OfflineManager] Flushing ${queue.length} pending messages...`);

    const remainingQueue: PendingMessage[] = [];
    
    // Import dynamically to avoid server/client boundary issues
    const { sendMessage: dbSendMessage } = await import('./actions');

    for (const msg of queue) {
      try {
        const result = await dbSendMessage({
          conversationId: msg.conversationId,
          senderId: msg.senderId,
          text: msg.text,
          type: msg.type,
          attachment: msg.attachment,
          replyTo: msg.replyTo,
        });

        console.log(`[OfflineManager] ✓ Sent queued message: ${msg.tempId}`);
        
        // Update SQLite status to 'sent' and set real ID
        if (result.id) {
          await sqliteService.saveMessage({
            ...msg,
            id: result.id,
            timestamp: new Date().toISOString()
          }, 'sent');
        }

        // Notify subscribers that a queued message was sent
        this._flushCallbacks.forEach(cb => cb(msg, result));

      } catch (err) {
        console.error(`[OfflineManager] ✗ Failed to send: ${msg.tempId}`, err);
        msg.retryCount += 1;

        if (msg.retryCount < MAX_RETRIES) {
          remainingQueue.push(msg);
        } else {
          console.warn(`[OfflineManager] Dropped message after ${MAX_RETRIES} retries: ${msg.tempId}`);
          // Notify with failure
          this._flushCallbacks.forEach(cb => cb(msg, { success: false }));
        }
      }
    }

    await this._saveQueue(remainingQueue);

    if (remainingQueue.length > 0) {
      console.log(`[OfflineManager] ${remainingQueue.length} messages still pending.`);
    } else {
      console.log('[OfflineManager] Queue fully flushed! ✓');
    }
  },

  /**
   * Get the count of pending messages in the queue.
   */
  async getPendingCount(): Promise<number> {
    const queue = await this._getQueue();
    return queue.length;
  },

  /**
   * Clear the entire queue (for debugging/reset purposes).
   */
  async clearQueue() {
    await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify([]) });
    console.log('[OfflineManager] Queue cleared.');
  },

  /* ─── Internal Helpers ─── */
  async _getQueue(): Promise<PendingMessage[]> {
    try {
      const { value } = await Preferences.get({ key: QUEUE_KEY });
      return value ? JSON.parse(value) : [];
    } catch {
      return [];
    }
  },

  async _saveQueue(queue: PendingMessage[]) {
    await Preferences.set({ key: QUEUE_KEY, value: JSON.stringify(queue) });
  },

  /**
   * Generic data caching for fast startup (WhatsApp-style)
   */
  async saveData(key: string, data: any) {
    try {
      const stringData = JSON.stringify(data);
      // 1. Permanent Storage (Async)
      await Preferences.set({
        key: `pp_cache_${key}`,
        value: stringData
      });
      // 2. Instant Storage (Sync Mirror) - For flicker-free initialization
      if (typeof window !== 'undefined') {
        localStorage.setItem(`pp_cache_${key}`, stringData);
        // Also keep the old legacy key for compatibility with existing components
        if (!key.startsWith('pp_cache_')) {
          localStorage.setItem(key, stringData);
        }
      }
    } catch (err) {
      console.error(`[OfflineManager] Cache Save Error [${key}]:`, err);
    }
  },

  async loadData<T>(key: string): Promise<T | null> {
    try {
      // 1. Try Instant Storage first (Sync)
      if (typeof window !== 'undefined') {
        const local = localStorage.getItem(`pp_cache_${key}`) || localStorage.getItem(key);
        if (local) return JSON.parse(local);
      }
      
      // 2. Fallback to Permanent Storage (Async)
      const { value } = await Preferences.get({ key: `pp_cache_${key}` });
      return value ? JSON.parse(value) : null;
    } catch (err) {
      console.error(`[OfflineManager] Cache Load Error [${key}]:`, err);
      return null;
    }
  },

  /**
   * --- PROFILE OFFLINE SUPPORT ---
   */
  async syncUserProfile(profile: any) {
    if (!profile) return;
    console.log('[OfflineManager] Syncing profile to local SQLite...');
    await sqliteService.saveUserProfile(profile);
  },

  async getOfflineProfile() {
    return await sqliteService.getLocalProfile();
  },

  /**
   * --- COMPREHENSIVE SYNC ---
   * Fetches the entire logged-in user profile and their posts 
   * and saves them to SQLite for a full offline experience.
   * 
   * Includes a 10-minute THROTTLE to prevent UI lag on repeat visits.
   */
  async syncAllUserData(userId: string, force = false) {
    if (!userId) return;
    
    // 1. Check Throttle (Skip if synced in the last 10 minutes, unless forced)
    const SYNC_WINDOW = 10 * 60 * 1000; // 10 Minutes
    const lastSyncKey = `last_full_sync_${userId}`;
    const lastSync = await this.loadData<number>(lastSyncKey);
    const now = Date.now();

    if (!force && lastSync && (now - lastSync < SYNC_WINDOW)) {
      console.log(`[OfflineManager] Sync skipped (Last sync was ${Math.round((now - lastSync) / 60000)}m ago)`);
      return;
    }

    console.log(`[OfflineManager] Starting full sync for user: ${userId}`);
    
    try {
      // 2. Check internet
      const online = await this.isOnline();
      if (!online) {
        console.log('[OfflineManager] Offline, skipping full sync.');
        return;
      }

      // 2. Fetch fresh data from server
      const { getProfileData } = await import('./actions');
      const data = await getProfileData(userId);

      if (data && data.user) {
        // 3. Cache Profile Picture
        const { ImageCache } = await import('./image-cache');
        const localAvatar = await ImageCache.getCachedImage(data.user.avatar || data.user.image, 'profiles');
        
        // Save Profile with local path
        await this.syncUserProfile({
          ...data.user,
          localAvatar
        });

        // 4. Save Posts with cached images (Strict 10 Limit)
        if (data.posts && Array.isArray(data.posts)) {
          const recentPosts = data.posts.slice(0, 10);
          console.log(`[OfflineManager] Syncing and caching ${recentPosts.length} most recent posts...`);
          
          // Clear old posts first
          await sqliteService.clearLocalPosts();
          
          for (const post of recentPosts) {
            const localImageUrl = await ImageCache.getCachedImage(post.imageUrl, 'posts');
            await sqliteService.saveUserPost({
              ...post,
              localImageUrl
            });
          }
        }

        await this.saveData(lastSyncKey, now);
        console.log('[OfflineManager] Profile and Posts sync complete! ✓');
        
        // 5. Sync Messages (Instagram Approach)
        await this.syncMessages(userId);

        // 6. Sync Explore Feed (Top 5)
        await this.syncExploreFeed();
      }
    } catch (err) {
      console.error('[OfflineManager] Full sync failed:', err);
    }
  },

  async getOfflinePosts() {
    return await sqliteService.getLocalPosts();
  },

  /**
   * --- HOME FEED SYNC (Smart & Light) ---
   * Syncs the top 10 image-based posts for the home feed.
   * Skips videos to save storage and bandwidth.
   */
  async syncHomeFeed() {
    console.log('[OfflineManager] Syncing Home Feed...');
    try {
      const online = await this.isOnline();
      if (!online) return;

      const { getInitialData } = await import('./actions');
      const { ImageCache } = await import('./image-cache');
      
      const data = await getInitialData();
      if (data && data.posts && Array.isArray(data.posts)) {
        // 1. Filter: No Videos + Limit 10
        const lightPosts = data.posts
          .filter((p: any) => !p.videoUrl)
          .slice(0, 10);

        console.log(`[OfflineManager] Caching ${lightPosts.length} home stories (No Videos)...`);
        
        await sqliteService.clearGlobalFeed();

        for (const post of lightPosts) {
          // 2. Cache the post image
          const localImageUrl = await ImageCache.getCachedImage(post.imageUrl, 'home');
          
          await sqliteService.saveGlobalPost({
            ...post,
            localImageUrl
          });
        }
        console.log('[OfflineManager] Home Feed sync complete! ✓');
      }
    } catch (err) {
      console.error('[OfflineManager] Home Feed sync failed:', err);
    }
  },

  async getOfflineHomeFeed() {
    return await sqliteService.getGlobalFeed();
  },

  /**
   * --- EXPLORE FEED SYNC (Ultra Light) ---
   * Syncs only the top 5 trending posts for the explore page.
   */
  async syncExploreFeed() {
    console.log('[OfflineManager] Syncing Explore Feed...');
    try {
      const online = await this.isOnline();
      if (!online) return;

      const { getExploreDataAction } = await import('./actions');
      const { ImageCache } = await import('./image-cache');

      const data = await getExploreDataAction();
      if (data && data.trendingPosts && Array.isArray(data.trendingPosts)) {
        const top5 = data.trendingPosts.slice(0, 5);
        
        await sqliteService.clearExploreFeed();
        
        for (const post of top5) {
          const localImageUrl = await ImageCache.getCachedImage(post.imageUrl, 'explore');
          await sqliteService.saveExplorePost({
            ...post,
            localImageUrl
          });
        }
        console.log('[OfflineManager] Explore sync complete! ✓');
      }
    } catch (err) {
      console.error('[OfflineManager] Explore sync failed:', err);
    }
  },

  async getOfflineExploreFeed() {
    return await sqliteService.getExploreFeed();
  },

  /**
   * --- SMART MESSAGE SYNC (Instagram Approach) ---
   * Syncs only recent conversations and recent messages to save space.
   */
  async syncMessages(userId: string) {
    if (!userId) return;
    console.log('[OfflineManager] Starting Smart Message Sync...');

    try {
      const { getConversations, getMessages } = await import('./actions');
      const { ImageCache } = await import('./image-cache');

      // 1. Get recent conversations (Limit to 15 most recent)
      const convs = await getConversations(userId);
      const recentConvs = convs.slice(0, 15);

      for (const conv of recentConvs) {
        // 2. Get recent messages for this chat (Limit to 30)
        const allMsgs = await getMessages(conv.id);
        const recentMsgs = allMsgs.slice(0, 30);

        console.log(`[OfflineManager] Syncing ${recentMsgs.length} messages for chat: ${conv.id}`);

        for (const [index, msg] of recentMsgs.entries()) {
          let localAttachment = null;

          // 3. Instagram Approach: Only cache images for the very latest messages (e.g., top 5)
          // This keeps the "bulky" images only for what the user is likely to see.
          if (msg.type === 'image' && msg.attachment && index < 5) {
            localAttachment = await ImageCache.getCachedImage(msg.attachment, 'chats');
          }

          await sqliteService.saveMessage({
            ...msg,
            localAttachment
          }, 'sent');
        }
      }
      console.log('[OfflineManager] Message sync complete! ✓');
    } catch (err) {
      console.error('[OfflineManager] Message sync failed:', err);
    }
  },

  /**
   * --- OFFLINE POST QUEUING ---
   */
  async queuePost(post: any) {
    console.log('[OfflineManager] Queuing post for offline upload:', post.title);
    await sqliteService.savePendingPost(post);
  },

  async flushPendingPosts() {
    const pending = await sqliteService.getPendingPosts();
    if (pending.length === 0) return;

    console.log(`[OfflineManager] 🚀 Found ${pending.length} pending posts. Starting upload...`);

    const { createPost, uploadMedia, getCurrentUser } = await import('./actions');

    for (const post of pending) {
      try {
        const user = await getCurrentUser();
        if (!user) continue;

        let finalMediaUrl = '';

        // 1. Upload cached media if exists
        if (post.localImageUrl) {
          const res = await fetch(post.localImageUrl);
          const blob = await res.blob();
          const file = new File([blob], "offline-upload.jpg", { type: blob.type });
          
          const formData = new FormData();
          formData.append('file', file);
          formData.append('category', 'images');
          const uploadRes = await uploadMedia(formData);
          finalMediaUrl = uploadRes.url;
        }

        // 2. Create the post
        await createPost({
          title: post.title,
          description: post.description,
          content: post.description,
          category: post.category,
          imageUrl: finalMediaUrl || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80',
          authorId: user.id
        });

        // 3. Delete from pending list
        await sqliteService.deletePendingPost(post.id);
        console.log(`[OfflineManager] ✓ Successfully published offline post: ${post.title}`);

      } catch (err) {
        console.error(`[OfflineManager] ✗ Failed to upload offline post: ${post.title}`, err);
      }
    }
  }
};
