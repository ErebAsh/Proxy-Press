'use client';

import { usePathname } from 'next/navigation';

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isProfile = pathname.startsWith('/profile');
  const isCreate = pathname.startsWith('/create');
  const isExplore = pathname.startsWith('/explore');
  const isSettings = pathname.startsWith('/settings');

  const showCondensedLayout = isProfile || isCreate || isExplore || isSettings;

  return (
    <main 
      className={`main-content ${showCondensedLayout ? 'no-top-padding' : ''}`} 
      id="main-content"
    >
      {children}
    </main>
  );
}
