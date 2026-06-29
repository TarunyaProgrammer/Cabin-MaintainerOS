import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FolderGit2, 
  FolderOpen, 
  RefreshCw, 
  Trash2,
  Database
} from 'lucide-react';
import { useCabinStore } from '../store';

export const Repositories: React.FC = () => {
  const { 
    repositories, 
    loadRepositories, 
    deleteRepository 
  } = useCabinStore();

  useEffect(() => {
    loadRepositories();
  }, []);

  const openLocalFolder = (localPath: string) => {
    window.electronAPI.openLocalFolder(localPath);
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
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 flex items-center gap-2">
          <Database className="h-5 w-5 text-zinc-500" />
          Repositories
        </h1>
        <p className="text-xs text-zinc-500">Manage locally cached repository worktrees and disk locations.</p>
      </div>

      {repositories.length === 0 ? (
        <div className="ui-card p-12 rounded-lg text-center space-y-3 max-w-lg mx-auto">
          <FolderGit2 className="h-10 w-10 text-zinc-400 mx-auto" />
          <h3 className="text-base font-semibold text-zinc-800">No Cloned Repositories</h3>
          <p className="text-xs text-zinc-500">
            Repositories will automatically show up here once you start preparing pull requests for review.
          </p>
        </div>
      ) : (
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 gap-4"
        >
          {repositories.map((repo) => (
            <motion.div 
              key={repo.id}
              variants={itemVariants}
              className="ui-card p-5 rounded-lg border border-appBorder flex flex-col justify-between h-40"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <FolderGit2 className="h-5 w-5 text-zinc-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-800">{repo.name}</h3>
                    <p className="text-xs text-zinc-500">{repo.owner}</p>
                  </div>
                </div>
                
                <p className="text-[10px] text-zinc-500 font-mono overflow-hidden text-ellipsis whitespace-nowrap bg-zinc-50 p-1.5 rounded border border-zinc-200">
                  {repo.localPath}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-zinc-200 pt-3 mt-4 text-xs text-zinc-500">
                <span>Synced: {repo.lastSyncedAt ? new Date(repo.lastSyncedAt).toLocaleString() : 'never'}</span>
                
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => openLocalFolder(repo.localPath)}
                    className="p-1.5 hover:text-zinc-850 rounded hover:bg-zinc-50 transition-colors"
                    title="Open on Disk"
                  >
                    <FolderOpen className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => deleteRepository(repo.id)}
                    className="p-1.5 hover:text-red-600 rounded hover:bg-zinc-50 transition-colors"
                    title="Delete cache reference"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};
