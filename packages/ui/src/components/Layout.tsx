import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { 
  LayoutDashboard, 
  GitPullRequest, 
  Database, 
  History as HistoryIcon, 
  Settings as SettingsIcon,
  AlertCircle
} from 'lucide-react';
import { useCabinStore } from '../store';

export const Layout: React.FC = () => {
  const { settings, error } = useCabinStore();

  React.useEffect(() => {
    const unsubscribe = window.electronAPI.onPendingReviewsUpdated((prs) => {
      useCabinStore.setState({ reviews: prs });
    });
    return () => unsubscribe();
  }, []);

  const navigation = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard },
    { name: 'Review Queue', to: '/queue', icon: GitPullRequest },
    { name: 'Repositories', to: '/repos', icon: Database },
    { name: 'History', to: '/history', icon: HistoryIcon },
    { name: 'Settings', to: '/settings', icon: SettingsIcon },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-darkBg text-zinc-100 font-sans">
      {/* Sidebar navigation */}
      <aside className="w-64 border-r border-darkBorder bg-zinc-950 flex flex-col justify-between select-none">
        <div>
          {/* Windows Titlebar / macOS traffic lights spacer */}
          <div className="h-10 flex items-center px-4 pt-2 drag">
            <span className="text-[11px] font-semibold text-zinc-500 tracking-wider uppercase">Cabin</span>
          </div>

          <nav className="mt-4 px-3 space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors duration-150 ${
                    isActive 
                      ? 'bg-zinc-900 text-zinc-100 shadow-sm border border-zinc-800' 
                      : 'text-zinc-400 hover:bg-zinc-900/50 hover:text-zinc-200'
                  }`
                }
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-darkBorder flex flex-col gap-1 bg-darkBg/30">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <div className={`h-2 w-2 rounded-full ${settings.githubToken ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            <span>{settings.githubToken ? 'GitHub Connected' : 'Missing Token'}</span>
          </div>
          <span className="text-[10px] text-zinc-600 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
            {settings.workspacePath || 'No workspace'}
          </span>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-950/80 border-b border-red-900 px-4 py-2 flex items-center gap-2 text-xs text-red-200 select-text">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {/* Sub-page content */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
