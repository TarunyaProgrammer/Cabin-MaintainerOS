import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  History as HistoryIcon,
  CheckCircle,
  XCircle,
  MessageSquare,
  ArrowUpRight
} from 'lucide-react';
import { useCabinStore } from '../store';

export const History: React.FC = () => {
  const { history, loadingHistory, loadHistory } = useCabinStore();

  useEffect(() => {
    loadHistory();
  }, []);

  const getDecisionBadge = (decision: string) => {
    const baseClass = "flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border shrink-0";
    if (decision === 'approve') {
      return (
        <span className={`${baseClass} bg-emerald-950/40 border-emerald-900/60 text-emerald-400`}>
          <CheckCircle className="h-3 w-3" />
          <span>Approved</span>
        </span>
      );
    } else if (decision === 'request_changes') {
      return (
        <span className={`${baseClass} bg-rose-950/40 border-rose-900/60 text-rose-400`}>
          <XCircle className="h-3 w-3" />
          <span>Changes Requested</span>
        </span>
      );
    } else {
      return (
        <span className={`${baseClass} bg-zinc-900 border-zinc-800 text-zinc-400`}>
          <MessageSquare className="h-3 w-3" />
          <span>Commented</span>
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

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
          <HistoryIcon className="h-5 w-5 text-zinc-400" />
          Review History
        </h1>
        <p className="text-xs text-zinc-400">View and audit past review decisions and AI summaries.</p>
      </div>

      {loadingHistory ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-20 bg-zinc-900/50 border border-darkBorder animate-pulse rounded-lg" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="glass-card p-12 rounded-lg text-center space-y-3 max-w-lg mx-auto">
          <HistoryIcon className="h-10 w-10 text-zinc-700 mx-auto" />
          <h3 className="text-base font-semibold text-zinc-200">No Review History</h3>
          <p className="text-xs text-zinc-400">
            Completed reviews will appear in this history log once you submit approvals or requests.
          </p>
        </div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {history.map((session) => (
            <motion.div 
              key={session.id}
              variants={itemVariants}
              className="glass-card p-4 rounded-lg border border-darkBorder flex items-center justify-between"
            >
              <div className="space-y-1 flex-1 pr-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-zinc-500">{session.repoOwner}/{session.repoName}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-xs font-mono text-zinc-500">#{session.prNumber}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-[10px] text-zinc-600 font-mono">Reviewed: {new Date(session.reviewedAt).toLocaleString()}</span>
                </div>
                
                <p className="text-xs text-zinc-300 italic line-clamp-1">
                  "{session.aiSummary || 'No review comments recorded.'}"
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {getDecisionBadge(session.decision)}
                
                <button 
                  onClick={() => {
                    const url = `https://github.com/${session.repoOwner}/${session.repoName}/pull/${session.prNumber}`;
                    window.electronAPI.openExternal(url);
                  }}
                  className="p-1.5 text-zinc-500 hover:text-zinc-300 rounded hover:bg-zinc-900 transition-colors"
                  title="View on GitHub"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};
