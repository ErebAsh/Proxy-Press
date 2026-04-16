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
  avatar: string; // emoji fallback
  college: string;
  bio: string;
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

export const currentUser: Author = {
  id: "u0",
  name: "Alex Johnson",
  avatar: "👤",
  college: "MIT Campus Press",
  bio: "Campus journalist | Tech & Culture enthusiast | Class of 2026",
  followers: 1240,
  following: 386,
  posts: 42,
  saved: 128,
};

export const authors: Author[] = [
  {
    id: "u1",
    name: "Priya Sharma",
    avatar: "👩",
    college: "Engineering Digest",
    bio: "Covering all things STEM on campus.",
    followers: 2100,
    following: 210,
    posts: 67,
    saved: 54,
  },
  {
    id: "u2",
    name: "Rohan Mehta",
    avatar: "🧑",
    college: "Sports Desk",
    bio: "Score updates, match analysis & athlete profiles.",
    followers: 980,
    following: 145,
    posts: 31,
    saved: 22,
  },
  {
    id: "u3",
    name: "Ananya Verma",
    avatar: "👩‍🎓",
    college: "Cultural Committee",
    bio: "Events, fests, and campus culture.",
    followers: 1560,
    following: 320,
    posts: 55,
    saved: 89,
  },
  {
    id: "u4",
    name: "Dev Kapoor",
    avatar: "🧑‍💻",
    college: "Academic Affairs",
    bio: "Exam schedules, results, and academic news.",
    followers: 740,
    following: 98,
    posts: 19,
    saved: 41,
  },
];

// ─── POSTS ─────────────────────────────────────────────────────────────────

export const posts: Post[] = [
  {
    id: "p1",
    slug: "annual-tech-fest-2026",
    title: "Annual Tech Fest 2026: A Celebration of Innovation & Creativity",
    description:
      "This year's Tech Fest promises to be bigger than ever with over 50 events, hackathons, and keynote speakers from top tech companies.",
    content: `
## The Biggest Campus Event of the Year

The Annual Tech Fest 2026 is just around the corner, and the excitement on campus is palpable. Set to run from March 15–18, this year's edition features over 50 events spanning competitive programming, robotics, design sprints, and live keynotes.

## What to Expect

**Hackathon 2026** kicks off the festival with a 24-hour coding marathon. Teams of up to four will tackle real-world problems presented by industry sponsors including Google, Microsoft, and Infosys.

The **Design Sprint** track challenges participants to ideate, prototype, and pitch a product in just 6 hours — a perfect showcase for UX enthusiasts.

## Keynote Speakers

Four luminaries from the tech world have confirmed their attendance:
- **Shreya Narayan** — VP of Engineering, Google India
- **Alex Wu** — Co-founder, TechBridge
- **Dr. Priya Mitra** — AI Researcher, IIT Bombay

## Registration

Registration is now open on the official portal. Early-bird passes are available until February 28. Don't miss out — seats are limited!
    `,
    category: "Events",
    author: authors[0],
    imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&q=80",
    imageColor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    publishedAt: "2026-04-14T08:00:00Z",
    timeAgo: "2h ago",
    likes: 342,
    comments: 47,
    isLiked: false,
    isSaved: false,
  },
  {
    id: "p2",
    slug: "semester-exam-schedule-released",
    title: "Final Semester Exam Schedule Released — Check Your Dates",
    description:
      "The academic office has officially published the end-semester examination timetable for all departments. Exams begin May 5.",
    content: `
## Exam Season Begins May 5

The Academic Affairs office has released the final semester examination schedule for 2025–26. All students are advised to download their individual timetable from the student portal.

## Key Dates

| Department | Start Date | End Date |
|---|---|---|
| Computer Science | May 5 | May 18 |
| Mechanical Engineering | May 6 | May 19 |
| Electronics | May 5 | May 17 |
| Civil Engineering | May 7 | May 20 |
| Business Studies | May 8 | May 18 |

## Hall Ticket Download

Hall tickets will be available for download from April 28 onwards. Students with any backlog clearance dues must settle them before April 25 to receive their hall ticket.

## Examination Rules

Refer to the updated Examination Conduct Policy 2026 document available on the college intranet. Key changes include a mandatory recess after every two examinations and a revised malpractice policy.
    `,
    category: "Exams",
    author: authors[3],
    imageUrl: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800&q=80",
    imageColor: "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    publishedAt: "2026-04-13T10:30:00Z",
    timeAgo: "1d ago",
    likes: 218,
    comments: 62,
    isLiked: true,
    isSaved: true,
  },
  {
    id: "p3",
    slug: "college-cricket-team-wins-inter-university",
    title: "College Cricket Team Wins Inter-University Championship 2026!",
    description:
      "In a nail-biting final, our college cricket team defeated rivals by 4 wickets to claim the Inter-University Championship title.",
    content: `
## Champions Again!

In what will go down as one of the most thrilling matches in inter-university history, our college cricket team clinched the Inter-University Championship 2026 title with a 4-wicket victory against City College in the final.

## Match Highlights

Chasing a target of 187, our team looked steady until a mid-innings collapse left them at 124/6. Captain **Aarav Singh** then played a match-defining knock of 58 not out off just 41 balls, guiding the team home with 2 overs to spare.

## Player of the Tournament

**Nikhil Rao** was adjudged Player of the Tournament for his consistency across all seven matches — amassing 310 runs and picking up 8 wickets.

## Coach's Take

"This win is the result of months of hard work and a never-give-up attitude," said Coach Sundar Kumar. "The boys showed tremendous character in the final."

The team will represent the district in the state-level championships next month.
    `,
    category: "Sports",
    author: authors[1],
    imageUrl: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80",
    imageColor: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    publishedAt: "2026-04-12T16:00:00Z",
    timeAgo: "2d ago",
    likes: 571,
    comments: 93,
    isLiked: false,
    isSaved: false,
  },
  {
    id: "p4",
    slug: "cultural-fest-reverie-2026",
    title: "Reverie 2026: Cultural Fest Registration Opens This Friday",
    description:
      "The most awaited cultural celebration of the year is back! Register your acts, performances, and workshops before seats fill up.",
    content: `
## Reverie 2026 — Where Art Meets Soul

Registrations for **Reverie 2026**, the college's annual cultural festival, open this Friday at 10 AM. The three-day extravaganza (April 22–24) will feature music, dance, drama, art installations, and a comedy night.

## How to Register

Visit the Reverie portal at culturalcommittee.college.edu and log in with your student ID. Choose your preferred events and complete payment (if applicable) before April 20.

## Featured Events

- **Battle of Bands** — Open to all genres, acoustics welcome
- **Nukkad Natak** — Street play competition
- **Fashion Show** — Theme: Sustainable Fashion
- **Open Mic Night** — 5-minute slots, any art form
- **Rangoli Competition** — Individual and team categories

## Guest Performances

A surprise Bollywood headliner has been confirmed for Day 2. Stay tuned to the Reverie Instagram page for the big reveal!
    `,
    category: "Events",
    author: authors[2],
    imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=800&q=80",
    imageColor: "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    publishedAt: "2026-04-11T09:00:00Z",
    timeAgo: "3d ago",
    likes: 428,
    comments: 78,
    isLiked: true,
    isSaved: false,
  },
  {
    id: "p5",
    slug: "new-library-digital-resources",
    title: "Library Adds 10,000+ Digital Resources — Access Them Now",
    description:
      "The central library has expanded its digital collection with e-books, research journals, and multimedia content across all major disciplines.",
    content: `
## Your Digital Library Just Got Bigger

The Central Library is proud to announce the addition of over 10,000 digital resources to its online collection. These include e-books, peer-reviewed journals, video lectures, and audio resources spanning Engineering, Science, Humanities, Business, and Law.

## How to Access

Log in to the Library Portal using your institutional email ID. Navigate to "Digital Resources" and browse by discipline, format, or keyword.

## Notable Additions

- **IEEE Xplore Full Collection** — 5M+ papers
- **Springer eBooks** — 3,000+ titles
- **MIT OpenCourseWare** — Curated video lectures
- **Project MUSE** — Humanities and social sciences

## Off-Campus Access

Students can access all digital resources off-campus using the VPN setup guide available on the IT support page.
    `,
    category: "Academic",
    author: authors[3],
    imageUrl: "https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=80",
    imageColor: "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    publishedAt: "2026-04-10T14:00:00Z",
    timeAgo: "4d ago",
    likes: 187,
    comments: 29,
    isLiked: false,
    isSaved: true,
  },
  {
    id: "p6",
    slug: "robotics-club-national-winners",
    title: "Robotics Club Bags Gold at National Robotics Olympiad 2026",
    description:
      "Team Synapse from our Robotics Club outperformed 120+ teams from across the country to win the prestigious National Robotics Olympiad.",
    content: `
## National Champions!

Team Synapse, representing our college's Robotics Club, has won the **National Robotics Olympiad 2026**, defeating over 120 teams from 40 universities across India.

## The Winning Robot

Their entry — a fully autonomous warehouse management robot named **ARIA (Autonomous Robotic Inventory Assistant)** — impressed judges with its speed, precision, and real-time decision-making capabilities.

## Team Members

- Kavya Reddy (Team Lead)
- Arjun Patel
- Siddharth Joshi
- Meha Shah

## The Faculty Mentor Speaks

"These students have been working on ARIA for 8 months straight. This victory is a testament to their passion and the incredible support infrastructure we have at our college," said Dr. Ramesh Iyer, Faculty Advisor.

The team now represents India at the Asia-Pacific Robotics Championship in Singapore next July.
    `,
    category: "Clubs",
    author: authors[0],
    imageUrl: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80",
    imageColor: "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    publishedAt: "2026-04-09T11:00:00Z",
    timeAgo: "5d ago",
    likes: 634,
    comments: 112,
    isLiked: false,
    isSaved: false,
  },
  {
    id: "p7",
    slug: "hostel-maintenance-notice",
    title: "Important: Hostel Water Supply Shutdown on April 18",
    description:
      "The hostel administration announces a scheduled water supply shutdown on April 18 from 6 AM to 6 PM for maintenance work.",
    content: `
## Scheduled Water Supply Shutdown

This is an official notice from the Hostel Administration. There will be a scheduled water supply shutdown in all hostel blocks on **April 18, 2026** from **6:00 AM to 6:00 PM** due to maintenance of the main water pipeline.

## Affected Blocks

All residential blocks (A–H) will be affected. Faculty quarters are not included in this shutdown.

## Precautions

- Store sufficient water before 6 AM
- Water tankers will be stationed at Block C and Block F
- Laundry and washing activities should be completed before 6 AM

## Contact

For any emergency, contact the hostel warden at ext. 2401 or email hostel@college.edu
    `,
    category: "Notices",
    author: authors[2],
    imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80",
    imageColor: "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
    publishedAt: "2026-04-08T08:00:00Z",
    timeAgo: "6d ago",
    likes: 92,
    comments: 34,
    isLiked: false,
    isSaved: false,
  },
  {
    id: "p8",
    slug: "placement-season-record-packages",
    title: "Placement Season 2026 Breaks Records — 94% Placement Rate",
    description:
      "This year's campus placement season has set a new benchmark with the highest-ever average package of ₹18.5 LPA and 94% placement rate.",
    content: `
## Record-Breaking Placement Season

The Training & Placement Cell is delighted to announce the conclusion of the 2025–26 campus placement season with outstanding results.

## Key Statistics

- **Placement Rate:** 94% (highest ever)
- **Total Companies:** 142
- **Highest Package:** ₹48 LPA (Google, 3 offers)
- **Average Package:** ₹18.5 LPA
- **Median Package:** ₹14.2 LPA

## Top Recruiters

| Company | Offers | Role |
|---|---|---|
| Google | 3 | SWE L3 |
| Microsoft | 7 | Software Engineer |
| Goldman Sachs | 5 | Technology Analyst |
| Infosys | 48 | Systems Engineer |

## What Changed

The introduction of a dedicated **Product Management** track and **Data Science** cluster brought in 22 new companies this year, significantly boosting the placement rate.

Congratulations to the Class of 2026!
    `,
    category: "Academic",
    author: authors[0],
    imageUrl: "https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800&q=80",
    imageColor: "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
    publishedAt: "2026-04-07T13:00:00Z",
    timeAgo: "1w ago",
    likes: 891,
    comments: 156,
    isLiked: true,
    isSaved: true,
  },
];

// ─── NOTIFICATIONS ──────────────────────────────────────────────────────────

export const notifications: Notification[] = [
  {
    id: "n1",
    type: "like",
    actor: "Priya Sharma",
    actorAvatar: "👩",
    message: "liked your post",
    postTitle: "Annual Tech Fest 2026",
    timeAgo: "5m ago",
    isRead: false,
  },
  {
    id: "n2",
    type: "comment",
    actor: "Rohan Mehta",
    actorAvatar: "🧑",
    message: "commented: \"This is amazing coverage! Worth sharing.\"",
    postTitle: "College Cricket Team Wins",
    timeAgo: "23m ago",
    isRead: false,
  },
  {
    id: "n3",
    type: "follow",
    actor: "Ananya Verma",
    actorAvatar: "👩‍🎓",
    message: "started following you",
    timeAgo: "1h ago",
    isRead: false,
  },
  {
    id: "n4",
    type: "alert",
    actor: "Admin",
    actorAvatar: "🔔",
    message: "Your post was featured in Today's Top Stories",
    postTitle: "Library Digital Resources",
    timeAgo: "2h ago",
    isRead: false,
  },
  {
    id: "n5",
    type: "mention",
    actor: "Dev Kapoor",
    actorAvatar: "🧑‍💻",
    message: "mentioned you in a comment",
    postTitle: "Placement Season 2026",
    timeAgo: "4h ago",
    isRead: true,
  },
  {
    id: "n6",
    type: "like",
    actor: "Kavya Reddy",
    actorAvatar: "👩",
    message: "and 24 others liked your post",
    postTitle: "Reverie 2026 Cultural Fest",
    timeAgo: "6h ago",
    isRead: true,
  },
  {
    id: "n7",
    type: "comment",
    actor: "Arjun Patel",
    actorAvatar: "🧑",
    message: "replied to your comment",
    postTitle: "Robotics Club Gold",
    timeAgo: "1d ago",
    isRead: true,
  },
  {
    id: "n8",
    type: "follow",
    actor: "Meha Shah",
    actorAvatar: "👩",
    message: "started following you",
    timeAgo: "2d ago",
    isRead: true,
  },
];

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

export const trendingTopics = [
  { tag: "#TechFest2026", posts: 1240 },
  { tag: "#PlacementSeason", posts: 892 },
  { tag: "#Reverie2026", posts: 764 },
  { tag: "#CricketWin", posts: 571 },
  { tag: "#ExamSchedule", posts: 433 },
];

export const announcements = [
  {
    id: "a1",
    text: "Admissions open for PG programs 2026–27",
    type: "info" as const,
    timeAgo: "1h ago",
  },
  {
    id: "a2",
    text: "Anti-ragging committee meeting: April 15, 3 PM",
    type: "alert" as const,
    timeAgo: "3h ago",
  },
  {
    id: "a3",
    text: "Scholarship applications close April 20",
    type: "warning" as const,
    timeAgo: "1d ago",
  },
];

export const getPostBySlug = (slug: string): Post | undefined =>
  posts.find((p) => p.slug === slug);

export const getPostsByCategory = (category: Category): Post[] =>
  posts.filter((p) => p.category === category);

export const getRelatedPosts = (post: Post, limit = 3): Post[] =>
  posts.filter((p) => p.id !== post.id && p.category === post.category).slice(0, limit);
