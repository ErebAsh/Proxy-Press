'use client';

import { useState, use, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getPostBySlug as getMockPostBySlug, getRelatedPosts as getMockRelatedPosts, posts as mockPosts } from '@/lib/data';
import PostCard from '@/app/components/Feed/PostCard';
import { getPostDetail, togglePostLike, togglePostSave, addPostComment, toggleCommentLike as toggleCommentLikeAction, getCurrentUser } from '@/lib/actions';
import './article-detail.css';

const categoryColors: Record<string, string> = {
  Events: '#8B5CF6', Notices: '#F59E0B', Sports: '#10B981',
  Academic: '#2563EB', Clubs: '#EC4899', Exams: '#EF4444',
};

interface ArticleClientProps {
  id: string;
  postDetailPromise: Promise<any>;
  currentUserPromise: Promise<any>;
}

export default function ArticleClient({ id, postDetailPromise, currentUserPromise }: ArticleClientProps) {
  const router = useRouter();
  const [post, setPost] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [toast, setToast] = useState('');
  const [commentText, setCommentText] = useState('');
  const [activeReplyId, setActiveReplyId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [canComment, setCanComment] = useState(true);
  const [scrolledPastTitle, setScrolledPastTitle] = useState(false);
  const headlineRef = useRef<HTMLHeadingElement>(null);

  const staggerRelated = (freshRelated: any[]) => {
    if (!freshRelated || freshRelated.length === 0) return;
    setRelated(freshRelated);
  };

  // Track scroll to show/hide title in the sticky header
  useEffect(() => {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;

    const handleScroll = () => {
      if (headlineRef.current) {
        const rect = headlineRef.current.getBoundingClientRect();
        setScrolledPastTitle(rect.bottom < 60);
      }
    };

    mainContent.addEventListener('scroll', handleScroll, { passive: true });
    return () => mainContent.removeEventListener('scroll', handleScroll);
  }, [post]);

  useEffect(() => {
    async function loadPost() {
      try {
        const [data, user] = await Promise.all([
          postDetailPromise,
          currentUserPromise
        ]);
        
        setCurrentUser(user);
        const userId = user?.id || null;

        if (data && data.post) {
          // Adapt DB post to UI format
          const adaptedPost = {
            ...data.post,
            timeAgo: data.post.publishedAt ? formatTimeAgo(data.post.publishedAt) : 'Recently',
            author: {
              ...data.post.author,
              posts: data.post.author.postsCount,
              saved: data.post.author.savedCount,
            },
            isLiked: Array.isArray(data.post.likesList) && userId ? data.post.likesList.some((l: any) => l.userId === userId) : false,
            isSaved: Array.isArray(data.post.savedList) && userId ? data.post.savedList.some((s: any) => s.userId === userId) : false,
          };
          setPost(adaptedPost);
          setCanComment(data.canComment ?? true);
          
          if (data.related) {
            const adaptedRelated = data.related.map((rp: any) => ({
              ...rp,
              timeAgo: rp.publishedAt ? formatTimeAgo(rp.publishedAt) : 'Recently'
            }));
            staggerRelated(adaptedRelated);
          }

          if (data.post.commentsList) {
            const flatComments: any[] = [];
            data.post.commentsList.forEach((c: any) => {
              flatComments.push({
                id: c.id,
                author: c.user?.name || 'User',
                user: c.user,
                text: c.text,
                time: formatTimeAgo(c.createdAt),
                likes: c.likes?.length || 0,
                isLiked: userId ? c.likes?.some((l: any) => l.userId === userId) : false,
              });
              
              if (c.replies) {
                c.replies.forEach((r: any) => {
                  flatComments.push({
                    id: r.id,
                    author: r.user?.name || 'User',
                    user: r.user,
                    text: r.text,
                    time: formatTimeAgo(r.createdAt),
                    likes: r.likes?.length || 0,
                    isLiked: userId ? r.likes?.some((l: any) => l.userId === userId) : false,
                    parentId: c.id
                  });
                });
              }
            });
            setComments(flatComments);
          }
        } else {
          // Fallback to mock if absolutely necessary, but try to find in mock list
          const mock = getMockPostBySlug(id);
          if (mock) {
            setPost(mock);
            setRelated(getMockRelatedPosts(mock, 3));
          } else {
            setPost(mockPosts[0]);
            setRelated(getMockRelatedPosts(mockPosts[0], 3));
          }
        }
      } catch (err) {
        console.error('Failed to load article:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPost();
  }, [id, postDetailPromise, currentUserPromise]);

  useEffect(() => {
    if (post) {
      setLiked(post.isLiked ?? false);
      setSaved(post.isSaved ?? false);
      setLikeCount(post.likes ?? 0);
    }
  }, [post]);

  if (isLoading) {
    return (
      <div className="feed-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', marginBottom: '16px' }} />
        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Loading article...</p>
      </div>
    );
  }

  if (!post) return null;

  const catColor = categoryColors[post.category] ?? 'var(--primary)';

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    if (!currentUser) {
      alert('You must be logged in to comment');
      return;
    }
    
    const result = await addPostComment({
      postId: post.id,
      userId: currentUser.id,
      text: commentText,
    });

    if (result.success) {
      const newComment = {
        id: result.id,
        author: currentUser.name || 'User',
        text: commentText,
        time: 'Just now',
        likes: 0,
        isLiked: false
      };
      setComments([newComment, ...comments]);
      setCommentText('');
      setToast('Comment posted!');
      setTimeout(() => setToast(''), 3000);
    }
  };

  const toggleCommentLike = async (id: string) => {
    if (!currentUser) {
      alert('You must be logged in to like comments');
      return;
    }
    const result = await toggleCommentLikeAction(id, currentUser.id);
    if (result.success) {
      setComments(comments.map(c => {
        if (c.id === id) {
          return { ...c, isLiked: !c.isLiked, likes: c.isLiked ? c.likes - 1 : c.likes + 1 };
        }
        return c;
      }));
    }
  };

  const handleReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    if (!currentUser) {
      alert('You must be logged in to reply');
      return;
    }
    
    const result = await addPostComment({
      postId: post.id,
      userId: currentUser.id,
      text: replyText,
      parentId: parentId,
    });

    if (result.success) {
      const newReply = {
        id: result.id,
        author: currentUser.name || 'User',
        text: replyText,
        time: 'Just now',
        likes: 0,
        isLiked: false,
        parentId: parentId
      };
      setComments([...comments, newReply]);
      setReplyText('');
      setActiveReplyId(null);
      setToast('Reply posted!');
      setTimeout(() => setToast(''), 3000);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: post.title,
      text: `Check out this news: ${post.title}`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setToast('Link copied to clipboard!');
        setTimeout(() => setToast(''), 3000);
      } else {
        setToast('Sharing is restricted by your browser.');
        setTimeout(() => setToast(''), 3000);
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
    setShowMenu(false);
  };

  const handleToggleLike = async () => {
    if (!currentUser) {
      alert('You must be logged in to like posts');
      return;
    }
    const result = await togglePostLike(post.id, currentUser.id);
    if (result.success) {
      setLiked(!liked);
      setLikeCount(prev => liked ? prev - 1 : prev + 1);
    }
  };

  const handleSave = async () => {
    if (!currentUser) {
      alert('You must be logged in to save posts');
      return;
    }
    // Optimistic UI
    const newSaved = !saved;
    setSaved(newSaved);

    try {
      await togglePostSave(post.id, currentUser.id);
    } catch (err) {
      console.error('Failed to toggle save:', err);
      // Rollback on error
      setSaved(!newSaved);
    }
    setShowMenu(false);
  };

  const paragraphs = (post.content || '')
    .split('\n')
    .map((l: string) => l.trim())
    .filter(Boolean);

  return (
    <div className="feed-container animate-fade-in" style={{ maxWidth: '720px' }} id="article-page">

      {/* ── Fixed Article Header ── */}
      <div className={`article-detail-header ${scrolledPastTitle ? 'article-detail-header--scrolled' : ''}`}>
        <div className="article-detail-header__inner">
          <button
            className="article-detail-header__back"
            onClick={() => router.back()}
            aria-label="Go back"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="article-detail-header__center">
            <span
              className={`article-detail-header__title ${scrolledPastTitle ? 'article-detail-header__title--visible' : ''}`}
            >
              {post.title}
            </span>

          </div>

          <div className="article-detail-header__actions">
            <button
              className={`article-detail-header__action-btn ${liked ? 'article-detail-header__action-btn--active' : ''}`}
              onClick={handleToggleLike}
              aria-label="Like"
              style={{ color: liked ? catColor : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
            <button
              className={`article-detail-header__action-btn ${saved ? 'article-detail-header__action-btn--active' : ''}`}
              onClick={handleSave}
              aria-label="Save"
              style={{ color: saved ? catColor : undefined }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
            <button
              className="article-detail-header__action-btn"
              onClick={handleShare}
              aria-label="Share"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Headline */}
      <h1 ref={headlineRef} style={{
        fontSize: '32px', fontWeight: 900, lineHeight: 1.2,
        color: 'var(--text-primary)', marginBottom: '16px', letterSpacing: '-0.5px',
        padding: '0 8px',
      }}>
        {post.title}
      </h1>
      {/* Author + meta */}
      <Link 
        href={`/profile/${post.authorId}`}
        style={{ 
          display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px',
          textDecoration: 'none', color: 'inherit'
        }}
      >
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'var(--surface-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '18px', flexShrink: 0,
          overflow: 'hidden',
        }}>
          {(() => {
            const user = post.author as any;
            const picUrl = user.profilePicture || user.image;
            if (picUrl && (picUrl.startsWith('http') || picUrl.startsWith('/') || picUrl.startsWith('data:'))) {
              return <img src={picUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
            }
            const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&color=fff`;
            return <img src={avatarUrl} alt={user.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
          })()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
            {post.author.name}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {post.author.college} · {post.timeAgo}
          </div>
        </div>
      </Link>

      {/* Hero image/video */}
      <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: '32px' }}>
        {(() => {
          const videoUrl = post.videoUrl || (post.imageUrl?.match(/\.(mp4|webm|mov|ogg)$|^data:video/i) ? post.imageUrl : null);
          if (videoUrl) {
            return (
              <video
                src={videoUrl}
                poster={post.imageUrl}
                className="article-hero"
                style={{ margin: 0, borderRadius: 0, width: '100%', height: 'auto', display: 'block' }}
                autoPlay
                loop
                playsInline
                controlsList="nodownload noplaybackrate nofullscreen"
                disablePictureInPicture
              />

            );
          }
          return (
            <img
              src={post.imageUrl}
              alt={post.title}
              className="article-hero"
              style={{ margin: 0, borderRadius: 0, width: '100%', height: 'auto', display: 'block' }}
              onError={e => {
                const t = e.currentTarget as HTMLImageElement;
                t.style.display = 'none';
                const fb = t.nextElementSibling as HTMLElement | null;
                if (fb) fb.style.display = 'flex';
              }}
            />
          );
        })()}
        <div style={{
          display: 'none', width: '100%', height: '420px',
          background: post.imageColor, alignItems: 'center',
          justifyContent: 'center', fontSize: '80px',
        }}>
          🖼️
        </div>
      </div>


      {/* Article body */}
      <div className="article-body" id="article-body" style={{ padding: '0 8px' }}>
        {paragraphs.map((para: string, i: number) => {
          if (para.startsWith('## ')) {
            return <h2 key={i}>{para.replace('## ', '')}</h2>;
          }
          if (para.startsWith('**') && para.endsWith('**')) {
            return <p key={i}><strong>{para.slice(2, -2)}</strong></p>;
          }
          if (para.startsWith('- ')) {
            return <p key={i}>{'•  ' + para.slice(2)}</p>;
          }
          if (para.startsWith('|')) {
            // Skip table rows (simplified)
            return null;
          }
          return <p key={i}>{para}</p>;
        })}
      </div>

      {/* Engagement Stats */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '16px 8px', margin: '24px 0 0',
        borderTop: '1px solid var(--border)',
        color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: liked ? catColor : 'var(--text-muted)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          {likeCount} likes
        </span>
        <span>·</span>
        <span>{post.comments} comments</span>
      </div>

      {/* Comments Section */}
      <section id="comments-section" style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
            Comments ({post.comments})
          </h2>
        </div>
        
        {/* Comment Input */}
        {canComment ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '32px' }}>
            <textarea 
              placeholder="Add a comment..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              style={{
                flex: 1,
                minHeight: '44px', padding: '12px 16px',
                background: 'var(--surface-1)', color: 'var(--text-primary)',
                border: '1px solid var(--border)', borderRadius: '22px',
                outline: 'none', resize: 'none',
                fontSize: '15px', fontFamily: 'inherit',
                lineHeight: '20px'
              }}
            />
            <button 
              className="btn" 
              onClick={handlePostComment}
              disabled={!commentText.trim()}
              style={{ 
                height: '44px', padding: '0 20px', fontSize: '14px', 
                background: commentText.trim() ? catColor : 'rgba(255,255,255,0.08)', 
                color: commentText.trim() ? 'white' : 'var(--text-muted)', 
                border: 'none', borderRadius: '22px', 
                fontWeight: 700, cursor: commentText.trim() ? 'pointer' : 'default', flexShrink: 0,
                opacity: 1,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: commentText.trim() ? `0 4px 12px ${catColor}40` : 'none'
              }}
            >
              Post
            </button>
          </div>
        ) : (
          <div style={{ 
            padding: '20px', textAlign: 'center', background: 'var(--surface-2)', 
            borderRadius: '16px', border: '1px solid var(--border)', marginBottom: '32px' 
          }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>
               {post.author.commentPrivacy === 'No One' 
                 ? 'Comments are disabled for this post.' 
                 : 'Only people followed by the author can comment.'}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          {comments.filter(c => !c.parentId).map((c) => {
            const threadReplies = comments.filter(r => r.parentId === c.id).map(r => ({ type: 'reply' as const, data: r }));
            const hasInput = activeReplyId === c.id;
            const threadItems = [...threadReplies, ...(hasInput ? [{ type: 'input' as const }] : [])];

            return (
              <div key={c.id} style={{ display: 'flex', flexDirection: 'column', animation: 'fade-in 0.4s ease' }}>
                
                {/* Parent Row */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  {/* Left Column: Avatar & Continuous Thread Line */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '36px' }}>
                    <div style={{ 
                      width: '36px', height: '36px', borderRadius: '50%', 
                      background: `linear-gradient(135deg, ${catColor}40, ${catColor}10)`, 
                      border: `1px solid ${catColor}50`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '16px', zIndex: 2,
                      overflow: 'hidden',
                    }}>
                      {(() => {
                        const u = c.user as any;
                        const picUrl = u?.profilePicture || u?.image;
                        if (picUrl && (picUrl.startsWith('http') || picUrl.startsWith('/') || picUrl.startsWith('data:'))) {
                          return <img src={picUrl} alt={c.author} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                        }
                        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.author)}&background=random&color=fff`;
                        return <img src={avatarUrl} alt={c.author} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                      })()}
                    </div>
                    {/* Stretches exactly to the bottom of the parent content padding */}
                    {threadItems.length > 0 && (
                      <div style={{ width: '1.5px', flex: 1, background: 'rgba(255,255,255,0.12)', marginTop: '8px' }} />
                    )}
                  </div>
                  
                  {/* Right Column: Main Content */}
                  <div style={{ flex: 1, paddingBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{c.author}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.time}</span>
                    </div>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                      {c.text}
                    </p>
                    <div style={{ display: 'flex', gap: '16px', marginTop: '10px', alignItems: 'center' }}>
                      <button 
                        onClick={() => {
                          setActiveReplyId(activeReplyId === c.id ? null : c.id);
                          setReplyText(`@${c.author.replace(' ', '')} `);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0 }}
                      >
                        Reply
                      </button>
                      <button 
                        onClick={() => toggleCommentLike(c.id)}
                        style={{ 
                          background: 'none', border: 'none', 
                          color: c.isLiked ? catColor : 'var(--text-muted)', 
                          fontSize: '12px', fontWeight: 700, 
                          cursor: 'pointer', padding: 0,
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        {c.isLiked ? '❤️' : '🤍'} {c.likes > 0 && c.likes}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Replies Thread Container (only outer margin-left) */}
                {threadItems.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '17.25px', gap: '0' }}>
                    {threadItems.map((item, index) => {
                      const isLast = index === threadItems.length - 1;
                      return (
                        <div key={item.type === 'reply' ? item.data.id : 'input'} style={{ position: 'relative', display: 'flex', paddingBottom: isLast ? '0' : '20px' }}>
                          
                          {/* Continuous Vertical Line Segment (skip on last item) */}
                          {!isLast && (
                             <div style={{ position: 'absolute', top: '20px', left: 0, bottom: 0, width: '1.5px', background: 'rgba(255,255,255,0.12)', zIndex: 0 }} />
                          )}
                          
                          {/* Curved Connector for THIS specific item */}
                          <div style={{
                             position: 'absolute',
                             top: 0, left: 0, 
                             width: '28px', height: '20px', // curve goes down 20px, then right 28px
                             borderLeft: '1.5px solid rgba(255,255,255,0.12)',
                             borderBottom: '1.5px solid rgba(255,255,255,0.12)',
                             borderBottomLeftRadius: '14px',
                             zIndex: 0
                          }} />
                          
                          {/* Content Wrapper for Reply */}
                          <div style={{ display: 'flex', gap: '10px', paddingLeft: '38px', paddingTop: '6px', width: '100%', position: 'relative', zIndex: 2, animation: 'fade-in 0.3s ease' }}>
                            {item.type === 'reply' ? (
                              <>
                                <div style={{ 
                                  width: '28px', height: '28px', borderRadius: '50%', 
                                  background: 'var(--surface-3)', border: '1px solid var(--border)',
                                  flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '12px', overflow: 'hidden'
                                }}>
                                  {(() => {
                                    const u = item.data.user as any;
                                    const picUrl = u?.profilePicture || u?.image;
                                    if (picUrl && (picUrl.startsWith('http') || picUrl.startsWith('/') || picUrl.startsWith('data:'))) {
                                      return <img src={picUrl} alt={item.data.author} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                                    }
                                    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.data.author)}&background=random&color=fff`;
                                    return <img src={avatarUrl} alt={item.data.author} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
                                  })()}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{item.data.author}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.data.time}</span>
                                  </div>
                                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                                    {item.data.text}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'flex-start' }}>
                                <textarea
                                  autoFocus
                                  placeholder="Write your reply..."
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  style={{
                                    flex: 1, minHeight: '44px', padding: '12px 16px',
                                    background: 'var(--surface-1)', color: 'var(--text-primary)',
                                    border: '1px solid var(--border)', borderRadius: '20px',
                                    outline: 'none', resize: 'none', fontSize: '14px',
                                    fontFamily: 'inherit', lineHeight: '20px'
                                  }}
                                />
                                <button 
                                  onClick={() => handleReply(c.id)}
                                  disabled={!replyText.trim()}
                                  style={{
                                    height: '44px', padding: '0 18px', borderRadius: '22px', 
                                    background: replyText.trim() ? catColor : 'var(--surface-3)',
                                    color: 'white', border: 'none', fontSize: '13px', fontWeight: 700, 
                                    cursor: replyText.trim() ? 'pointer' : 'default', transition: 'all 0.2s'
                                  }}
                                >
                                  Reply
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Related posts */}
      {related.length > 0 && (
        <section id="related-posts" style={{ marginTop: '40px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '20px', letterSpacing: '-0.3px' }}>
            Related Posts
          </h2>
          {related.map((rp, idx) => (
            <PostCard key={rp.id} post={rp} index={idx} />
          ))}
        </section>
      )}

      {related.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-subtle)' }}>
          <p>No related posts found in {post.category}.</p>
          <Link href="/explore" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '14px' }}>
            Explore all posts →
          </Link>
        </div>
      )}
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--primary)', color: 'white', padding: '12px 24px',
          borderRadius: '100px', fontSize: '14px', fontWeight: 600,
          boxShadow: '0 8px 20px rgba(0,0,0,0.3)', zIndex: 1000,
          animation: 'fade-in 0.2s ease-out'
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (isNaN(date.getTime())) return 'Recently';
  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
