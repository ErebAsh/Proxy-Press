'use server';

import * as queries from './db/queries';
import { db } from './db';
import * as schema from './db/schema';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { cookies } from 'next/headers';

export async function getInitialData(userId?: string) {
  const [posts, authors, categories, trendingTopics, announcements, notifications, stories] = await Promise.all([
    queries.getPosts(),
    queries.getUsers(),
    queries.getCategories(),
    queries.getTrendingTopics(),
    queries.getAnnouncements(),
    queries.getNotifications(userId),
    queries.getStories(),
  ]);

  // Deep clone to ensure all data is perfectly serializable POJOs for RSC stream
  return JSON.parse(JSON.stringify({
    posts,
    authors,
    categories,
    trendingTopics,
    announcements,
    notifications,
    stories,
  }));
}

export async function getStories() {
  const allStories = await queries.getStories();
  // Filter out any story groupings that have 0 slides (e.g. all expired)
  const validStories = allStories.filter((s: any) => s.slides && s.slides.length > 0);
  return JSON.parse(JSON.stringify(validStories));
}

export async function getPostDetail(slug: string) {
  const post = await queries.getPostBySlug(slug);
  if (!post) return null;
  
  // Also get related posts from DB
  const related = await queries.getRelatedPosts(post.id, post.category || 'News');
  
  return JSON.parse(JSON.stringify({ post, related }));
}

export async function getConversations(userId: string) {
  return JSON.parse(JSON.stringify(await queries.getConversations(userId)));
}

/**
 * Universal Media Upload Action
 * Saves files to public/uploads/{type} with UUID naming
 */
export async function uploadMedia(formData: FormData) {
  const file = formData.get('file') as File;
  const category = formData.get('category') as 'images' | 'videos' | 'stories';
  
  if (!file) throw new Error('No file provided');

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = `${randomUUID()}-${file.name.replace(/\s+/g, '_')}`;
  const relativePath = `/uploads/${category}/${fileName}`;
  const absolutePath = join(process.cwd(), 'public', relativePath);

  // Ensure directory exists (redundant if mkdir -p was run, but safe)
  await mkdir(join(process.cwd(), 'public', 'uploads', category), { recursive: true });
  
  await writeFile(absolutePath, buffer);

  return { url: relativePath };
}

export async function createPost(data: {
  title: string;
  description: string;
  content: string;
  category: string;
  imageUrl: string;
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
    imageColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', // Default gradient
    publishedAt: new Date().toISOString(),
  });

  revalidatePath('/');
  return { success: true, id };
}

export async function sendMessage(data: { 
  conversationId: string; 
  senderId: string; 
  text: string; 
  type: string;
  attachment?: string;
}) {
  const messageId = `m${Date.now()}`;
  let finalConversationId = data.conversationId;

  // Handle new conversation creation
  if (finalConversationId.startsWith('new_')) {
    const targetUserId = finalConversationId.replace('new_', '');
    const newConvId = `c${Date.now()}`;
    
    // Create the conversation
    await db.insert(schema.conversations).values({
      id: newConvId,
      lastMessage: data.text,
      lastMessageTime: 'Just now',
    });

    // Add participants
    await db.insert(schema.conversationParticipants).values([
      { conversationId: newConvId, userId: data.senderId },
      { conversationId: newConvId, userId: targetUserId }
    ]);

    finalConversationId = newConvId;
  }
  
  await db.insert(schema.messages).values({
    id: messageId,
    conversationId: finalConversationId,
    senderId: data.senderId,
    text: data.text,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    seen: false,
    type: data.type as any,
    attachment: data.attachment,
  });

  // Update conversation last message (simplified)
  if (!data.conversationId.startsWith('new_')) {
    await db.update(schema.conversations)
      .set({ lastMessage: data.text, lastMessageTime: 'Just now' })
      .where(eq(schema.conversations.id, finalConversationId));
  }

  revalidatePath('/messages');
  return { success: true, id: messageId, conversationId: finalConversationId };
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
  revalidatePath(`/article/`); // Ideally we'd have the slug here but / handles it
  return { success: true };
}

export async function addPostComment(data: {
  postId: string;
  userId: string;
  text: string;
  parentId?: string;
}) {
  const id = `c${Date.now()}`;
  
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
  return { success: true, id };
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

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  if (!userId) return null;

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  return user ? JSON.parse(JSON.stringify(user)) : null;
}

export async function getUserProfile(idOrHandle: string) {
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

  return user ? JSON.parse(JSON.stringify(user)) : null;
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

  return { success: true };
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
    return { success: true, muted: false };
  }

  await db.insert(schema.userMutes).values({
    userId,
    mutedId: targetId,
    createdAt: new Date().toISOString(),
  });

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
    // Follow
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
      const actor = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
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
  const [users, posts] = await Promise.all([
    queries.searchUsers(query),
    queries.searchPosts(query)
  ]);
  return { users, posts };
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
