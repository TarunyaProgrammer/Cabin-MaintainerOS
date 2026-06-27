import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  GitPullRequest, 
  Clock, 
  CheckCircle2, 
  FolderGit2, 
  ArrowRight,
  Settings
} from 'lucide-react';
import { useCabinStore } from '../store';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { 
    reviews, 
    repositories, 
    history, 
    settings,
    loadSettings, 
    loadRepositories, 
    loadHistory, 
    fetchReviews 
  } = useCabinStore();

  useEffect(() => {
    loadSettings();
    loadRepositories();
    loadHistory();
    // Only fetch reviews if we have a token configured
    if (settings.githubToken) {
      fetchReviews();
    }
  }, [settings.githubToken]);

  // Calculate stats
  const pendingCount = reviews.length;
  
  // Reviews waiting more than 3 days
  const staleReviewsCount = reviews.filter(r => {
    const created = new Date(r.requestedDate).getTime();
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    return created < threeDaysAgo;
  }).length;

  const completedCount = history.length;

  // Animation constants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-5xl mx-auto space-y-8 select-none"
    >
      {/* Greeting Header */}
      <motion.div variants={itemVariants} className="space-y-1 pl-1">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Welcome to Cabin</h1>
        <p className="text-sm text-zinc-400">Everything prepared for your local code review decisions.</p>
      </motion.div>

      {/* Stats Cards grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-5">
        {/* Pending Reviews */}
        <div 
          onClick={() => navigate('/queue')}
          className="clay-card p-6 flex flex-col justify-between h-36 cursor-pointer hover:border-indigo-500/20 active:scale-[0.99] transition-all"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Pending Reviews</span>
            <GitPullRequest className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-bold tracking-tight text-zinc-100 filter drop-shadow-[0_0_8px_rgba(99,102,241,0.2)]">{pendingCount}</span>
            <span className="text-xs text-zinc-500 font-semibold">PRs waiting</span>
          </div>
        </div>

        {/* Stale Reviews */}
        <div 
          onClick={() => navigate('/queue')}
          className="clay-card p-6 flex flex-col justify-between h-36 cursor-pointer hover:border-amber-500/20 active:scale-[0.99] transition-all"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Waiting &gt;3 Days</span>
            <Clock className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-4xl font-bold tracking-tight filter drop-shadow-[0_0_8px_rgba(245,158,11,0.2)] ${staleReviewsCount > 0 ? 'text-amber-400' : 'text-zinc-200'}`}>
              {staleReviewsCount}
            </span>
            <span className="text-xs text-zinc-500 font-semibold">needs response</span>
          </div>
        </div>

        {/* Completed Reviews */}
        <div 
          onClick={() => navigate('/history')}
          className="clay-card p-6 flex flex-col justify-between h-36 cursor-pointer hover:border-emerald-500/20 active:scale-[0.99] transition-all"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Review History</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-bold tracking-tight text-zinc-100 filter drop-shadow-[0_0_8px_rgba(16,185,129,0.2)]">{completedCount}</span>
            <span className="text-xs text-zinc-500 font-semibold">completed</span>
          </div>
        </div>
      </motion.div>

      {/* Main Grid: Left Side actions/recent, Right side details */}
      <div className="grid grid-cols-3 gap-6">
        {/* Recent Repositories */}
        <motion.div variants={itemVariants} className="col-span-2 space-y-4">
          <h2 className="text-xs font-bold tracking-wider text-zinc-400 uppercase pl-1">Recent Repositories</h2>
          {repositories.length === 0 ? (
            <div className="clay-card p-8 text-center space-y-3">
              <FolderGit2 className="h-10 w-10 text-zinc-600 mx-auto" />
              <p className="text-sm font-semibold text-zinc-300">No repositories cached yet</p>
              <p className="text-xs text-zinc-500 leading-relaxed max-w-sm mx-auto">
                Onboard a repository from the Review Queue or Repositories screen to load git histories.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {repositories.slice(0, 4).map((repo) => (
                <div 
                  key={repo.id}
                  onClick={() => navigate('/repos')}
                  className="clay-card p-5 flex items-center justify-between cursor-pointer hover:border-zinc-700/40 active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5">
                    <FolderGit2 className="h-6 w-6 text-zinc-400" />
                    <div className="text-left">
                      <p className="text-sm font-bold text-zinc-200">{repo.name}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">{repo.owner}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-zinc-500" />
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Quick Actions Panel */}
        <motion.div variants={itemVariants} className="space-y-4">
          <h2 className="text-xs font-bold tracking-wider text-zinc-400 uppercase pl-1">Quick Actions</h2>
          <div className="space-y-3">
            {!settings.githubToken ? (
              <button 
                onClick={() => navigate('/settings')}
                className="w-full clay-card p-5 flex items-center justify-between hover:bg-zinc-900/40 text-left border-dashed border-zinc-700/60"
              >
                <div className="flex items-center gap-3.5">
                  <Settings className="h-6 w-6 text-amber-400" />
                  <div>
                    <p className="text-sm font-bold text-zinc-200">Configure Token</p>
                    <p className="text-xs text-zinc-500 mt-0.5">Provide a GitHub PAT to begin</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-500" />
              </button>
            ) : (
              <button 
                onClick={() => navigate('/queue')}
                className="w-full clay-card p-5 flex items-center justify-between hover:border-indigo-500/20 active:scale-[0.99] text-left"
              >
                <div className="flex items-center gap-3.5">
                  <GitPullRequest className="h-6 w-6 text-indigo-400" />
                  <div>
                    <p className="text-sm font-bold text-zinc-200">Go to Review Queue</p>
                    <p className="text-xs text-zinc-500 mt-0.5 font-medium">Check incoming review requests</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-zinc-500" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
