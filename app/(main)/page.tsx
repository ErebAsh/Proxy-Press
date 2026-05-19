import HomeFeed from '@/app/components/Feed/HomeFeed';
import { getHomeFeedPostsOnly } from '@/lib/actions';
import { cookies } from 'next/headers';

export default async function HomePage() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('proxypress_session')?.value;
  
  // ⚡ PIPELINE: Start database fetch immediately on the server!
  // We do NOT use "await" here; we pass the unresolved Promise to the client.
  const postsPromise = getHomeFeedPostsOnly(userId, 10, 0);

  return (
    <div style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
      <HomeFeed initialPostsPromise={postsPromise} />
    </div>
  );
}
