import HomeFeed from '@/app/components/Feed/HomeFeed';

export default function HomePage() {
  return (
    <div style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom))' }}>
      <HomeFeed />
    </div>
  );
}
