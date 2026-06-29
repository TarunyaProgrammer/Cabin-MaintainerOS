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
    <div className="flex h-screen w-screen overflow-hidden bg-appBg text-slate-700 font-sans">
      {/* Sidebar navigation */}
      <aside className="w-64 border-r border-appBorder bg-white flex flex-col justify-between select-none">
        <div>
          {/* Windows Titlebar / macOS traffic lights spacer */}
          <div className="h-14 flex items-center px-6 pt-3 drag">
            <span className="text-[13px] font-bold text-slate-800 tracking-wide uppercase">Cabin</span>
          </div>

          <nav className="mt-4 px-4 space-y-1.5">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 text-xs font-semibold rounded-2xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-brandGreenLight text-brandGreen shadow-[0_4px_12px_rgba(15,118,110,0.05)] border-transparent' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
              >
                <item.icon className="h-4.5 w-4.5" />
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer info */}
        <div className="p-5 border-t border-appBorder flex flex-col gap-1.5 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <div className={`h-2.5 w-2.5 rounded-full ${settings.githubToken ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]'}`} />
            <span>{settings.githubToken ? 'GitHub Connected' : 'Missing Token'}</span>
          </div>
          <span className="text-[9px] text-slate-400 font-mono overflow-hidden text-ellipsis whitespace-nowrap">
            {settings.workspacePath || 'No workspace'}
          </span>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Error Banner */}
        {error && (
          <div className="bg-red-50 border-b border-red-100 px-6 py-2.5 flex items-center gap-2.5 text-xs text-red-700 select-text">
            <AlertCircle className="h-4.5 w-4.5 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        
        {/* Sub-page content */}
        <div className="flex-1 overflow-y-auto px-10 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
