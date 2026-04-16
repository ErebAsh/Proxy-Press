import LeftSidebar from '@/app/components/Sidebar/LeftSidebar';
import RightSidebar from '@/app/components/Sidebar/RightSidebar';
import MobileBottomNav from '@/app/components/Sidebar/MobileBottomNav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <LeftSidebar />
      <main className="main-content" id="main-content">
        {children}
      </main>
      <RightSidebar />
      <MobileBottomNav />
    </div>
  );
}
