import { useState } from 'react';
import { Menu, X, ShieldCheck } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { ChatPanel } from './components/ChatPanel';
import { AuthModal, UserBadge } from './components/AuthModal';
import { AdminPanel } from './components/AdminPanel';
import { useAuth } from './hooks/useAuth';
import { useProgress } from './hooks/useProgress';

export default function App() {
  const auth = useAuth();
  const { completed, tasks, toggle, reset } = useProgress(auth.user?.id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const totalTasks = tasks.length;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-50">
      {/* Auth modal — shown when Supabase is configured but user not logged in */}
      <AuthModal auth={auth} />

      {/* Admin panel overlay */}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

      {/* Top bar */}
      <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Mobile sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Logo area */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-blue-900 shadow-sm">
              <span className="text-xs font-black text-white">AH</span>
            </div>
            <div>
              <span className="text-sm font-black tracking-tight text-slate-900">AHEAD</span>
              <span className="ml-1.5 text-sm font-light text-slate-400">Onboarding Assistant</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="text-xs text-slate-500">
              {completed.size}/{totalTasks} tasks
            </span>
            <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${totalTasks > 0 ? Math.round((completed.size / totalTasks) * 100) : 0}%` }}
              />
            </div>
          </div>

          {/* Admin panel button (admins only) */}
          {auth.isAdmin && (
            <button
              onClick={() => setShowAdmin(true)}
              className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Admin
            </button>
          )}

          {/* User badge */}
          <UserBadge auth={auth} onSignOut={auth.signOut} />
        </div>
      </header>

      {/* Main layout */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-40 bg-black/30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div
          className={`absolute z-50 h-full transition-transform duration-300 lg:relative lg:translate-x-0 lg:z-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar tasks={tasks} completed={completed} onToggle={toggle} onReset={reset} />
        </div>

        {/* Chat area */}
        <ChatPanel />
      </div>
    </div>
  );
}
