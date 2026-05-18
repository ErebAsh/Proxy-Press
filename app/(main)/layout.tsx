import LeftSidebar from '@/app/components/Sidebar/LeftSidebar';
import RightSidebar from '@/app/components/Sidebar/RightSidebar';
import MobileBottomNav from '@/app/components/Sidebar/MobileBottomNav';
import MobileHeader from '@/app/components/Sidebar/MobileHeader';
import MainContent from '@/app/components/Layout/MainContent';

import { Suspense } from 'react';
import UserActivityRecorder from '@/app/components/UserActivityRecorder';

export const dynamic = 'force-dynamic';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <UserActivityRecorder />
      <Suspense fallback={null}>
        <MobileHeader />
      </Suspense>

      <LeftSidebar />
      <MainContent>
        {children}
      </MainContent>
      <RightSidebar />
      <Suspense fallback={null}>
        <MobileBottomNav />
      </Suspense>
    </div>
  );
}
