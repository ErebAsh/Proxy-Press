import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

import { relations } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email'),
  password: text('password'), // Plain text for demo, would be hashed in prod
  avatar: text('avatar').notNull(),
  college: text('college').notNull(),
  branch: text('branch'),
  department: text('department'),
  bio: text('bio').notNull(),
  contactInfo: text('contact_info'),
  followers: integer('followers').default(0),
  following: integer('following').default(0),
  postsCount: integer('posts_count').default(0),
  savedCount: integer('saved_count').default(0),
  // Onboarding fields
  username: text('username').unique(),      // @handle
  dateOfBirth: text('date_of_birth'),       // ISO date string
  gender: text('gender'),                   // optional
  links: text('links'),                     // JSON-stringified array of URLs
  phone: text('phone'),                     // with country code
  profilePicture: text('profile_picture'),  // uploaded image path
  onboardingComplete: integer('onboarding_complete', { mode: 'boolean' }).default(false),
});

export const userRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  notifications: many(notifications, { relationName: 'userNotifications' }),
  receivedNotifications: many(notifications, { relationName: 'actorNotifications' }),
  postLikes: many(postLikes),
  postComments: many(postComments),
  commentLikes: many(commentLikes),
  postSaves: many(postSaves),
}));

export const categories = sqliteTable('categories', {
  name: text('name').primaryKey(),
  emoji: text('emoji').notNull(),
  color: text('color').notNull(),
});

export const categoryRelations = relations(categories, ({ many }) => ({
  posts: many(posts),
}));

export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  content: text('content').notNull(),
  category: text('category').references(() => categories.name),
  authorId: text('author_id').references(() => users.id),
  imageUrl: text('image_url').notNull(),
  imageColor: text('image_color').notNull(),
  publishedAt: text('published_at').notNull(), // ISO string
  likes: integer('likes').default(0),
  comments: integer('comments').default(0),
});

export const postRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [posts.category],
    references: [categories.name],
  }),
  likesList: many(postLikes),
  commentsList: many(postComments),
  savedList: many(postSaves),
}));

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id),
  type: text('type').notNull(), // 'like', 'comment', 'mention', 'alert', 'follow'
  actorId: text('actor_id').references(() => users.id),
  message: text('message').notNull(),
  timeAgo: text('time_ago').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  postId: text('post_id').references(() => posts.id),
});

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
    relationName: 'userNotifications',
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: 'actorNotifications',
  }),
  post: one(posts, {
    fields: [notifications.postId],
    references: [posts.id],
  }),
}));

export const announcements = sqliteTable('announcements', {
  id: text('id').primaryKey(),
  text: text('text').notNull(),
  type: text('type').notNull(), // 'info', 'alert', 'warning'
  timeAgo: text('time_ago').notNull(),
});

export const trendingTopics = sqliteTable('trending_topics', {
  tag: text('tag').primaryKey(),
  postsCount: integer('posts_count').default(0),
});

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  lastMessage: text('last_message'),
  lastMessageTime: text('last_message_time'),
  unreadCount: integer('unread_count').default(0),
  isTyping: integer('is_typing', { mode: 'boolean' }).default(false),
  muted: integer('muted', { mode: 'boolean' }).default(false),
  vanishMode: integer('vanish_mode', { mode: 'boolean' }).default(false),
});

export const conversationsRelations = relations(conversations, ({ many }) => ({
  participants: many(conversationParticipants),
  messages: many(messages),
}));

export const conversationParticipants = sqliteTable('conversation_participants', {
  conversationId: text('conversation_id').references(() => conversations.id),
  userId: text('user_id').references(() => users.id),
});

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
  conversation: one(conversations, {
    fields: [conversationParticipants.conversationId],
    references: [conversations.id],
  }),
  user: one(users, {
    fields: [conversationParticipants.userId],
    references: [users.id],
  }),
}));

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').references(() => conversations.id),
  senderId: text('sender_id').references(() => users.id),
  text: text('text').notNull(),
  timestamp: text('timestamp').notNull(),
  seen: integer('seen', { mode: 'boolean' }).default(false),
  type: text('type').notNull(), // 'text', 'image', 'heart', 'voice', 'video', 'file'
  replyTo: text('reply_to').references(() => messages.id),
  attachment: text('attachment'),
});

export const messageRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
  replyToMessage: one(messages, {
    fields: [messages.replyTo],
    references: [messages.id],
    relationName: 'replies',
  }),
}));

export const stories = sqliteTable('stories', {
  userId: text('user_id').primaryKey().references(() => users.id),
  seen: integer('seen', { mode: 'boolean' }).default(false),
});

export const storiesRelations = relations(stories, ({ one, many }) => ({
  user: one(users, {
    fields: [stories.userId],
    references: [users.id],
  }),
  slides: many(storySlides),
}));

export const storySlides = sqliteTable('story_slides', {
  id: text('id').primaryKey(),
  storyId: text('story_id').references(() => stories.userId),
  type: text('type').notNull(), // 'text', 'image', 'video'
  text: text('text'),
  emoji: text('emoji'),
  caption: text('caption'),
  gradient: text('gradient').notNull(),
  mediaUrl: text('media_url'),
  timestamp: text('timestamp').notNull(),
  createdAt: text('created_at').notNull().$defaultFn(() => new Date().toISOString()),
});

export const storySlidesRelations = relations(storySlides, ({ one }) => ({
  story: one(stories, {
    fields: [storySlides.storyId],
    references: [stories.userId],
  }),
}));

export const postLikes = sqliteTable('post_likes', {
  postId: text('post_id').notNull().references(() => posts.id),
  userId: text('user_id').notNull().references(() => users.id),
});

export const postLikesRelations = relations(postLikes, ({ one }) => ({
  post: one(posts, {
    fields: [postLikes.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postLikes.userId],
    references: [users.id],
  }),
}));

export const postComments = sqliteTable('post_comments', {
  id: text('id').primaryKey(),
  postId: text('post_id').notNull().references(() => posts.id),
  userId: text('user_id').notNull().references(() => users.id),
  text: text('text').notNull(),
  parentId: text('parent_id').references(() => postComments.id),
  createdAt: text('created_at').notNull(), // ISO string
});

export const postCommentsRelations = relations(postComments, ({ one, many }) => ({
  post: one(posts, {
    fields: [postComments.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postComments.userId],
    references: [users.id],
  }),
  parent: one(postComments, {
    fields: [postComments.parentId],
    references: [postComments.id],
    relationName: 'replies',
  }),
  replies: many(postComments, {
    relationName: 'replies',
  }),
  likes: many(commentLikes),
}));

export const commentLikes = sqliteTable('comment_likes', {
  commentId: text('comment_id').notNull().references(() => postComments.id),
  userId: text('user_id').notNull().references(() => users.id),
});

export const commentLikesRelations = relations(commentLikes, ({ one }) => ({
  comment: one(postComments, {
    fields: [commentLikes.commentId],
    references: [postComments.id],
  }),
  user: one(users, {
    fields: [commentLikes.userId],
    references: [users.id],
  }),
}));

export const postSaves = sqliteTable('post_saves', {
  postId: text('post_id').notNull().references(() => posts.id),
  userId: text('user_id').notNull().references(() => users.id),
});

export const postSavesRelations = relations(postSaves, ({ one }) => ({
  post: one(posts, {
    fields: [postSaves.postId],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postSaves.userId],
    references: [users.id],
  }),
}));

// ─── Safety Features ───

export const userBlocks = sqliteTable('user_blocks', {
  userId: text('user_id').notNull().references(() => users.id),
  blockedId: text('blocked_id').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const userBlocksRelations = relations(userBlocks, ({ one }) => ({
  user: one(users, {
    fields: [userBlocks.userId],
    references: [users.id],
  }),
  blockedUser: one(users, {
    fields: [userBlocks.blockedId],
    references: [users.id],
  }),
}));

export const userMutes = sqliteTable('user_mutes', {
  userId: text('user_id').notNull().references(() => users.id),
  mutedId: text('muted_id').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const userMutesRelations = relations(userMutes, ({ one }) => ({
  user: one(users, {
    fields: [userMutes.userId],
    references: [users.id],
  }),
  mutedUser: one(users, {
    fields: [userMutes.mutedId],
    references: [users.id],
  }),
}));

export const userReports = sqliteTable('user_reports', {
  id: text('id').primaryKey(),
  reporterId: text('reporter_id').notNull().references(() => users.id),
  targetId: text('target_id').notNull().references(() => users.id),
  reason: text('reason').notNull(),
  createdAt: text('created_at').notNull(),
});

export const userReportsRelations = relations(userReports, ({ one }) => ({
  reporter: one(users, {
    fields: [userReports.reporterId],
    references: [users.id],
  }),
  target: one(users, {
    fields: [userReports.targetId],
    references: [users.id],
  }),
}));

export const follows = sqliteTable('follows', {
  followerId: text('follower_id').notNull().references(() => users.id),
  followingId: text('following_id').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
});

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
  }),
}));
