import HomeFeed from '@/app/components/Feed/HomeFeed';
import LeftSidebar from '@/app/components/Sidebar/LeftSidebar';
import RightSidebar from '@/app/components/Sidebar/RightSidebar';
import MobileBottomNav from '@/app/components/Sidebar/MobileBottomNav';
import MobileHeader from '@/app/components/Sidebar/MobileHeader';

export default function HomePage() {
  return (
    <div className="app-shell">
      <MobileHeader />
      <LeftSidebar />
      <main className="main-content" id="main-content" style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
        <HomeFeed />
      </main>
      <RightSidebar />
      <MobileBottomNav />
    </div>
  );
}
