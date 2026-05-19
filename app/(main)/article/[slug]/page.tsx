import ArticleClient from './ArticleClient';
import { getPostDetail, getCurrentUser } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  // ⚡ Promise Pipeline: kick off details and user identity queries instantly on server, do not await!
  const postDetailPromise = getPostDetail(slug).catch(err => {
    console.error("Article details page pipelining failure:", err);
    return null;
  });
  const currentUserPromise = getCurrentUser().catch(err => {
    console.error("Current user pipelining failure in article:", err);
    return null;
  });

  return (
    <ArticleClient 
      id={slug} 
      postDetailPromise={postDetailPromise} 
      currentUserPromise={currentUserPromise} 
    />
  );
}
