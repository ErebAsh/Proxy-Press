// lib/data.ts — Static mock data for Proxy-Press

export type Category =
  | "Events"
  | "Notices"
  | "Sports"
  | "Academic"
  | "Clubs"
  | "Exams"
  | "News"
  | "College Daily Update"
  | "Others";

export interface Author {
  id: string;
  name: string;
  email?: string;
  avatar: string; // emoji fallback
  college: string;
  bio: string;
  contactInfo?: string;
  followers: number;
  following: number;
  posts: number;
  saved: number;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  description: string;
  content: string;
  category: Category;
  author: Author;
  imageUrl: string;
  imageColor: string; // gradient fallback
  publishedAt: string;
  timeAgo: string;
  likes: number;
  comments: number;
  isLiked?: boolean;
  isSaved?: boolean;
}

export interface Notification {
  id: string;
  type: "like" | "comment" | "mention" | "alert" | "follow";
  actor: string;
  actorAvatar: string;
  message: string;
  timeAgo: string;
  isRead: boolean;
  postTitle?: string;
}

// ─── AUTHORS ───────────────────────────────────────────────────────────────

export const currentUser: Author | null = null;

export const authors: Author[] = [];

// ─── POSTS ─────────────────────────────────────────────────────────────────

export const posts: Post[] = [];

// ─── NOTIFICATIONS ──────────────────────────────────────────────────────────

export const notifications: Notification[] = [];

// ─── CATEGORIES ─────────────────────────────────────────────────────────────

export const categories: { name: Category; emoji: string; color: string }[] = [
  { name: "Events", emoji: "🎉", color: "#8B5CF6" },
  { name: "Notices", emoji: "📢", color: "#F59E0B" },
  { name: "Sports", emoji: "⚽", color: "#10B981" },
  { name: "Academic", emoji: "📚", color: "#2563EB" },
  { name: "Clubs", emoji: "🎭", color: "#EC4899" },
  { name: "Exams", emoji: "📝", color: "#EF4444" },
  { name: "News", emoji: "📰", color: "#6366F1" },
  { name: "College Daily Update", emoji: "🗓️", color: "#14B8A6" },
  { name: "Others", emoji: "✨", color: "#94A3B8" },
];

export const trendingTopics: { tag: string; posts: number }[] = [];

export const announcements: { id: string; text: string; type: "info" | "alert" | "warning"; timeAgo: string }[] = [];

export const getPostBySlug = (slug: string): Post | undefined =>
  posts.find((p) => p.slug === slug);

export const getPostsByCategory = (category: Category): Post[] =>
  posts.filter((p) => p.category === category);

export const getRelatedPosts = (post: Post, limit = 3): Post[] =>
  posts.filter((p) => p.id !== post.id && p.category === post.category).slice(0, limit);
