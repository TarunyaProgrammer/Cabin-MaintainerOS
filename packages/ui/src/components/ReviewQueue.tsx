import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  GitPullRequest, 
  ExternalLink, 
  RefreshCw,
  AlertTriangle,
  Play,
  CheckCircle,
  XCircle,
  HelpCircle,
  Cpu,
  Layers,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  FolderGit2
} from 'lucide-react';
import { useCabinStore } from '../store';
import { PullRequest, CheckStatus } from '@cabin/shared';

type GroupBy = 'none' | 'repo';
type SortBy = 'newest' | 'oldest' | 'alpha';

const sortReviews = (reviews: PullRequest[], sortBy: SortBy): PullRequest[] => {
  return [...reviews].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime();
      case 'oldest':
        return new Date(a.requestedDate).getTime() - new Date(b.requestedDate).getTime();
      case 'alpha':
        return a.title.localeCompare(b.title);
      default:
        return 0;
    }
  });
};

const groupReviewsByRepo = (reviews: PullRequest[]): Map<string, PullRequest[]> => {
  const groups = new Map<string, PullRequest[]>();
  for (const pr of reviews) {
    const key = pr.repositoryId;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(pr);
  }
  return groups;
};

export const ReviewQueue: React.FC = () => {
  const navigate = useNavigate();
  const { 
    reviews, 
    loadingReviews, 
    fetchReviews, 
    settings, 
    setActiveReviewPR,
    resolveReviewLocally
  } = useCabinStore();

  const [groupBy, setGroupBy] = useState<GroupBy>('repo');
  const [sortBy, setSortBy] = useState<SortBy>('newest');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [resolvePr, setResolvePr] = useState<PullRequest | null>(null);
  const [resolveComment, setResolveComment] = useState('');

  useEffect(() => {
    if (settings.githubToken) {
      fetchReviews();
    }
  }, [settings.githubToken]);

  const handlePrepareReview = (pr: PullRequest) => {
    setActiveReviewPR(pr);
    navigate(`/review/${pr.prNumber}`);
  };

  const openOnGitHub = (e: React.MouseEvent, owner: string, repo: string, number: number) => {
    e.stopPropagation();
    const url = `https://github.com/${owner}/${repo}/pull/${number}`;
    window.electronAPI.openExternal(url);
  };
  const handleResolveLocallyClick = (e: React.MouseEvent, pr: PullRequest) => {
    e.stopPropagation();
    setResolvePr(pr);
    setResolveComment('');
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvePr) return;
    try {
      await resolveReviewLocally(
        resolvePr.repoOwner,
        resolvePr.repoName,
        resolvePr.prNumber,
        resolveComment
      );
      setResolvePr(null);
    } catch (err) {
      console.error(err);
    }
  };
  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Filter out pull requests that have already been reviewed (reviewStatus !== 'pending')
  const pendingReviews = useMemo(() => reviews.filter(pr => pr.reviewStatus === 'pending'), [reviews]);
  const sortedReviews = useMemo(() => sortReviews(pendingReviews, sortBy), [pendingReviews, sortBy]);
  const groupedReviews = useMemo(() => {
    if (groupBy === 'repo') {
      const groups = groupReviewsByRepo(sortedReviews);
      for (const [key, prs] of groups) {
        groups.set(key, sortReviews(prs, sortBy));
      }
      return groups;
    }
    return null;
  }, [sortedReviews, groupBy, sortBy]);

  // Helper to render check status badges
  const renderStatusBadge = (status: CheckStatus, label: string) => {
    const baseClass = "flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[9px] font-bold border uppercase tracking-wider";
    switch (status) {
      case 'passed':
        return (
          <span className={`${baseClass} bg-emerald-50 border-emerald-200 text-emerald-700`}>
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
          </span>
        );
      case 'failed':
        return (
          <span className={`${baseClass} bg-rose-50 border-rose-200 text-rose-700`}>
            <XCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
          </span>
        );
      case 'pending':
        return (
          <span className={`${baseClass} bg-amber-50 border-amber-200 text-amber-700`}>
            <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
            <span>{label}</span>
          </span>
        );
      default:
        return (
          <span className={`${baseClass} bg-zinc-100 border-zinc-200 text-zinc-500`}>
            <HelpCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{label}</span>
          </span>
        );
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  const renderPRCard = (pr: PullRequest) => (
    <motion.div 
      key={pr.id} 
      variants={itemVariants}
      onClick={() => handlePrepareReview(pr)}
      className="ui-card p-5 cursor-pointer hover:border-zinc-300 active:scale-[0.99] transition-all"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Column: Info & Details */}
        <div className="space-y-2 flex-1 min-w-0">
          <div className="flex items-center gap-2 select-none text-[11px] font-semibold text-zinc-400">
            <span>{pr.repositoryId}</span>
            <span>•</span>
            <span className="font-mono">#{pr.prNumber}</span>
          </div>
          
          <h3 className="text-sm font-bold text-zinc-800 line-clamp-2 hover:text-zinc-900 transition-colors">{pr.title}</h3>
          
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500 select-none">
            <div className="flex items-center gap-1.5 bg-zinc-50 px-2 py-0.5 rounded-lg border border-zinc-200">
              {pr.authorAvatarUrl ? (
                <img src={pr.authorAvatarUrl} alt="" className="h-5 w-5 rounded-full border border-zinc-200 shrink-0" />
              ) : (
                <div className="h-5 w-5 rounded-full bg-zinc-200 shrink-0" />
              )}
              <span className="font-bold text-zinc-600">@{pr.author}</span>
            </div>
            <span>•</span>
            <span>Requested: {new Date(pr.requestedDate).toLocaleDateString()}</span>
            
            {pr.labels.length > 0 && (
              <>
                <span>•</span>
                <div className="flex items-center gap-1">
                  {pr.labels.slice(0, 3).map(label => (
                    <span key={label} className="bg-zinc-50 text-zinc-500 px-2 py-0.5 rounded-md text-[9px] font-semibold border border-zinc-200">
                      {label}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Column: Check Badges & Trigger */}
        <div className="flex items-center gap-4 select-none shrink-0 justify-between md:justify-end border-t md:border-t-0 md:border-l border-zinc-200 pt-3 md:pt-0 md:pl-5">
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5">
              {renderStatusBadge(pr.ciStatus, 'CI')}
              {renderStatusBadge(pr.mergeConflictStatus, 'Mergeable')}
            </div>
            
            <div className="flex items-center gap-1 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-0.5 text-[9px] font-mono text-zinc-500 uppercase">
              <Cpu className="h-3 w-3 text-indigo-500 shrink-0" />
              <span>AI: {pr.aiStatus}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => openOnGitHub(e, pr.repoOwner, pr.repoName, pr.prNumber)}
              className="p-2 text-zinc-500 hover:text-zinc-800 rounded-xl hover:bg-zinc-50 border border-zinc-200 transition-colors"
              title="Open on GitHub"
            >
              <ExternalLink className="h-4 w-4" />
            </button>
            
            <button 
              onClick={(e) => handleResolveLocallyClick(e, pr)}
              className="p-2 text-indigo-650 hover:text-indigo-850 hover:bg-indigo-50 border border-indigo-200 rounded-xl transition-colors"
              title="Mark Resolved Locally"
            >
              <CheckCircle className="h-4 w-4 text-indigo-500" />
            </button>

            <button 
              onClick={() => handlePrepareReview(pr)}
              className="ui-button-primary flex items-center gap-1.5 px-4 py-2 text-xs font-bold"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              <span>Review</span>
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header section */}
      <div className="flex justify-between items-center select-none pl-1">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 flex items-center gap-2">
            <GitPullRequest className="h-5 w-5 text-zinc-500" />
            Review Queue
          </h1>
          <p className="text-xs text-zinc-500">Manage incoming pull requests and initiate local AI review pipeline.</p>
        </div>
        
        {settings.githubToken && (
          <button 
            disabled={loadingReviews}
            onClick={() => fetchReviews(true)}
            className="ui-button-secondary flex items-center gap-2 px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingReviews ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {!settings.githubToken ? (
        <div className="ui-card p-12 text-center space-y-4 max-w-lg mx-auto">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-zinc-800">GitHub Access Token Required</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Please navigate to Settings to provide a GitHub Personal Access Token. This enables Cabin to sync your review queue.
          </p>
          <button 
            onClick={() => navigate('/settings')}
            className="ui-button-primary px-5 py-2.5 text-xs font-bold"
          >
            Configure Settings
          </button>
        </div>
      ) : loadingReviews ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-white border border-appBorder animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : pendingReviews.length === 0 ? (
        <div className="ui-card p-12 text-center space-y-3 max-w-lg mx-auto">
          <GitPullRequest className="h-10 w-10 text-zinc-400 mx-auto" />
          <h3 className="text-base font-bold text-zinc-800">Review Queue Empty</h3>
          <p className="text-xs text-zinc-500 italic">
            You don't have any pending review requests assigned to you right now. Outstanding!
          </p>
        </div>
      ) : (
        <>
          {/* Grouping & Sorting Toolbar */}
          <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-2xl px-4 py-2.5 select-none">
            <div className="flex items-center gap-4">
              {/* Group By */}
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Group</span>
                <select
                  value={groupBy}
                  onChange={(e) => {
                    setGroupBy(e.target.value as GroupBy);
                    setCollapsedGroups(new Set());
                  }}
                  className="text-xs font-semibold text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:border-zinc-300 transition-colors"
                >
                  <option value="none">None (Flat List)</option>
                  <option value="repo">By Repository</option>
                </select>
              </div>

              {/* Sort By */}
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5 text-zinc-400" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Sort</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="text-xs font-semibold text-zinc-700 bg-zinc-50 border border-zinc-200 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:border-zinc-300 transition-colors"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="alpha">Alphabetical</option>
                </select>
              </div>
            </div>

            <div className="text-[10px] font-mono text-zinc-400">
              {pendingReviews.length} review{pendingReviews.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Render: Grouped or Flat */}
          {groupBy === 'repo' && groupedReviews ? (
            <div className="space-y-5">
              {Array.from(groupedReviews.entries()).map(([repoId, prs]) => {
                const isCollapsed = collapsedGroups.has(repoId);
                return (
                  <div key={repoId} className="space-y-3">
                    {/* Group Header */}
                    <button
                      onClick={() => toggleGroupCollapse(repoId)}
                      className="flex items-center gap-2.5 w-full text-left px-2 py-1.5 rounded-xl hover:bg-zinc-50 transition-colors group"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-zinc-400 group-hover:text-zinc-600 transition-colors" />
                      )}
                      <FolderGit2 className="h-4 w-4 text-indigo-500" />
                      <span className="text-xs font-bold text-zinc-700">{repoId}</span>
                      <span className="text-[10px] font-mono text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200">
                        {prs.length} PR{prs.length !== 1 ? 's' : ''}
                      </span>
                    </button>

                    {/* Group Content */}
                    {!isCollapsed && (
                      <motion.div
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                        className="space-y-3 pl-2 border-l-2 border-zinc-200 ml-2"
                      >
                        {prs.map(renderPRCard)}
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="show"
              className="space-y-4"
            >
              {sortedReviews.map(renderPRCard)}
            </motion.div>
          )}
        </>
      )}

      {/* Resolve Locally Modal */}
      {resolvePr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="ui-card w-[550px] p-6 flex flex-col space-y-4 animate-fadeIn">
            <div className="flex justify-between items-center select-none pb-2 border-b border-zinc-200">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-indigo-500" />
                Resolve Review Locally
              </span>
              <button 
                onClick={() => setResolvePr(null)}
                className="text-slate-400 hover:text-slate-700 text-xs transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-2 select-none">
              <p className="text-xs text-zinc-650 leading-relaxed">
                You are marking PR <strong className="text-zinc-800">#{resolvePr.prNumber}</strong> (<span className="font-mono text-zinc-600">{resolvePr.repositoryId}</span>) as resolved locally. It will be moved to your history and filtered out of your pending queue.
              </p>
              <div className="space-y-1 mt-2">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider pl-1">
                  Optional Comment/Notes
                </label>
                <textarea
                  value={resolveComment}
                  onChange={(e) => setResolveComment(e.target.value)}
                  className="ui-input w-full p-3 text-xs text-zinc-700 focus:outline-none leading-relaxed select-text min-h-[100px] focus:border-zinc-300"
                  placeholder="e.g. Already reviewed on GitHub directly, looks good."
                />
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-zinc-200 pt-3 justify-end select-none">
              <button
                onClick={() => setResolvePr(null)}
                className="ui-button-secondary px-4 py-2.5 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleResolveSubmit}
                className="ui-button-primary px-5 py-2.5 text-xs font-bold"
              >
                Mark Completed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
