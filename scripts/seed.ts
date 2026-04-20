import { db } from '../lib/db';
import * as schema from '../lib/db/schema';
import * as mockData from '../lib/data';

async function seed() {
  console.log('Seeding database...');

  // 1. Categories
  console.log('Inserting categories...');
  await db.insert(schema.categories).values(
    mockData.categories.map((c) => ({
      name: c.name,
      emoji: c.emoji,
      color: c.color,
    }))
  ).onConflictDoNothing();

  // 2. Users
  console.log('Inserting users...');
  const allUsers = [mockData.currentUser, ...mockData.authors];
  await db.insert(schema.users).values(
    allUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email || '',
      avatar: u.avatar,
      college: u.college,
      bio: u.bio,
      contactInfo: u.contactInfo || '',
      followers: u.followers,
      following: u.following,
      postsCount: u.posts,
      savedCount: u.saved || 0,
    }))
  ).onConflictDoNothing();

  // 3. Posts
  console.log('Inserting posts...');
  await db.insert(schema.posts).values(
    mockData.posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      content: p.content,
      category: p.category,
      authorId: p.author.id,
      imageUrl: p.imageUrl,
      imageColor: p.imageColor,
      publishedAt: p.publishedAt,
      likes: p.likes,
      comments: p.comments,
    }))
  ).onConflictDoNothing();

  // 4. Notifications
  console.log('Inserting notifications...');
  await db.insert(schema.notifications).values(
    mockData.notifications.map((n) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      timeAgo: n.timeAgo,
      isRead: n.isRead,
      postId: mockData.posts.find(p => p.title.includes(n.postTitle || ''))?.id || null,
      actorId: allUsers.find(u => u.name === n.actor)?.id || null,
      userId: mockData.currentUser.id,
    }))
  ).onConflictDoNothing();

  // 5. Announcements
  console.log('Inserting announcements...');
  await db.insert(schema.announcements).values(
    mockData.announcements.map((a) => ({
      id: a.id,
      text: a.text,
      type: a.type,
      timeAgo: a.timeAgo,
    }))
  ).onConflictDoNothing();

  // 6. Trending Topics
  console.log('Inserting trending topics...');
  await db.insert(schema.trendingTopics).values(
    mockData.trendingTopics.map((t) => ({
      tag: t.tag,
      postsCount: t.posts,
    }))
  ).onConflictDoNothing();

  // 7. Conversations & Messages (Mock data from messages page)
  console.log('Inserting conversations & messages...');
  const mockConversations = [
    {
      id: '1',
      user: { id: 'u1', name: 'Arjun Mehta', avatar: 'AM', online: true },
      lastMessage: 'Did you see the new campus event? 🎉',
      lastMessageTime: '2m',
      unreadCount: 3,
      messages: [
        { id: 'm1', senderId: 'u1', text: 'Hey! How are you doing?', timestamp: '10:30 AM', seen: true, type: 'text' },
        { id: 'm8', senderId: 'u1', text: 'Did you see the new campus event? 🎉', timestamp: '11:02 AM', seen: false, type: 'text' },
      ],
    },
    // Adding just a few for brevity in seed
  ];

  for (const conv of mockConversations) {
    await db.insert(schema.conversations).values({
      id: conv.id,
      lastMessage: conv.lastMessage,
      lastMessageTime: conv.lastMessageTime,
      unreadCount: conv.unreadCount,
    }).onConflictDoNothing();

    await db.insert(schema.conversationParticipants).values([
      { conversationId: conv.id, userId: 'u0' }, // Current user
      { conversationId: conv.id, userId: conv.user.id },
    ]).onConflictDoNothing();

    await db.insert(schema.messages).values(
      conv.messages.map((m) => ({
        id: m.id,
        conversationId: conv.id,
        senderId: m.senderId === 'me' ? 'u0' : m.senderId,
        text: m.text,
        timestamp: m.timestamp,
        seen: m.seen,
        type: m.type as any,
      }))
    ).onConflictDoNothing();
  }

  console.log('Seeding completed!');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
