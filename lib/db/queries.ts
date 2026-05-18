import { db } from './index';
import * as schema from './schema';
import { eq, desc, and, ne, isNull, inArray, or, like, sql, notInArray } from 'drizzle-orm';

export async function getUsers() {
  return await db.select().from(schema.users);
}

export async function getPosts(userId?: string, limit: number = 10, offset: number = 0) {
  let excludedUserIds: string[] = [];
  let followingUserIds: string[] = [];
  
  if (userId) {
    const [mutes, blocks, following] = await Promise.all([
      db.select().from(schema.userMutes).where(eq(schema.userMutes.userId, userId)),
      db.select().from(schema.userBlocks).where(or(
        eq(schema.userBlocks.userId, userId),
        eq(schema.userBlocks.blockedId, userId)
      )),
      db.select().from(schema.follows).where(eq(schema.follows.followerId, userId))
    ]);

    excludedUserIds = [
      ...mutes.map(m => m.mutedId),
      ...blocks.map(b => b.userId === userId ? b.blockedId : b.userId)
    ];
    
    followingUserIds = following.map(f => f.followingId);
  }

  const results = await db.select({
    post: schema.posts,
    author: schema.users,
  })
  .from(schema.posts)
  .innerJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
  .where(and(
    excludedUserIds.length > 0 ? notInArray(schema.posts.authorId, excludedUserIds) : undefined,
    or(
      eq(schema.users.isPrivate, false),
      userId ? inArray(schema.posts.authorId, followingUserIds) : undefined,
      userId ? eq(schema.posts.authorId, userId) : undefined
    )
  ))
  .orderBy(desc(schema.posts.publishedAt))
  .limit(limit)
  .offset(offset);

  if (results.length === 0) return [];

  // Batch fetch all likes and saves for all posts in one go (SOLVES N+1 PROBLEM)
  const postIds = results.map(r => r.post.id);
  
  const [allLikes, allSaves] = await Promise.all([
    db.select().from(schema.postLikes).where(inArray(schema.postLikes.postId, postIds)),
    db.select().from(schema.postSaves).where(inArray(schema.postSaves.postId, postIds)),
  ]);

  // Map them back to the posts
  const postsWithRelations = results.map(({ post, author }) => {
    return {
      ...post,
      author,
      likesList: allLikes.filter(l => l.postId === post.id),
      savedList: allSaves.filter(s => s.postId === post.id),
    };
  });

  return postsWithRelations;
}

export async function getPostBySlug(slug: string) {
  return await db.query.posts.findFirst({
    where: eq(schema.posts.slug, slug),
    with: {
      author: true,
      likesList: true,
      savedList: true,
      commentsList: {
        with: {
          user: true,
          replies: {
            with: {
              user: true,
              likes: true,
            }
          },
          likes: true,
        },
        where: isNull(schema.postComments.parentId), // Only top-level comments
      }
    },
  });
}

export async function getPostsByCategory(categoryName: string, userId?: string) {
  let excludedUserIds: string[] = [];
  if (userId) {
    const [mutes, blocks] = await Promise.all([
      db.select().from(schema.userMutes).where(eq(schema.userMutes.userId, userId)),
      db.select().from(schema.userBlocks).where(or(
        eq(schema.userBlocks.userId, userId),
        eq(schema.userBlocks.blockedId, userId)
      ))
    ]);
    excludedUserIds = [
      ...mutes.map(m => m.mutedId),
      ...blocks.map(b => b.userId === userId ? b.blockedId : b.userId)
    ];
  }

  return await db.query.posts.findMany({
    where: and(
      eq(schema.posts.category, categoryName),
      excludedUserIds.length > 0 ? notInArray(schema.posts.authorId, excludedUserIds) : undefined
    ),
    with: {
      author: true,
    },
    orderBy: [desc(schema.posts.publishedAt)],
  });
}

export async function getRelatedPosts(currentPostId: string, category: string, limit = 3) {
  return await db.query.posts.findMany({
    where: and(
      eq(schema.posts.category, category),
      ne(schema.posts.id, currentPostId)
    ),
    with: {
      author: true,
    },
    limit,
  });
}

export async function getNotifications(userId?: string) {
  if (!userId) return [];

  // Filter out notifications from muted or blocked users
  const [mutes, blocks] = await Promise.all([
    db.select().from(schema.userMutes).where(eq(schema.userMutes.userId, userId)),
    db.select().from(schema.userBlocks).where(or(
      eq(schema.userBlocks.userId, userId),
      eq(schema.userBlocks.blockedId, userId)
    ))
  ]);

  const excludedUserIds = [
    ...mutes.map(m => m.mutedId),
    ...blocks.map(b => b.userId === userId ? b.blockedId : b.userId)
  ];

  return await db.query.notifications.findMany({
    where: and(
      eq(schema.notifications.userId, userId),
      excludedUserIds.length > 0 ? notInArray(schema.notifications.actorId, excludedUserIds) : undefined
    ),
    with: {
      actor: true,
      post: true,
    },
    orderBy: [desc(schema.notifications.timeAgo)],
  });
}

export async function getCategories() {
  return await db.select().from(schema.categories);
}

export async function getTrendingTopics() {
  return await db.select().from(schema.trendingTopics).orderBy(desc(schema.trendingTopics.postsCount));
}

export async function getAnnouncements() {
  return await db.select().from(schema.announcements).orderBy(desc(schema.announcements.id));
}

export async function getConversations(userId: string) {
  // 1. Get user block lists (both directions)
  const blocks = await db.select()
    .from(schema.userBlocks)
    .where(or(
      eq(schema.userBlocks.userId, userId),
      eq(schema.userBlocks.blockedId, userId)
    ));
  
  const blockedUserIds = blocks.map(b => b.userId === userId ? b.blockedId : b.userId);

  // 2. Get IDs of conversations where this user is a participant
  const participantResults = await db.select({ id: schema.conversationParticipants.conversationId })
    .from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.userId, userId));

  const conversationIds = participantResults
    .map(p => p.id)
    .filter((id): id is string => id !== null);

  if (conversationIds.length === 0) return [];

  // 3. Fetch full conversation data (without all messages)
  const convs = await db.query.conversations.findMany({
    where: inArray(schema.conversations.id, conversationIds),
    orderBy: [desc(schema.conversations.lastMessageTime)],
    with: {
      participants: {
        with: {
          user: true,
        },
      },
    },
  });

  // 4. Efficiently fetch unread counts for all conversations in one query
  const unreadCounts = await db.select({
    conversationId: schema.messages.conversationId,
    count: sql<number>`count(*)`
  })
  .from(schema.messages)
  .where(and(
    inArray(schema.messages.conversationId, conversationIds),
    ne(schema.messages.senderId, userId),
    eq(schema.messages.seen, false)
  ))
  .groupBy(schema.messages.conversationId);

  const unreadMap = new Map(unreadCounts.map(uc => [uc.conversationId, Number(uc.count)]));

  // 5. Filter out conversations with blocked users and map unread counts
  // Also deduplicate conversations so we only show one per user, avoiding DB pollution bugs
  const seenUserIds = new Set();
  const results = convs
    .filter(conv => {
      const otherParticipant = conv.participants.find(p => p.userId !== userId);
      if (!otherParticipant) return true;
      if (blockedUserIds.includes(otherParticipant.userId as string)) return false;
      
      if (seenUserIds.has(otherParticipant.userId)) {
        return false; // Skip duplicates (keep the latest one because convs is sorted by lastMessageTime DESC)
      }
      seenUserIds.add(otherParticipant.userId);
      return true;
    })
    .map(conv => {
      return {
        ...conv,
        unreadCount: unreadMap.get(conv.id) || 0,
        messages: [] // We fetch messages separately when chat is opened
      };
    });

  return results;
}

export async function getMessages(conversationId: string) {
  return await db.query.messages.findMany({
    where: eq(schema.messages.conversationId, conversationId),
    orderBy: [desc(schema.messages.timestamp)],
  });
}
export async function getStories(userId?: string) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  let excludedUserIds: string[] = [];
  if (userId) {
    const [mutes, blocks] = await Promise.all([
      db.select().from(schema.userMutes).where(eq(schema.userMutes.userId, userId)),
      db.select().from(schema.userBlocks).where(or(
        eq(schema.userBlocks.userId, userId),
        eq(schema.userBlocks.blockedId, userId)
      ))
    ]);
    excludedUserIds = [
      ...mutes.map(m => m.mutedId),
      ...blocks.map(b => b.userId === userId ? b.blockedId : b.userId)
    ];
  }

  const storiesResults = await db.query.stories.findMany({
    with: {
      slides: {
        where: (slides, { gt }) => gt(slides.createdAt, twentyFourHoursAgo)
      },
      user: true,
      views: userId ? {
        where: eq(schema.storyViews.viewerId, userId)
      } : undefined,
    },
  });

  // Filter:
  // 1. Only return stories that have active slides
  // 2. Filter out stories from blocked users
  // 3. Filter out stories from private accounts (if not following)
  let followingIds: string[] = [];
  if (userId) {
    const following = await db.select().from(schema.follows).where(eq(schema.follows.followerId, userId));
    followingIds = following.map(f => f.followingId);
  }
  
  return storiesResults
    .filter(s => {
      const hasSlides = s.slides && s.slides.length > 0;
      if (!hasSlides) return false;
      if (userId && excludedUserIds.includes(s.userId)) return false;
      
      // Privacy check
      if ((s.user as any).isPrivate) {
        if (userId && (followingIds.includes(s.userId) || s.userId === userId)) {
          return true;
        }
        return false;
      }
      return true;
    })
    .map(s => ({
      ...s,
      seen: s.views && s.views.length > 0
    }));
}

export async function getPostComments(postId: string) {
  return await db.query.postComments.findMany({
    where: eq(schema.postComments.postId, postId),
    with: {
      user: true,
      likes: true,
      replies: {
        with: {
          user: true,
          likes: true,
        }
      }
    },
    orderBy: [desc(schema.postComments.createdAt)],
  });
}

export async function getPostLike(postId: string, userId: string) {
  return await db.query.postLikes.findFirst({
    where: and(
      eq(schema.postLikes.postId, postId),
      eq(schema.postLikes.userId, userId)
    ),
  });
}

export async function getPostSave(postId: string, userId: string) {
  return await db.query.postSaves.findFirst({
    where: and(
      eq(schema.postSaves.postId, postId),
      eq(schema.postSaves.userId, userId)
    ),
  });
}

export async function getUserSavedPosts(userId: string) {
  const saves = await db.query.postSaves.findMany({
    where: eq(schema.postSaves.userId, userId),
    with: {
      post: {
        with: {
          author: true,
          likesList: true,
          savedList: true,
        }
      }
    }
  });
  return saves.map(s => s.post);
}
export async function searchUsers(query: string, currentUserId?: string) {
  const q = `%${query}%`;
  
  let blockedUserIds: string[] = [];
  if (currentUserId) {
    const blocks = await db.select()
      .from(schema.userBlocks)
      .where(or(
        eq(schema.userBlocks.userId, currentUserId),
        eq(schema.userBlocks.blockedId, currentUserId)
      ));
    blockedUserIds = blocks.map(b => b.userId === currentUserId ? b.blockedId : b.userId);
  }

  const results = await db.query.users.findMany({
    where: and(
      or(
        like(schema.users.name, q),
        like(schema.users.username, q)
      ),
      blockedUserIds.length > 0 ? notInArray(schema.users.id, blockedUserIds) : undefined
    ),
    limit: 10,
  });

  return results;
}

export async function searchPosts(query: string) {
  const q = `%${query}%`;
  return await db.query.posts.findMany({
    where: or(
      like(schema.posts.title, q),
      like(schema.posts.description, q)
    ),
    with: {
      author: true,
    },
    limit: 20,
  });
}

export async function getExploreData() {
  // Fetch trending posts (recent posts with most likes/comments)
  const trendingPosts = await db.query.posts.findMany({
    with: {
      author: true,
    },
    orderBy: [desc(schema.posts.likes)],
    limit: 24,
  });

  // Fetch suggested users (simple random for now)
  const suggestedUsers = await db.query.users.findMany({
    limit: 15,
  });

  return {
    trendingPosts,
    suggestedUsers,
  };
}
export async function getUnreadMessageCount(userId: string) {
  const parts = await db.select({ id: schema.conversationParticipants.conversationId })
    .from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.userId, userId));

  const convIds = parts.map(p => p.id).filter((id): id is string => id !== null);
  if (convIds.length === 0) return 0;

  const result = await db.select({ count: sql<number>`count(*)` })
    .from(schema.messages)
    .where(and(
      inArray(schema.messages.conversationId, convIds),
      ne(schema.messages.senderId, userId),
      eq(schema.messages.seen, false)
    ));

  return Number(result[0]?.count || 0);
}

export async function getUnreadNotificationsCount(userId: string) {
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(schema.notifications)
    .where(and(
      eq(schema.notifications.userId, userId),
      eq(schema.notifications.isRead, false)
    ));
  return Number(result[0]?.count || 0);
}
