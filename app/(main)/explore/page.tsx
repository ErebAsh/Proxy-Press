import ExploreClient from './ExploreClient';
import { getExploreDataAction, getCurrentUser, getFollowing } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function ExplorePage() {
  // ⚡ Promise Pipeline: kick off server data queries concurrently, do not await!
  const exploreDataPromise = getExploreDataAction().catch(err => {
    console.error("Explore page data fetch failure:", err);
    return null;
  });

  const currentUserPromise = getCurrentUser().catch(err => {
    console.error("Explore page user fetch failure:", err);
    return null;
  });

  const initialDataPromise = Promise.all([exploreDataPromise, currentUserPromise])
    .then(async ([data, user]) => {
      let followingIds: string[] = [];
      if (user) {
        try {
          const following = await getFollowing(user.id);
          followingIds = (following || []).map((u: any) => u.id);
        } catch (e) {
          console.error("Explore page following fetch failure:", e);
        }
      }
      return {
        trendingPosts: data?.trendingPosts || [],
        suggestedUsers: data?.suggestedUsers || [],
        currentUserId: user?.id || null,
        followingIds
      };
    })
    .catch(err => {
      console.error("Explore page pipelining failure:", err);
      return {
        trendingPosts: [],
        suggestedUsers: [],
        currentUserId: null,
        followingIds: []
      };
    });

  return <ExploreClient initialDataPromise={initialDataPromise} />;
}
