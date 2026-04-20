import { db } from './index';
import * as schema from './schema';
import { eq, desc, and, ne, isNull, inArray, or, like, sql } from 'drizzle-orm';

export async function getUsers() {
  return await db.select().from(schema.users);
}

export async function getPosts() {
  return await db.query.posts.findMany({
    with: {
      author: true,
      likesList: true,
      savedList: true,
    },
    orderBy: [desc(schema.posts.publishedAt)],
  });
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

export async function getPostsByCategory(categoryName: string) {
  return await db.query.posts.findMany({
    where: eq(schema.posts.category, categoryName),
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
  return await db.query.notifications.findMany({
    where: userId ? eq(schema.notifications.userId, userId) : undefined,
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
  // 1. Get IDs of conversations where this user is a participant
  const participantResults = await db.select({ id: schema.conversationParticipants.conversationId })
    .from(schema.conversationParticipants)
    .where(eq(schema.conversationParticipants.userId, userId));

  const conversationIds = participantResults
    .map(p => p.id)
    .filter((id): id is string => id !== null);

  if (conversationIds.length === 0) return [];

  // 2. Fetch full conversation data for only those IDs
  return await db.query.conversations.findMany({
    where: inArray(schema.conversations.id, conversationIds),
    with: {
      participants: {
        with: {
          user: true,
        },
      },
      messages: {
        orderBy: [desc(schema.messages.timestamp)],
        limit: 50,
      },
    },
  });
}

export async function getMessages(conversationId: string) {
  return await db.query.messages.findMany({
    where: eq(schema.messages.conversationId, conversationId),
    orderBy: [desc(schema.messages.timestamp)],
  });
}
export async function getStories() {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  return await db.query.stories.findMany({
    with: {
      slides: {
        where: (slides, { gt }) => gt(slides.createdAt, twentyFourHoursAgo)
      },
      user: true,
    },
  });
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
export async function searchUsers(query: string) {
  const q = `%${query}%`;
  return await db.query.users.findMany({
    where: or(
      like(schema.users.name, q),
      like(schema.users.username, q)
    ),
    limit: 10,
  });
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
