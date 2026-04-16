import LeftSidebar from '@/app/components/Sidebar/LeftSidebar';
import RightSidebar from '@/app/components/Sidebar/RightSidebar';
import MobileBottomNav from '@/app/components/Sidebar/MobileBottomNav';
import MobileHeader from '@/app/components/Sidebar/MobileHeader';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <MobileHeader />
      <LeftSidebar />
      <main className="main-content" id="main-content">
        {children}
      </main>
      <RightSidebar />
      <MobileBottomNav />
    </div>
  );
}
