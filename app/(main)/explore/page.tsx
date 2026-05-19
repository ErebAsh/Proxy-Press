import ExploreClient from './ExploreClient';
import { getExploreDataAction, getCurrentUser } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default function ExplorePage() {
  // ⚡ Promise Pipeline: kick off queries on server instantly, preventing blocking HTML streaming!
  const exploreDataPromise = getExploreDataAction();
  const currentUserPromise = getCurrentUser();

  return (
    <ExploreClient
      exploreDataPromise={exploreDataPromise}
      currentUserPromise={currentUserPromise}
    />
  );
}
