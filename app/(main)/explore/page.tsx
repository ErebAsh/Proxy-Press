import ExploreClient from './ExploreClient';
import { getExploreDataAction, getCurrentUser, getFollowing } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function ExplorePage() {
  let initialData = null;
  
  try {
    // Fetch data on the server in parallel
    const [data, user] = await Promise.all([
      getExploreDataAction(),
      getCurrentUser(),
    ]);
    
    let followingIds: string[] = [];
    if (user) {
      const following = await getFollowing(user.id);
      followingIds = following.map((u: any) => u.id);
    }
    
    initialData = {
      trendingPosts: data.trendingPosts || [],
      suggestedUsers: data.suggestedUsers || [],
      currentUserId: user?.id || null,
      followingIds
    };
  } catch (err) {
    console.error('Failed to fetch explore data on server:', err);
    // If it fails, initialData remains null and the client component 
    // will fallback to its own fetching (same as old behavior).
  }

  return <ExploreClient initialData={initialData} />;
}
