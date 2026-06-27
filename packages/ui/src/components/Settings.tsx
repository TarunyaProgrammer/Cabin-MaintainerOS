import React, { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Save, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useCabinStore } from '../store';

export const Settings: React.FC = () => {
  const { settings, loadSettings, saveSettings } = useCabinStore();
  const [githubToken, setGithubToken] = useState('');
  const [workspacePath, setWorkspacePath] = useState('');
  const [antigravityPath, setAntigravityPath] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    loadSettings().then(() => {
      const current = useCabinStore.getState().settings;
      setGithubToken(current.githubToken);
      setWorkspacePath(current.workspacePath);
      setAntigravityPath(current.antigravityPath);
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveSettings({
      githubToken,
      workspacePath,
      antigravityPath,
    });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100 flex items-center gap-2">
          <SettingsIcon className="h-5 w-5 text-zinc-400" />
          Settings
        </h1>
        <p className="text-xs text-zinc-400">Configure local credentials, workspace directories, and AI executables.</p>
      </div>

      <form onSubmit={handleSave} className="clay-card p-8 space-y-6">
        {/* GitHub PAT */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">GitHub Personal Access Token (PAT)</label>
          <div className="relative">
            <input 
              type={showToken ? 'text' : 'password'}
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_..."
              className="clay-input w-full px-4 py-3 text-xs font-mono text-zinc-200 focus:outline-none placeholder:text-zinc-700 shadow-inner"
            />
            <button 
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-4 top-3 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[10px] text-zinc-500 pl-1">
            Requires `repo` and `workflow` permissions to fetch review requests and post PR approvals.
          </p>
        </div>

        {/* Workspace Path */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Cabin Workspace Directory</label>
          <input 
            type="text"
            value={workspacePath}
            onChange={(e) => setWorkspacePath(e.target.value)}
            placeholder="/Users/username/Cabin"
            className="clay-input w-full px-4 py-3 text-xs font-mono text-zinc-200 focus:outline-none shadow-inner"
          />
          <p className="text-[10px] text-zinc-500 pl-1">
            Local folder where git worktrees and cache files will be stored. Defaults to `~/Cabin`.
          </p>
        </div>

        {/* Antigravity executable path */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider pl-1">Antigravity Executable Path</label>
          <input 
            type="text"
            value={antigravityPath}
            onChange={(e) => setAntigravityPath(e.target.value)}
            placeholder="antigravity (or absolute path / 'mock' to simulate)"
            className="clay-input w-full px-4 py-3 text-xs font-mono text-zinc-200 focus:outline-none shadow-inner"
          />
          <p className="text-[10px] text-zinc-500 pl-1">
            The shell command or binary path for the Antigravity CLI. Use `mock` to run a fake review for demonstration.
          </p>
        </div>

        {/* Save and feedback button */}
        <div className="flex items-center gap-3 border-t border-zinc-900/60 pt-4 mt-6 select-none">
          <button 
            type="submit"
            className="clay-button-primary flex items-center gap-2 px-5 py-2.5 text-xs font-bold"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Settings</span>
          </button>
          
          {isSaved && (
            <div className="flex items-center gap-1.5 text-xs text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Settings saved successfully!</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
