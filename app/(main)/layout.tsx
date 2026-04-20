import LeftSidebar from '@/app/components/Sidebar/LeftSidebar';
import RightSidebar from '@/app/components/Sidebar/RightSidebar';
import MobileBottomNav from '@/app/components/Sidebar/MobileBottomNav';
import MobileHeader from '@/app/components/Sidebar/MobileHeader';
import MainContent from '@/app/components/Layout/MainContent';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <MobileHeader />
      <LeftSidebar />
      <MainContent>
        {children}
      </MainContent>
      <RightSidebar />
      <MobileBottomNav />
    </div>
  );
}
