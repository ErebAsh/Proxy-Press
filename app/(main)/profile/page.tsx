import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/actions';

export default async function ProfileRedirectPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect('/login');
  }

  // Redirect to the dynamic user profile page using the user's ID
  redirect(`/profile/${user.id}`);
}
