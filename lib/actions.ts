'use server';

import * as queries from './db/queries';
import { db } from './db';
import * as schema from './db/schema';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'node:crypto';
import { eq, and, ne, or, sql, isNotNull, lte, inArray, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { withCache, redis } from './redis';

export async function getInitialData(userId?: string) {
  const fetcher = async () => {
    const [posts, authors, categories, trendingTopics, announcements, notifications, stories] = await Promise.all([
      queries.getPosts(userId),
      queries.getUsers(),
      queries.getCategories(),
      queries.getTrendingTopics(),
      queries.getAnnouncements(),
      queries.getNotifications(userId),
      queries.getStories(userId),
    ]);

    return {
      posts,
      authors,
      categories,
      trendingTopics,
      announcements,
      notifications,
      stories,
    };
  };

  // Only cache the public feed (no userId) to save memory
  const data = userId 
    ? await fetcher() 
    : await withCache('public_initial_data', fetcher, 300); // 5 mins cache for public

  // Deep clone to ensure all data is perfectly serializable POJOs for RSC stream
  return JSON.parse(JSON.stringify(data));
}

export async function getHomeFeedPostsOnly(userId?: string, limit: number = 10, offset: number = 0) {
  const posts = await queries.getPosts(userId, limit, offset);
  return JSON.parse(JSON.stringify(posts));
}

export async function getMorePosts(userId?: string, limit: number = 10, offset: number = 0) {
  const posts = await queries.getPosts(userId, limit, offset);
  return JSON.parse(JSON.stringify(posts));
}

export async function getStories(userId?: string) {
  const fetcher = async () => {
    const allStories = await queries.getStories(userId);
    // Filter out any story groupings that have 0 slides (e.g. all expired)
    return allStories.filter((s: any) => s.slides && s.slides.length > 0);
  };

  const data = userId 
    ? await fetcher() 
    : await withCache('public_stories', fetcher, 120); // 2 mins cache for stories

  return JSON.parse(JSON.stringify(data));
}

export async function markStoryAsSeen(storyUserId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  try {
    await db.insert(schema.storyViews).values({
      storyId: storyUserId,
      viewerId: user.id,
      createdAt: new Date().toISOString(),
    }).onConflictDoNothing();
    return { success: true };
  } catch (err) {
    console.error('Failed to mark story as seen:', err);
    return { success: false };
  }
}

export async function getPostDetail(slug: string) {
  const post = await queries.getPostBySlug(slug);
  if (!post) return null;
  
  const cookieStore = await cookies();
  const currentUserId = cookieStore.get('proxypress_session')?.value;
  
  let canComment = true;
  const privacy = (post as any).author?.commentPrivacy || 'Everyone';

  if (privacy === 'No One') {
    canComment = false;
  } else if (privacy === 'People You Follow') {
    if (!currentUserId) {
      canComment = false;
    } else if (post.authorId !== currentUserId) {
      // Check if author follows current user
      const follow = await db.query.follows.findFirst({
        where: and(
          eq(schema.follows.followerId, post.authorId as string),
          eq(schema.follows.followingId, currentUserId as string)
        )
      });
      if (!follow) canComment = false;
    }
  }
  
  // Also get related posts from DB
  const related = await queries.getRelatedPosts(post.id, post.category || 'News');
  
  return JSON.parse(JSON.stringify({ post, related, canComment }));
}

export async function updateFcmToken(token: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  try {
    await db.update(schema.users)
      .set({ fcmToken: token })
      .where(eq(schema.users.id, user.id));
    return { success: true };
  } catch (err) {
    console.error('Failed to update FCM token:', err);
    return { success: false };
  }
}

import { unstable_noStore as noStore } from 'next/cache';

export async function getConversations(userId: string) {
  noStore();
  const [, conversations] = await Promise.all([
    cleanupExpiredMessages().catch(err => {
      console.error("Background messages cleanup failure:", err);
    }),
    queries.getConversations(userId)
  ]);
  return JSON.parse(JSON.stringify(conversations));
}

export async function getMessages(conversationId: string) {
  noStore();
  return JSON.parse(JSON.stringify(await queries.getMessages(conversationId)));
}

import { v2 as cloudinary } from 'cloudinary';


/**
 * Universal Media Upload Action via Cloudinary
 */
export async function uploadMedia(formData: FormData) {
  // Move config inside to prevent browser bundling issues
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const file = formData.get('file') as File;
  const category = formData.get('category') as 'images' | 'videos' | 'stories' | 'voice';

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('CRITICAL: Cloudinary credentials missing in environment variables');
    // For local development or emergency fallback, we return a local blob URL if it exists
    if (file && (file as any).preview) return { url: (file as any).preview };
    throw new Error('Upload service not configured. Please add CLOUDINARY_* keys to your Vercel Environment Variables.');
  }
  
  if (!file) throw new Error('No file provided');

  const buffer = Buffer.from(await file.arrayBuffer());
  
  return new Promise<{url: string}>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { 
        folder: `proxy-press/${category}`,
        resource_type: category === 'videos' || category === 'voice' ? 'video' : 'image' 
      },
      (error, result) => {
        if (error) reject(error);
        else resolve({ url: result?.secure_url as string });
      }
    );
    uploadStream.end(buffer);
  });
}



export async function createPost(data: {
  title: string;
  description: string;
  content: string;
  category: string;
  imageUrl: string;
  videoUrl?: string;
  authorId: string;
}) {
  const id = `p${Date.now()}`;
  const slug = data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + id;
  
  await db.insert(schema.posts).values({
    id,
    slug,
    title: data.title,
    description: data.description,
    content: data.content,
    category: data.category as any,
    authorId: data.authorId,
    imageUrl: data.imageUrl,
    videoUrl: data.videoUrl,
    imageColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Default gradient
    publishedAt: new Date().toISOString(),
  });

  revalidatePath('/');

  // Handle Mentions
  await handleMentions(data.description + " " + data.content, data.authorId, id);

  // Create Notifications for followers
  try {
    const followers = await getFollowers(data.authorId);
    const notificationsToInsert = followers.map((follower: any) => {
      if (follower.notifyNewPosts) {
        return {
          id: `ntf${Date.now()}-${follower.id}`,
          userId: follower.id,
          actorId: data.authorId,
          type: 'post',
          message: 'published a new post',
          postId: id,
          timeAgo: 'just now',
          isRead: false,
        };
      }
      return null;
    }).filter((n: any) => n !== null);

    if (notificationsToInsert.length > 0) {
      await db.insert(schema.notifications).values(notificationsToInsert as any);
    }
  } catch (err) {
    console.error('Failed to create new post notifications:', err);
  }

  // Invalidate Public Cache and User Profile Cache
  await Promise.all([
    redis.del('public_initial_data').catch(() => null),
    redis.del(`user_profile_data:${data.authorId}`).catch(() => null)
  ]);

  return { success: true, id };
}

export async function sendMessage(data: { 
  conversationId: string; 
  senderId: string; 
  text: string; 
  type: string;
  attachment?: string;
  replyTo?: string;
}) {
  const messageId = `m${Date.now()}`;
  let finalConversationId = data.conversationId;

  // Handle new conversation creation
  if (finalConversationId.startsWith('new_')) {
    const targetUserId = finalConversationId.replace('new_', '');
    
    // Check if either user is blocked
    const block = await db.query.userBlocks.findFirst({
      where: or(
        and(eq(schema.userBlocks.userId, data.senderId), eq(schema.userBlocks.blockedId, targetUserId)),
        and(eq(schema.userBlocks.userId, targetUserId), eq(schema.userBlocks.blockedId, data.senderId))
      )
    });
    if (block) throw new Error('Cannot send message to a blocked user');

    // Prevent duplicates: Check if a conversation ALREADY exists between these two users
    const senderConvs = await db.select({ conversationId: schema.conversationParticipants.conversationId })
      .from(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.userId, data.senderId));
    
    const senderConvIds = senderConvs.map(c => c.conversationId).filter((id): id is string => id !== null);
    
    let existingConvId = null;
    if (senderConvIds.length > 0) {
      const targetConvs = await db.select({ conversationId: schema.conversationParticipants.conversationId })
        .from(schema.conversationParticipants)
        .where(
          and(
            eq(schema.conversationParticipants.userId, targetUserId),
            inArray(schema.conversationParticipants.conversationId, senderConvIds)
          )
        );
      if (targetConvs.length > 0) {
        existingConvId = targetConvs[0].conversationId;
      }
    }

    if (existingConvId) {
      // Reuse existing conversation
      finalConversationId = existingConvId;
    } else {
      // Create new conversation
      const newConvId = `c${Date.now()}`;
      const nowIso = new Date().toISOString();
      
      await db.insert(schema.conversations).values({
        id: newConvId,
        lastMessage: data.text,
        lastMessageTime: nowIso,
      });

      await db.insert(schema.conversationParticipants).values([
        { conversationId: newConvId, userId: data.senderId },
        { conversationId: newConvId, userId: targetUserId }
      ]);

      finalConversationId = newConvId;
    }
  } else {
    // Check blocks for existing conversation
    const participants = await db.query.conversationParticipants.findMany({
      where: eq(schema.conversationParticipants.conversationId, finalConversationId)
    });
    const otherParticipant = participants.find(p => p.userId !== data.senderId);
    
    if (otherParticipant && otherParticipant.userId) {
       const block = await db.query.userBlocks.findFirst({
         where: or(
           and(eq(schema.userBlocks.userId, data.senderId), eq(schema.userBlocks.blockedId, otherParticipant.userId)),
           and(eq(schema.userBlocks.userId, otherParticipant.userId), eq(schema.userBlocks.blockedId, data.senderId))
         )
       });
       if (block) throw new Error('Cannot send message in a blocked conversation');
    }
  }

  // Check for vanish mode and duration
  const conversation = await db.query.conversations.findFirst({
    where: eq(schema.conversations.id, finalConversationId)
  });

  let expiresAt: Date | null = null;
  if (conversation?.vanishMode && conversation.vanishDuration) {
    expiresAt = new Date(Date.now() + conversation.vanishDuration * 1000);
  }
  
  const nowIso = new Date().toISOString();
  
  await db.insert(schema.messages).values({
    id: messageId,
    conversationId: finalConversationId,
    senderId: data.senderId,
    text: data.text,
    timestamp: nowIso,
    seen: false,
    type: data.type as any,
    attachment: data.attachment,
    expiresAt: expiresAt,
    replyTo: (data as any).replyTo,
  });

  // Update conversation last message
  await db.update(schema.conversations)
    .set({ 
      lastMessage: data.text, 
      lastMessageTime: nowIso 
    })
    .where(eq(schema.conversations.id, finalConversationId));

  // Cleanup expired messages in this conversation (triggered on new message)
  await cleanupExpiredMessages();

  // Invalidate Redis caches for instant message delivery
  await invalidateConversationCache(finalConversationId);

  // Send Push Notification to recipient
  try {
    const participants = await db.select()
      .from(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.conversationId, finalConversationId));
    
    const recipientId = participants.find(p => p.userId !== data.senderId)?.userId;

    if (recipientId) {
      const recipient = await db.query.users.findFirst({
        where: eq(schema.users.id, recipientId)
      });

      if (recipient?.fcmToken) {
        const { admin } = await import('./firebase-admin');
        const sender = await db.query.users.findFirst({
          where: eq(schema.users.id, data.senderId)
        });
        
        const senderName = sender?.name || 'Someone';

        let bodyText = data.text;
        if (data.type === 'image') bodyText = '📷 Sent an image';
        else if (data.type === 'video') bodyText = '🎥 Sent a video';
        else if (data.type === 'voice') bodyText = '🎤 Sent a voice message';
        else if (data.type === 'heart') bodyText = '❤️';

        await admin.messaging().send({
          token: recipient.fcmToken,
          data: {
            title: senderName,
            body: bodyText,
            avatarUrl: sender?.profilePicture || '',
            conversationId: finalConversationId,
            type: 'message'
          }
        });
      }
    }
  } catch (pushErr) {
    console.error('Failed to send push notification:', pushErr);
  }

  revalidatePath('/messages');
  return { success: true, id: messageId, conversationId: finalConversationId };
}

// Helper to bust Redis caches for a conversation and its participants (Removed: Using DB directly now)
async function invalidateConversationCache(conversationId: string) {
  // Do nothing, Redis caching removed for messaging to prevent hangs.
  return;
}

export async function updateConversationMute(conversationId: string, muted: boolean) {
  await db.update(schema.conversations)
    .set({ muted })
    .where(eq(schema.conversations.id, conversationId));
  
  await invalidateConversationCache(conversationId);
  revalidatePath('/messages');
  return { success: true };
}

export async function updateConversationVanishMode(conversationId: string, vanishMode: boolean, duration?: number) {
  await db.update(schema.conversations)
    .set({ 
      vanishMode,
      ...(duration !== undefined ? { vanishDuration: duration } : {})
    })
    .where(eq(schema.conversations.id, conversationId));
  
  await invalidateConversationCache(conversationId);
  revalidatePath('/messages');
  return { success: true };
}

export async function editMessage(messageId: string, newText: string) {
  try {
    await db.update(schema.messages)
      .set({ 
        text: newText,
        isEdited: true 
      })
      .where(eq(schema.messages.id, messageId));
    
    // Invalidate cache: find the conversation for this message
    const msg = await db.query.messages.findFirst({ where: eq(schema.messages.id, messageId) });
    if (msg?.conversationId) await invalidateConversationCache(msg.conversationId);
    revalidatePath('/messages');
    return { success: true };
  } catch (err) {
    console.error('Failed to edit message:', err);
    return { success: false };
  }
}

export async function deleteMessage(messageId: string) {
  try {
    // Soft delete: keep the record but mark as deleted
    await db.update(schema.messages)
      .set({ 
        isDeleted: true,
        text: 'This message was deleted',
        attachment: null 
      })
      .where(eq(schema.messages.id, messageId));
    
    // Invalidate cache: find the conversation for this message
    const msg = await db.query.messages.findFirst({ where: eq(schema.messages.id, messageId) });
    if (msg?.conversationId) await invalidateConversationCache(msg.conversationId);
    revalidatePath('/messages');
    return { success: true };
  } catch (err) {
    console.error('Failed to delete message:', err);
    return { success: false };
  }
}

export async function deleteConversation(conversationId: string) {
  try {
    // 1. Find all messages with attachments to delete physical files
    const messagesWithAttachments = await db.select({ attachment: schema.messages.attachment })
      .from(schema.messages)
      .where(and(
        eq(schema.messages.conversationId, conversationId),
        sql`${schema.messages.attachment} IS NOT NULL`
      ));

    // 2. Delete physical files from Cloudinary
    for (const msg of messagesWithAttachments) {
      if (msg.attachment && msg.attachment.includes('cloudinary.com')) {
        try {
          // Extract public_id from URL: e.g. https://res.cloudinary.com/.../upload/v123/proxy-press/images/file.jpg
          const urlParts = msg.attachment.split('/upload/');
          if (urlParts.length > 1) {
            const afterUpload = urlParts[1];
            // Remove the version (e.g., v1234/) if it exists
            const pathParts = afterUpload.split('/');
            const pathStart = pathParts[0].startsWith('v') && !isNaN(parseInt(pathParts[0].substring(1))) ? 1 : 0;
            const fullPath = pathParts.slice(pathStart).join('/');
            // Remove file extension
            const publicId = fullPath.substring(0, fullPath.lastIndexOf('.'));
            
            // Note: If resource_type is video, it needs { resource_type: 'video' }, but destroy tries 'image' by default.
            // We can determine resource type by checking the URL or just calling both if one fails.
            await cloudinary.uploader.destroy(publicId).catch(() => cloudinary.uploader.destroy(publicId, { resource_type: 'video' }));
          }
        } catch (err) {
          console.warn(`Could not delete file at ${msg.attachment}:`, err);
        }
      }
    }

    // 3. Explicitly delete messages and participants
    await db.delete(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId));
    
    await db.delete(schema.conversationParticipants)
      .where(eq(schema.conversationParticipants.conversationId, conversationId));

    await db.delete(schema.conversations)
      .where(eq(schema.conversations.id, conversationId));
    
    await invalidateConversationCache(conversationId);
    revalidatePath('/messages');
    revalidatePath('/', 'layout');
    return { success: true };
  } catch (err) {
    console.error('Failed to delete conversation:', err);
    return { success: false };
  }
}



export async function cleanupExpiredMessages() {
  const now = new Date();
  await db.delete(schema.messages)
    .where(and(
      isNotNull(schema.messages.expiresAt),
      lte(schema.messages.expiresAt, now)
    ));
}

export async function markMessagesAsSeen(conversationId: string, userId: string) {
  await cleanupExpiredMessages();
  if (!conversationId || conversationId.startsWith('new_')) return { success: true };

  await db.update(schema.messages)
    .set({ seen: true })
    .where(and(
      eq(schema.messages.conversationId, conversationId),
      ne(schema.messages.senderId, userId),
      eq(schema.messages.seen, false)
    ));

  await invalidateConversationCache(conversationId);
  // revalidatePath('/messages');
  return { success: true };
}


export async function createStory(data: {
  userId: string;
  type: 'image' | 'video' | 'text';
  mediaUrl?: string;
  text?: string;
  caption?: string;
  gradient: string;
}) {
  const slideId = `s${Date.now()}`;
  
  // Ensure user has a story record
  await db.insert(schema.stories).values({
    userId: data.userId,
    seen: false,
  }).onConflictDoNothing();

  await db.insert(schema.storySlides).values({
    id: slideId,
    storyId: data.userId,
    type: data.type,
    text: data.text,
    caption: data.caption,
    gradient: data.gradient,
    mediaUrl: data.mediaUrl,
    timestamp: 'Just now',
  });

  // Invalidate Stories Cache
  await redis.del('public_stories').catch(() => null);

  return { success: true, id: slideId };
}

export async function togglePostLike(postId: string, userId: string) {
  const existing = await queries.getPostLike(postId, userId);

  if (existing) {
    await db.delete(schema.postLikes)
      .where(and(
        eq(schema.postLikes.postId, postId),
        eq(schema.postLikes.userId, userId)
      ));
    
    // Decrement count
    await db.update(schema.posts)
      .set({ likes: sql`${schema.posts.likes} - 1` })
      .where(eq(schema.posts.id, postId));
  } else {
    await db.insert(schema.postLikes).values({
      postId,
      userId,
    });
    
    // Increment count
    await db.update(schema.posts)
      .set({ likes: sql`${schema.posts.likes} + 1` })
      .where(eq(schema.posts.id, postId));
  }

  revalidatePath('/');
  revalidatePath(`/article/`);

  // Create Notification
  if (!existing) {
    try {
      const post = await db.query.posts.findFirst({
        where: eq(schema.posts.id, postId),
        with: { author: true }
      });

      if (post && post.authorId !== userId && (post.author as any)?.notifyLikes) {
        // Use a deterministic ID to avoid race conditions (duplicates from rapid clicking)
        const notificationId = `like-${postId}-${userId}`;
        
        await db.insert(schema.notifications).values({
          id: notificationId,
          userId: post.authorId,
          actorId: userId,
          type: 'like',
          message: 'liked your post',
          postId: postId,
          timeAgo: 'just now',
          isRead: false,
        }).onConflictDoNothing();
      }
    } catch (err) {
      console.error('Failed to create like notification:', err);
    }
  }

  return { success: true };
}

export async function addPostComment(data: {
  postId: string;
  userId: string;
  text: string;
  parentId?: string;
}) {
  const id = `c${Date.now()}`;

  // 1. Get the post and author's privacy settings
  const post = await db.query.posts.findFirst({
    where: eq(schema.posts.id, data.postId),
    with: { author: true }
  });

  if (!post) throw new Error('Post not found');

  // 2. Check comment privacy
  const privacy = (post.author as any)?.commentPrivacy || 'Everyone';
  
  if (privacy === 'No One') {
    throw new Error('Comments are disabled for this account');
  }

  if (privacy === 'People You Follow') {
    // Check if post author follows the commenter
    const follow = await db.query.follows.findFirst({
      where: and(
        eq(schema.follows.followerId, post.authorId as string),
        eq(schema.follows.followingId, data.userId as string)
      )
    });
    if (!follow) {
      throw new Error('Only people followed by the author can comment');
    }
  }

  await db.insert(schema.postComments).values({
    id,
    postId: data.postId,
    userId: data.userId,
    text: data.text,
    parentId: data.parentId,
    createdAt: new Date().toISOString(),
  });

  // Increment comment count on post
  await db.update(schema.posts)
    .set({ comments: sql`${schema.posts.comments} + 1` })
    .where(eq(schema.posts.id, data.postId));

  revalidatePath('/');

  // Create Notification for Post Author
  try {
    if (post && post.authorId !== data.userId && (post.author as any)?.notifyComments) {
      await db.insert(schema.notifications).values({
        id: `ntf-c-${id}`, 
        userId: post.authorId,
        actorId: data.userId,
        type: 'comment',
        message: 'commented on your post',
        postId: data.postId,
        timeAgo: 'just now',
        isRead: false,
      }).onConflictDoNothing();
    }
  } catch (err) {
    console.error('Failed to create comment notification:', err);
  }

  // Handle Mentions
  await handleMentions(data.text, data.userId, data.postId, id);

  return { success: true, id };
}

async function handleMentions(text: string, actorId: string, postId: string, commentId?: string) {
  const mentionRegex = /@(\w+)/g;
  const matches = text.matchAll(mentionRegex);
  const usernames = Array.from(new Set(Array.from(matches).map(m => m[1])));

  if (usernames.length === 0) return;

  for (const username of usernames) {
    try {
      const target = await db.query.users.findFirst({
        where: eq(schema.users.username, username)
      });

      if (!target || target.id === actorId) continue;

      // Check Mention Privacy
      const privacy = target.mentionPrivacy || 'Everyone';
      if (privacy === 'No One') continue;

      if (privacy === 'People You Follow') {
        // Check if target follows actor
        const follow = await db.query.follows.findFirst({
          where: and(
            eq(schema.follows.followerId, target.id),
            eq(schema.follows.followingId, actorId)
          )
        });
        if (!follow) continue;
      }

      // Check Notification Setting
      if (!target.notifyMentions) continue;

      // Send Notification
      await db.insert(schema.notifications).values({
        id: `ntf-m-${target.id}-${commentId || postId}-${Date.now()}`,
        userId: target.id,
        actorId: actorId,
        type: 'mention',
        message: commentId ? 'mentioned you in a comment' : 'mentioned you in a post',
        postId: postId,
        timeAgo: 'just now',
        isRead: false,
      }).onConflictDoNothing();

    } catch (err) {
      console.error(`Failed to handle mention for ${username}:`, err);
    }
  }
}

export async function toggleCommentLike(commentId: string, userId: string) {
  const existing = await db.query.commentLikes.findFirst({
    where: and(
      eq(schema.commentLikes.commentId, commentId),
      eq(schema.commentLikes.userId, userId)
    ),
  });

  if (existing) {
    await db.delete(schema.commentLikes)
      .where(and(
        eq(schema.commentLikes.commentId, commentId),
        eq(schema.commentLikes.userId, userId)
      ));
  } else {
    await db.insert(schema.commentLikes).values({
      commentId,
      userId,
    });
  }

  return { success: true };
}

export async function togglePostSave(postId: string, userId: string) {
  const existing = await queries.getPostSave(postId, userId);

  if (existing) {
    await db.delete(schema.postSaves)
      .where(and(
        eq(schema.postSaves.postId, postId),
        eq(schema.postSaves.userId, userId)
      ));
    
    // Decrement saved_count on user profile
    await db.update(schema.users)
      .set({ savedCount: sql`${schema.users.savedCount} - 1` })
      .where(eq(schema.users.id, userId));
  } else {
    await db.insert(schema.postSaves).values({
      postId,
      userId,
    });
    
    // Increment saved_count on user profile
    await db.update(schema.users)
      .set({ savedCount: sql`${schema.users.savedCount} + 1` })
      .where(eq(schema.users.id, userId));
  }

  revalidatePath('/');
  revalidatePath('/profile');
  return { success: true };
}


export async function login(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  if (!user || user.password !== password) {
    return { success: false, error: 'Invalid email or password' };
  }

  const cookieStore = await cookies();
  cookieStore.set('proxypress_session', user.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
  cookieStore.set('proxypress_onboarded', user.onboardingComplete ? '1' : '0', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return { success: true, onboardingComplete: user.onboardingComplete };
}

export async function signUp(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  // Check if user already exists
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  if (existing) {
    return { success: false, error: 'Email already in use' };
  }

  const id = `u${Date.now()}`;
  
  await db.insert(schema.users).values({
    id,
    name: 'New User',
    email,
    password,
    college: '',
    avatar: '👤',
    bio: '',
    onboardingComplete: false,
  });

  const cookieStore = await cookies();
  cookieStore.set('proxypress_session', id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  // Flag for middleware — avoids DB lookup on every request
  cookieStore.set('proxypress_onboarded', '0', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return { success: true };
}

export async function completeOnboarding(data: {
  // Step 1 — Basic
  name: string;
  username: string;
  dateOfBirth: string;
  college: string;
  branch?: string;
  department?: string;
  // Step 2 — Contact
  phone: string;
  // Step 3 — Optional
  bio?: string;
  gender?: string;
  links?: string[];
  profilePicture?: string;
}) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return { success: false, error: 'Not authenticated' };

  // Check username uniqueness
  const existingUsername = await db.query.users.findFirst({
    where: and(
      eq(schema.users.username, data.username),
      // Exclude self
    ),
  });
  if (existingUsername && existingUsername.id !== userId) {
    return { success: false, error: 'Username is already taken' };
  }

  await db.update(schema.users)
    .set({
      name: data.name,
      username: data.username,
      dateOfBirth: data.dateOfBirth,
      college: data.college,
      branch: data.branch || null,
      department: data.department || null,
      phone: data.phone,
      bio: data.bio || '',
      gender: data.gender || null,
      links: data.links ? JSON.stringify(data.links) : null,
      profilePicture: data.profilePicture || null,
      onboardingComplete: true,
    })
    .where(eq(schema.users.id, userId));

  // Update cookie flag
  cookieStore.set('proxypress_onboarded', '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  // Invalidate User Profile Cache
  await redis.del(`user_profile_data:${userId}`).catch(() => null);

  revalidatePath('/');
  revalidatePath('/profile');
  return { success: true };
}

export async function checkUsernameAvailability(username: string) {
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.username, username),
  });
  return { available: !existing };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('proxypress_session');
  cookieStore.delete('proxypress_onboarded');
  revalidatePath('/');
  return { success: true };
}

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  let userId = cookieStore.get('proxypress_session')?.value;

  if (!userId) {
    const session = await getServerSession(authOptions);
    if (session?.user && (session.user as any).id) {
      userId = (session.user as any).id;
    }
  }

  if (!userId) return null;

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  return user ? JSON.parse(JSON.stringify(user)) : null;
}

export async function getUserProfile(idOrHandle: string) {
  const currentUser = await getCurrentUser();
  const currentUserId = currentUser?.id;

  // 1. Try fetching by exact ID
  let user = await db.query.users.findFirst({
    where: eq(schema.users.id, idOrHandle),
  });

  // 2. If not found, try fetching by username (handle)
  if (!user) {
    user = await db.query.users.findFirst({
      where: eq(schema.users.username, idOrHandle.startsWith('@') ? idOrHandle.slice(1) : idOrHandle),
    });
  }

  if (!user) return null;

  // 3. Check if current user is blocked by target user
  if (currentUserId) {
    const block = await db.query.userBlocks.findFirst({
      where: and(
        eq(schema.userBlocks.userId, user.id), // Target user is the blocker
        eq(schema.userBlocks.blockedId, currentUserId) // I am the blocked one
      )
    });
    if (block) return null; // Blocked user cannot see profile
  }

  return JSON.parse(JSON.stringify(user));
}

export async function getProfileData(idOrHandle: string) {
  const currentUser = await getCurrentUser();
  const currentUserId = currentUser?.id;

  // Optimization: Use Redis for the user's own profile (sub-millisecond speed)
  const isSelf = currentUserId && (idOrHandle === currentUserId || idOrHandle === `@${currentUserId}`);
  if (isSelf) {
    try {
      const cached = await redis.get(`user_profile_data:${currentUserId}`);
      if (cached) return typeof cached === 'string' ? JSON.parse(cached) : cached;
    } catch (e) {
      console.error('Redis profile fetch error:', e);
    }
  }

  // 1. Fetch user profile
  const user = await getUserProfile(idOrHandle);
  if (!user) return null;

  const targetUserId = user.id;

  // 2. Fetch all related data in parallel
  const [posts, followCounts, followStatus, blockStatus, requestStatus] = await Promise.all([
    db.query.posts.findMany({
      where: eq(schema.posts.authorId, targetUserId),
      orderBy: (posts, { desc }) => [desc(posts.publishedAt)],
    }),
    getFollowCounts(targetUserId),
    currentUserId ? getFollowStatus(targetUserId) : Promise.resolve({ following: false }),
    currentUserId ? getBlockStatus(targetUserId) : Promise.resolve({ blocked: false, muted: false }),
    currentUserId ? getFollowRequestStatus(targetUserId) : Promise.resolve({ requested: false }),
  ]);

  const profileData = {
    user,
    posts,
    followCounts,
    isFollowing: followStatus.following,
    isBlocked: blockStatus.blocked,
    isMuted: blockStatus.muted,
    isRequested: requestStatus.requested,
    currentUserId,
  };

  // Cache in Redis for self-profile
  if (isSelf) {
    try {
      await redis.set(`user_profile_data:${currentUserId}`, JSON.stringify(profileData), { ex: 300 });
    } catch (e) {
      console.error('Redis profile save error:', e);
    }
  }

  return JSON.parse(JSON.stringify(profileData));
}

// ─── Safety Features ───

export async function blockUser(targetId: string) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return { success: false, error: 'Not authenticated' };

  // Check if already blocked
  const existing = await db.query.userBlocks.findFirst({
    where: and(
      eq(schema.userBlocks.userId, userId),
      eq(schema.userBlocks.blockedId, targetId)
    ),
  });
  if (existing) {
    return { success: true, alreadyBlocked: true };
  }

  await db.insert(schema.userBlocks).values({
    userId,
    blockedId: targetId,
    createdAt: new Date().toISOString(),
  });

  revalidatePath('/');
  return { success: true };
}

export async function getBlockedUsers() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return [];

  const blocks = await db.query.userBlocks.findMany({
    where: eq(schema.userBlocks.userId, userId),
    with: {
      blockedUser: true
    }
  });

  return JSON.parse(JSON.stringify(blocks.map(b => b.blockedUser)));
}

export async function unblockUser(targetId: string) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return { success: false, error: 'Not authenticated' };

  await db.delete(schema.userBlocks)
    .where(and(
      eq(schema.userBlocks.userId, userId),
      eq(schema.userBlocks.blockedId, targetId)
    ));

  revalidatePath('/');
  return { success: true };
}

export async function muteUser(targetId: string) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return { success: false, error: 'Not authenticated' };

  const existing = await db.query.userMutes.findFirst({
    where: and(
      eq(schema.userMutes.userId, userId),
      eq(schema.userMutes.mutedId, targetId)
    ),
  });

  if (existing) {
    // Toggle: unmute
    await db.delete(schema.userMutes)
      .where(and(
        eq(schema.userMutes.userId, userId),
        eq(schema.userMutes.mutedId, targetId)
      ));
    revalidatePath('/');
    return { success: true, muted: false };
  }

  await db.insert(schema.userMutes).values({
    userId,
    mutedId: targetId,
    createdAt: new Date().toISOString(),
  });
  revalidatePath('/');
  return { success: true, muted: true };
}

export async function reportUser(targetId: string, reason: string) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return { success: false, error: 'Not authenticated' };

  await db.insert(schema.userReports).values({
    id: `rpt${Date.now()}`,
    reporterId: userId,
    targetId,
    reason,
    createdAt: new Date().toISOString(),
  });

  return { success: true };
}

export async function reportPost(postId: string, reason: string) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return { success: false, error: 'Not authenticated' };

  await db.insert(schema.postReports).values({
    id: `prp${Date.now()}`,
    reporterId: userId,
    postId,
    reason,
    createdAt: new Date().toISOString(),
  });

  return { success: true };
}

export async function getReportsAction() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  const [userReports, postReports] = await Promise.all([
    db.query.userReports.findMany({
      orderBy: (r, { desc }) => [desc(r.createdAt)],
      with: {
        reporter: true,
        target: true,
      },
    }),
    db.query.postReports.findMany({
      orderBy: (r, { desc }) => [desc(r.createdAt)],
      with: {
        reporter: true,
        post: {
          with: {
            author: true,
          },
        },
      },
    }),
  ]);

  return JSON.parse(JSON.stringify({ userReports, postReports }));
}

export async function getBlockStatus(targetId: string) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return { blocked: false, muted: false };

  const [block, mute] = await Promise.all([
    db.query.userBlocks.findFirst({
      where: and(
        eq(schema.userBlocks.userId, userId),
        eq(schema.userBlocks.blockedId, targetId)
      ),
    }),
    db.query.userMutes.findFirst({
      where: and(
        eq(schema.userMutes.userId, userId),
        eq(schema.userMutes.mutedId, targetId)
      ),
    }),
  ]);

  return { blocked: !!block, muted: !!mute };
}

// ─── Follow Features ───

export async function toggleFollow(targetId: string) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return { success: false, error: 'Not authenticated' };

  if (userId === targetId) return { success: false, error: 'Cannot follow yourself' };

  const targetUser = await db.query.users.findFirst({
    where: eq(schema.users.id, targetId)
  });

  if (!targetUser) return { success: false, error: 'User not found' };

  const existing = await db.query.follows.findFirst({
    where: and(
      eq(schema.follows.followerId, userId),
      eq(schema.follows.followingId, targetId)
    ),
  });

  if (existing) {
    // Unfollow
    await db.delete(schema.follows)
      .where(and(
        eq(schema.follows.followerId, userId),
        eq(schema.follows.followingId, targetId)
      ));

    // Update counts
    await db.update(schema.users)
      .set({ followers: sql`${schema.users.followers} - 1` })
      .where(eq(schema.users.id, targetId));
    
    await db.update(schema.users)
      .set({ following: sql`${schema.users.following} - 1` })
      .where(eq(schema.users.id, userId));

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath(`/profile/${targetId}`);
    return { success: true, following: false };
  } else {
    // Check if user is private
    if (targetUser.isPrivate) {
      // Check if already requested
      const existingRequest = await db.query.followRequests.findFirst({
        where: and(
          eq(schema.followRequests.followerId, userId),
          eq(schema.followRequests.followingId, targetId)
        )
      });

      if (existingRequest) {
        // Cancel request
        await db.delete(schema.followRequests)
          .where(eq(schema.followRequests.id, existingRequest.id));
        
        revalidatePath(`/profile/${targetId}`);
        return { success: true, following: false, requested: false };
      }

      // Create follow request
      const requestId = `frq${Date.now()}`;
      await db.insert(schema.followRequests).values({
        id: requestId,
        followerId: userId,
        followingId: targetId,
      });

      // Create Notification for the request
      try {
        await db.insert(schema.notifications).values({
          id: `ntf-frq-${requestId}`,
          userId: targetId,
          actorId: userId,
          type: 'follow_request',
          message: `requested to follow you`,
          timeAgo: 'just now',
          createdAt: new Date().toISOString(),
          isRead: false,
        });
      } catch (err) {
        console.error('Failed to create follow request notification:', err);
      }

      revalidatePath(`/profile/${targetId}`);
      return { success: true, following: false, requested: true };
    }

    // Direct Follow
    await db.insert(schema.follows).values({
      followerId: userId,
      followingId: targetId,
      createdAt: new Date().toISOString(),
    });

    // Update counts
    await db.update(schema.users)
      .set({ followers: sql`${schema.users.followers} + 1` })
      .where(eq(schema.users.id, targetId));
    
    await db.update(schema.users)
      .set({ following: sql`${schema.users.following} + 1` })
      .where(eq(schema.users.id, userId));

    // Create Notification
    try {
      await db.insert(schema.notifications).values({
        id: `ntf${Date.now()}`,
        userId: targetId,
        actorId: userId,
        type: 'follow',
        message: `started following you`,
        timeAgo: 'just now',
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    } catch (msgErr) {
      console.error('Failed to create follow notification:', msgErr);
    }

    revalidatePath('/');
    revalidatePath('/profile');
    revalidatePath(`/profile/${targetId}`);
    return { success: true, following: true };
  }
}

export async function getFollowRequestStatus(targetId: string) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return { requested: false };

  const request = await db.query.followRequests.findFirst({
    where: and(
      eq(schema.followRequests.followerId, userId),
      eq(schema.followRequests.followingId, targetId)
    ),
  });

  return { requested: !!request };
}

export async function getFollowRequests() {
  const user = await getCurrentUser();
  if (!user) return [];

  const requests = await db.query.followRequests.findMany({
    where: eq(schema.followRequests.followingId, user.id),
    with: {
      follower: true
    }
  });

  return JSON.parse(JSON.stringify(requests));
}

export async function respondToFollowRequest(requestId: string, accept: boolean) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const request = await db.query.followRequests.findFirst({
    where: eq(schema.followRequests.id, requestId)
  });

  if (!request || request.followingId !== user.id) {
    return { success: false, error: 'Request not found' };
  }

  if (accept) {
    // 1. Create Follow
    await db.insert(schema.follows).values({
      followerId: request.followerId,
      followingId: user.id,
      createdAt: new Date().toISOString(),
    });

    // 2. Update Counts
    await db.update(schema.users)
      .set({ followers: sql`${schema.users.followers} + 1` })
      .where(eq(schema.users.id, user.id));
    
    await db.update(schema.users)
      .set({ following: sql`${schema.users.following} + 1` })
      .where(eq(schema.users.id, request.followerId));

    // 3. Create Notification for the follower
    try {
      await db.insert(schema.notifications).values({
        id: `ntf-fra-${requestId}`,
        userId: request.followerId,
        actorId: user.id,
        type: 'follow_accept',
        message: `accepted your follow request`,
        timeAgo: 'just now',
        createdAt: new Date().toISOString(),
        isRead: false,
      });
    } catch (err) {
      console.error('Failed to create follow accept notification:', err);
    }
  }

  // 4. Delete the request
  await db.delete(schema.followRequests).where(eq(schema.followRequests.id, requestId));

  revalidatePath('/settings/privacy');
  revalidatePath('/notifications');
  return { success: true };
}

export async function updateAccountPrivacy(isPrivate: boolean) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return { success: false, error: 'Not authenticated' };

  await db.update(schema.users)
    .set({ isPrivate })
    .where(eq(schema.users.id, userId));

  revalidatePath('/settings/privacy');
  revalidatePath('/profile');
  return { success: true };
}

export async function updateActivityStatus(show: boolean) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  await db.update(schema.users)
    .set({ showActivityStatus: show })
    .where(eq(schema.users.id, user.id));

  revalidatePath('/settings/privacy');
  return { success: true };
}

export async function recordUserActivity() {
  const user = await getCurrentUser();
  if (!user) return { success: false };

  await db.update(schema.users)
    .set({ lastSeen: new Date().toISOString() })
    .where(eq(schema.users.id, user.id));

  return { success: true };
}

export async function getFollowStatus(targetId: string) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return { following: false };

  const follow = await db.query.follows.findFirst({
    where: and(
      eq(schema.follows.followerId, userId),
      eq(schema.follows.followingId, targetId)
    ),
  });

  return { following: !!follow };
}

export async function submitFeedback(data: { type: string; message: string }) {
  const user = await getCurrentUser();
  const userId = user?.id;
  
  // --- INDUSTRY LEVEL: Rate Limiting ---
  // Check if this user sent feedback in the last 2 minutes
  if (userId) {
    const lastFeedback = await db.query.feedback.findFirst({
      where: eq(schema.feedback.userId, userId),
      orderBy: (fb, { desc }) => [desc(fb.createdAt)],
    });

    if (lastFeedback) {
      const lastTime = new Date(lastFeedback.createdAt).getTime();
      const now = Date.now();
      if (now - lastTime < 2 * 60 * 1000) { // 2 minutes
        throw new Error('Please wait before sending another feedback.');
      }
    }
  }

  const id = `fb${Date.now()}`;
  
  await db.insert(schema.feedback).values({
    id,
    userId: userId || null,
    type: data.type,
    message: data.message,
  });

  return { success: true };
}

export async function getFeedbackAction() {
  const user = await getCurrentUser();
  
  // --- INDUSTRY LEVEL: Admin Protection ---
  if (!user || user.role !== 'admin') {
    throw new Error('Unauthorized access');
  }

  const allFeedback = await db.query.feedback.findMany({
    orderBy: (fb, { desc }) => [desc(fb.createdAt)],
    with: {
      user: true
    }
  });

  return JSON.parse(JSON.stringify(allFeedback));
}

export async function replyToFeedback(feedbackId: string, replyText: string) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  // 1. Update the feedback record
  await db.update(schema.feedback)
    .set({ reply: replyText })
    .where(eq(schema.feedback.id, feedbackId));

  // 2. Find the user to notify
  const fb = await db.query.feedback.findFirst({
    where: eq(schema.feedback.id, feedbackId),
  });

  if (fb && fb.userId) {
    // 3. Create a notification
    await db.insert(schema.notifications).values({
      id: `reply-${feedbackId}`,
      userId: fb.userId,
      actorId: admin.id,
      type: 'alert',
      message: `responded to your feedback: "${replyText.slice(0, 50)}${replyText.length > 50 ? '...' : ''}"`,
      timeAgo: 'just now',
      isRead: false,
    });
  }

  revalidatePath('/admin/feedback');
  return { success: true };
}

export async function getAllPostsAdmin() {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'admin') {
    throw new Error('Unauthorized access');
  }

  const allPosts = await db.query.posts.findMany({
    orderBy: (p, { desc }) => [desc(p.publishedAt)],
    with: {
      author: true,
    }
  });

  return JSON.parse(JSON.stringify(allPosts));
}

export async function adminDeletePost(postId: string, reason: string) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'admin') {
    throw new Error('Unauthorized');
  }

  // Find the post to get the author
  const post = await db.query.posts.findFirst({
    where: eq(schema.posts.id, postId),
  });

  if (!post) throw new Error('Post not found');

  // 1. Delete related data first (likes, comments, saves)
  await db.delete(schema.postLikes).where(eq(schema.postLikes.postId, postId));
  await db.delete(schema.postComments).where(eq(schema.postComments.postId, postId));
  await db.delete(schema.postSaves).where(eq(schema.postSaves.postId, postId));

  // 2. Delete the post
  await db.delete(schema.posts).where(eq(schema.posts.id, postId));

  // 3. Notify the user
  if (post.authorId) {
    await db.insert(schema.notifications).values({
      id: `del-${postId}-${Date.now()}`,
      userId: post.authorId,
      actorId: admin.id,
      type: 'alert',
      message: `Your post "${post.title.slice(0, 30)}${post.title.length > 30 ? '...' : ''}" was removed. Reason: ${reason}`,
      timeAgo: 'just now',
      isRead: false,
    });
  }

  revalidatePath('/admin/posts');
  revalidatePath('/');
  return { success: true };
}

export async function getFollowCounts(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  return {
    followers: user?.followers || 0,
    following: user?.following || 0,
  };
}


export async function getFollowers(userId: string) {
  const followers = await db.query.follows.findMany({
    where: eq(schema.follows.followingId, userId),
    with: {
      follower: true,
    },
  });
  return JSON.parse(JSON.stringify(followers.map(f => f.follower)));
}

export async function getFollowing(userId: string) {
  const following = await db.query.follows.findMany({
    where: eq(schema.follows.followerId, userId),
    with: {
      following: true,
    },
  });
  return JSON.parse(JSON.stringify(following.map(f => f.following)));
}

export async function searchExploreAction(query: string) {
  if (!query) return { users: [], posts: [] };
  const cookieStore = await cookies();
  const currentUserId = cookieStore.get('proxypress_session')?.value;

  const [users, posts] = await Promise.all([
    queries.searchUsers(query, currentUserId),
    queries.searchPosts(query)
  ]);
  return { users, posts };
}

export async function searchUsersInMessaging(query: string) {
  if (!query) return [];
  const cookieStore = await cookies();
  const currentUserId = cookieStore.get('proxypress_session')?.value;
  return await queries.searchUsers(query, currentUserId);
}

export async function getExploreDataAction() {
  return await queries.getExploreData();
}

export async function getUnreadMessageCountAction() {
  const user = await getCurrentUser();
  if (!user) return 0;
  return await queries.getUnreadMessageCount(user.id);
}

export async function getUnreadNotificationsCountAction() {
  const user = await getCurrentUser();
  if (!user) return 0;
  return await queries.getUnreadNotificationsCount(user.id);
}

export async function getNotificationsAction() {
  const user = await getCurrentUser();
  if (!user) return [];
  const notifs = await queries.getNotifications(user.id);
  return JSON.parse(JSON.stringify(notifs));
}

export async function getPostById(id: string) {
  const post = await db.query.posts.findFirst({
    where: eq(schema.posts.id, id),
    with: { author: true }
  });
  return post ? JSON.parse(JSON.stringify(post)) : null;
}

export async function markNotificationRead(id: string) {
  await db.update(schema.notifications)
    .set({ isRead: true })
    .where(eq(schema.notifications.id, id));
  return { success: true };
}

export async function dismissNotification(id: string) {
  await db.delete(schema.notifications)
    .where(eq(schema.notifications.id, id));
  return { success: true };
}

export async function updateUserNotificationSettings(settings: {
  notifyLikes: boolean;
  notifyComments: boolean;
  notifyMentions: boolean;
  notifyNewPosts: boolean;
}) {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return { success: false, error: 'Not authenticated' };

  await db.update(schema.users)
    .set(settings)
    .where(eq(schema.users.id, userId));

  revalidatePath('/settings/notifications');
  return { success: true };
}

export async function updatePost(postId: string, data: {
  title: string;
  description: string;
  content: string;
  category: string;
  imageUrl: string;
  videoUrl?: string;
}) {
  const user = await getCurrentUser();
  if (!user) throw new Error('Not authenticated');

  const post = await db.query.posts.findFirst({
    where: eq(schema.posts.id, postId),
  });

  if (!post) throw new Error('Post not found');
  // Only author can edit
  if (post.authorId !== user.id) throw new Error('Unauthorized');

  await db.update(schema.posts).set({
    title: data.title,
    description: data.description,
    content: data.content,
    category: data.category as any,
    imageUrl: data.imageUrl,
    videoUrl: data.videoUrl,
  }).where(eq(schema.posts.id, postId));

  revalidatePath('/');
  revalidatePath(`/article/${post.slug}`);
  
  // Invalidate Public Cache
  await redis.del('public_initial_data').catch(() => null);
  
  return { success: true };
}

export async function updateInteractionPrivacy(settings: {
  commentPrivacy?: string;
  mentionPrivacy?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  await db.update(schema.users)
    .set(settings)
    .where(eq(schema.users.id, user.id));

  revalidatePath('/settings/privacy/interactions');
  return { success: true };
}


