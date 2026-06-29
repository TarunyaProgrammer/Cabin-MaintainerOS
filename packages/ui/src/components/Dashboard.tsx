import React, { useEffect, useState } from 'react';
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
import { DonutChart } from './DonutChart';

// Animated Number count-up helper
const AnimatedNumber: React.FC<{ value: number }> = ({ value }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) {
      setDisplayValue(end);
      return;
    }

    const duration = 1000; // ms
    const startTime = performance.now();

    const update = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing out quad
      const ease = progress * (2 - progress);
      
      setDisplayValue(Math.floor(ease * (end - start) + start));

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        setDisplayValue(end);
      }
    };

    requestAnimationFrame(update);
  }, [value]);

  return <span>{displayValue}</span>;
};

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
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Hi Maintainer 👋</h1>
        <p className="text-xs text-slate-400">Everything prepared for your local code review decisions.</p>
      </motion.div>

      {/* Welcoming Top Hero Banner */}
      <motion.div 
        variants={itemVariants}
        className="w-full bg-[#fef9c3]/40 border border-[#fef08a]/60 rounded-3xl p-8 flex items-center justify-between overflow-hidden relative"
      >
        <div className="space-y-4 max-w-lg z-10">
          <h2 className="text-2xl font-extrabold tracking-tight text-[#854d0e]">Easy code reviews and approvals</h2>
          <p className="text-xs text-[#a16207] leading-relaxed">
            Diagnose code quality issues, run test pipelines, and automate merge permissions locally with your Cabin review assistant.
          </p>
          <button 
            onClick={() => navigate('/queue')}
            className="bg-[#854d0e] hover:bg-[#713f12] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all"
          >
            Go to Review Queue
          </button>
        </div>

        {/* Custom Forklift Vector SVG Illustration on the right */}
        <div className="hidden md:block w-48 h-48 select-none shrink-0 z-0">
          <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
            {/* Forklift Body (Vibrant Green) */}
            <path d="M40 130h90v25H40zM80 85h45v45H80z" fill="#10b981" />
            <path d="M125 100h20v30h-20z" fill="#047857" />
            
            {/* Cabin Guard Rails (Dark Slate) */}
            <path d="M80 85h5l15-30h20l10 30h5" stroke="#334155" strokeWidth="4" strokeLinecap="round" />
            <path d="M100 55v30M110 55v30" stroke="#334155" strokeWidth="3" />
            
            {/* Wheels (Black/Gray) */}
            <circle cx="65" cy="155" r="22" fill="#1e293b" />
            <circle cx="65" cy="155" r="10" fill="#94a3b8" />
            <circle cx="135" cy="155" r="22" fill="#1e293b" />
            <circle cx="135" cy="155" r="10" fill="#94a3b8" />

            {/* Lifting Mast & Forks (Metal Silver) */}
            <path d="M150 50h4v90h-4z" fill="#64748b" />
            <path d="M154 110h22v6h-22z" fill="#475569" />
            <path d="M154 125h30v6h-30zM184 100v31" stroke="#475569" strokeWidth="4" strokeLinecap="round" />

            {/* Delivery Box Cargo (Brown/Beige) */}
            <path d="M156 80h24v30h-24z" fill="#d97706" />
            <path d="M156 80l12 12 12-12" stroke="#b45309" strokeWidth="2" />
            <path d="M168 92v18" stroke="#b45309" strokeWidth="2" />
          </svg>
        </div>
      </motion.div>

      {/* Stats Cards grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-3 gap-6">
        {/* Pending Reviews */}
        <div 
          onClick={() => navigate('/queue')}
          className="ui-card p-6 flex flex-col justify-between h-36 cursor-pointer hover:border-brandGreen/20"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Reviews</span>
            <GitPullRequest className="h-5 w-5 text-brandGreen" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-extrabold tracking-tight text-slate-800">
              <AnimatedNumber value={pendingCount} />
            </span>
            <span className="text-xs text-slate-400 font-semibold">PRs waiting</span>
          </div>
        </div>

        {/* Stale Reviews */}
        <div 
          onClick={() => navigate('/queue')}
          className="ui-card p-6 flex flex-col justify-between h-36 cursor-pointer hover:border-brandOrange/20"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Waiting &gt;3 Days</span>
            <Clock className="h-5 w-5 text-brandOrange" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-4xl font-extrabold tracking-tight ${staleReviewsCount > 0 ? 'text-brandOrange' : 'text-slate-800'}`}>
              <AnimatedNumber value={staleReviewsCount} />
            </span>
            <span className="text-xs text-slate-400 font-semibold">needs response</span>
          </div>
        </div>

        {/* Completed Reviews */}
        <div 
          onClick={() => navigate('/history')}
          className="ui-card p-6 flex flex-col justify-between h-36 cursor-pointer hover:border-emerald-500/20"
        >
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Review History</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-4xl font-extrabold tracking-tight text-slate-800">
              <AnimatedNumber value={completedCount} />
            </span>
            <span className="text-xs text-slate-400 font-semibold">completed</span>
          </div>
        </div>
      </motion.div>

      {/* Main Grid: Left Side actions/recent, Right side details */}
      <div className="grid grid-cols-12 gap-6">
        
        {/* Recent Repositories */}
        <motion.div variants={itemVariants} className="col-span-8 space-y-4">
          <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase pl-1">Recent Repositories</h2>
          {repositories.length === 0 ? (
            <div className="ui-card p-10 text-center space-y-3">
              <FolderGit2 className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No repositories cached yet</p>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Onboard a repository from the Review Queue or Repositories screen to load git histories.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {repositories.slice(0, 4).map((repo) => (
                <div 
                  key={repo.id}
                  onClick={() => navigate('/repos')}
                  className="ui-card p-5 flex items-center justify-between cursor-pointer hover:border-brandGreen/10"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-2.5 rounded-xl bg-brandGreenLight text-brandGreen">
                      <FolderGit2 className="h-5 w-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-slate-800">{repo.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{repo.owner}</p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Donut Chart / Statistics Visuals Panel */}
        <motion.div variants={itemVariants} className="col-span-4 space-y-4">
          <h2 className="text-xs font-bold tracking-wider text-slate-400 uppercase pl-1">Queue Health</h2>
          <div className="ui-card overflow-hidden">
            <DonutChart 
              passed={completedCount} 
              failed={staleReviewsCount} 
              pending={pendingCount} 
              total={completedCount + staleReviewsCount + pendingCount} 
            />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
