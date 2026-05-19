import { getProfileData } from '@/lib/actions';
import ProfileClient from './ProfileClient';

export const dynamic = 'force-dynamic';

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // ⚡ Promise Pipeline: kick off user profile details query concurrently on server, do not await!
  const profilePromise = getProfileData(id);

  return <ProfileClient id={id} profilePromise={profilePromise} />;
}
