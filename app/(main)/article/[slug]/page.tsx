'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { getPostBySlug, getRelatedPosts, posts } from '@/lib/data';
import PostCard from '@/app/components/Feed/PostCard';

const categoryColors: Record<string, string> = {
  Events: '#8B5CF6', Notices: '#F59E0B', Sports: '#10B981',
  Academic: '#2563EB', Clubs: '#EC4899', Exams: '#EF4444',
};

export default function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params);
  const post = getPostBySlug(resolvedParams.slug) ?? posts[0];
  const related = getRelatedPosts(post, 3);
  const catColor = categoryColors[post.category] ?? 'var(--primary)';
  const [showMenu, setShowMenu] = useState(false);
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [toast, setToast] = useState('');
  const [commentText, setCommentText] = useState('');
  const [activeReplyId, setActiveReplyId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [comments, setComments] = useState<{
    id: number, author: string, text: string, time: string, likes: number, isLiked: boolean, parentId?: number
  }[]>([
    { id: 1, author: 'Student #142', text: 'Great coverage! The campus atmosphere is really captured here.', time: '2h ago', likes: 12, isLiked: false },
    { id: 2, author: 'Faculty Member', text: 'Excellent details on the schedule changes. Very helpful.', time: '5h ago', likes: 24, isLiked: true }
  ]);

  const handlePostComment = () => {
    if (!commentText.trim()) return;
    const newComment = {
      id: Date.now(),
      author: 'Alex Johnson',
      text: commentText,
      time: 'Just now',
      likes: 0,
      isLiked: false
    };
    setComments([newComment, ...comments]);
    setCommentText('');
    setToast('Comment posted!');
    setTimeout(() => setToast(''), 3000);
  };

  const toggleCommentLike = (id: number) => {
    setComments(comments.map(c => {
      if (c.id === id) {
        return { ...c, isLiked: !c.isLiked, likes: c.isLiked ? c.likes - 1 : c.likes + 1 };
      }
      return c;
    }));
  };

  const handleReply = (parentId: number) => {
    if (!replyText.trim()) return;
    const newReply = {
      id: Date.now(),
      author: 'Alex Johnson',
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

  const paragraphs = post.content
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  return (
    <div className="feed-container animate-fade-in" style={{ maxWidth: '720px' }} id="article-page">

      {/* Category pill */}
      <span style={{
        display: 'inline-block', padding: '4px 14px', borderRadius: 'var(--radius-full)',
        fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em',
        background: `${catColor}18`, color: catColor, marginBottom: '16px',
      }}>
        {post.category}
      </span>

      {/* Headline */}
      <h1 style={{
        fontSize: '32px', fontWeight: 900, lineHeight: 1.2,
        color: 'var(--text-primary)', marginBottom: '16px', letterSpacing: '-0.5px',
      }}>
        {post.title}
      </h1>
      {/* Author + meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%',
          background: `linear-gradient(135deg, ${catColor}, ${catColor}88)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '20px', flexShrink: 0,
        }}>
          {post.author.avatar}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>
            {post.author.name}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {post.author.college} · {post.timeAgo}
          </div>
        </div>

        {/* More Actions Menu */}
        <div style={{ position: 'relative' }}>
          <button 
            style={{ 
              background: 'none', border: 'none', padding: '8px',
              color: 'var(--text-primary)', fontSize: '22px', 
              cursor: 'pointer', display: 'flex', alignItems: 'center'
            }}
            onClick={() => setShowMenu(!showMenu)}
          >
            ⋮
          </button>

          {showMenu && (
            <>
              <div 
                style={{ position: 'fixed', inset: 0, zIndex: 100 }} 
                onClick={() => setShowMenu(false)}
              />
              <div style={{
                position: 'absolute', top: '48px', right: '0',
                width: '190px', background: 'rgba(23, 23, 23, 0.9)',
                backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                padding: '8px', zIndex: 101,
                animation: 'fade-in 0.2s ease-out'
              }}>
                <Link href="/profile" style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px', borderRadius: '12px', color: 'var(--text-primary)',
                  fontSize: '14px', textDecoration: 'none', transition: 'all 0.2s'
                }}>
                  <span style={{ color: catColor, fontSize: '18px' }}>👤</span> Visit Profile
                </Link>
                <div 
                  onClick={handleShare}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px', borderRadius: '12px', color: 'var(--text-primary)',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  <span style={{ color: catColor, fontSize: '18px' }}>📤</span> Share News
                </div>
                <div 
                  onClick={() => {
                    setSaved(!saved);
                    setShowMenu(false);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px', borderRadius: '12px', 
                    color: saved ? catColor : 'var(--text-primary)',
                    fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
                    background: saved ? `${catColor}15` : 'transparent'
                  }}
                >
                  <span style={{ color: catColor, fontSize: '18px' }}>{saved ? '⭐' : '🔖'}</span> 
                  {saved ? 'Saved' : 'Save News'}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Hero image */}
      <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: '32px' }}>
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
        <div style={{
          display: 'none', width: '100%', height: '420px',
          background: post.imageColor, alignItems: 'center',
          justifyContent: 'center', fontSize: '80px',
        }}>
          🖼️
        </div>
      </div>

      {/* Article body */}
      <div className="article-body" id="article-body">
        {paragraphs.map((para, i) => {
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
      
      {/* Like Row */}
      <div style={{ display: 'flex', justifyContent: 'center', margin: '32px 0 16px' }}>
        <button
          onClick={() => { setLiked(!liked); setLikeCount(prev => liked ? prev - 1 : prev + 1); }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 18px', borderRadius: '100px',
            background: liked ? `${catColor}15` : 'rgba(255,255,255,0.03)',
            border: `1px solid ${liked ? catColor : 'rgba(255,255,255,0.1)'}`,
            color: liked ? catColor : 'var(--text-secondary)',
            fontSize: '14px', fontWeight: 600, cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <span style={{ letterSpacing: '0.01em' }}>{likeCount} likes</span>
        </button>
      </div>

      {/* Comments Section */}
      <section id="comments-section" style={{ marginTop: '32px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
            Comments ({post.comments})
          </h2>
        </div>
        
        {/* Comment Input */}
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
                      fontSize: '16px', zIndex: 2
                    }}>
                      🎓
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
                                  fontSize: '12px'
                                }}>
                                  👤
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
