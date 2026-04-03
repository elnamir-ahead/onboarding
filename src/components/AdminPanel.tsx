import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Pencil, Trash2, Save, Loader2, Users, CheckSquare, BarChart3 } from 'lucide-react';
import { api, type Task, type UserProfile } from '../lib/api';

type UserSummary = UserProfile & { completed_count: number; full_name?: string | null };

type Tab = 'tasks' | 'users' | 'stats';

const EMPTY_TASK: Omit<Task, 'id'> = {
  title: '',
  description: '',
  priority: 'week1',
  due_label: 'Week 1',
  category: 'Getting Started',
  link_label: null,
  link_url: null,
  sort_order: 0,
  active: true,
};

interface AdminPanelProps {
  onClose: () => void;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>('tasks');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    const { tasks } = await api.tasks.listAll();
    setTasks(tasks);
  }, []);

  const loadUsers = useCallback(async () => {
    const { users } = await api.admin.users();
    setUsers(users as UserSummary[]);
  }, []);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadTasks(), loadUsers()]).finally(() => setIsLoading(false));
  }, [loadTasks, loadUsers]);

  const startEdit = (task: Task) => { setEditingTask({ ...task }); setIsNew(false); };

  const startNew = () => {
    setEditingTask({
      id: `task-${Date.now()}`,
      ...EMPTY_TASK,
      sort_order: tasks.length + 1,
    });
    setIsNew(true);
  };

  const saveTask = async () => {
    if (!editingTask) return;
    setIsSaving(true);
    setError(null);
    try {
      const { id, ...rest } = editingTask;
      await api.tasks.upsert(id, rest);
      await loadTasks();
      setEditingTask(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    }
    setIsSaving(false);
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Delete this task? This cannot be undone.')) return;
    try {
      await api.tasks.delete(id);
      await loadTasks();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const toggleAdmin = async (email: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'employee' : 'admin';
    try {
      await api.admin.setRole(email, newRole as 'employee' | 'admin');
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role update failed.');
    }
  };

  const totalTasks = tasks.filter(t => t.active).length;

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-900/60 backdrop-blur-sm">
      <div className="ml-auto flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Admin Panel</h2>
            <p className="text-xs text-slate-500">Manage onboarding tasks and users</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6">
          {([
            { id: 'tasks', label: 'Tasks', icon: CheckSquare },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'stats', label: 'Stats', icon: BarChart3 },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                tab === id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {/* Tasks Tab */}
              {tab === 'tasks' && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-slate-500">{tasks.length} tasks total ({tasks.filter(t => t.active).length} active)</p>
                    <button
                      onClick={startNew}
                      className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Add Task
                    </button>
                  </div>

                  <div className="space-y-2">
                    {tasks.map(task => (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 rounded-lg border p-3 ${
                          task.active ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">{task.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              task.priority === 'urgent' ? 'bg-red-50 text-red-700' :
                              task.priority === 'week1' ? 'bg-amber-50 text-amber-700' :
                              'bg-blue-50 text-blue-700'
                            }`}>
                              {task.due_label}
                            </span>
                            <span className="text-xs text-slate-400">{task.category}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEdit(task)}
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Users Tab */}
              {tab === 'users' && (
                <div>
                  <p className="mb-4 text-sm text-slate-500">{users.length} registered users</p>
                  <div className="space-y-2">
                    {users.map(user => {
                      const pct = totalTasks > 0 ? Math.round((user.completed_count / totalTasks) * 100) : 0;
                      return (
                        <div key={user.id} className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3">
                          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                            {(user.full_name ?? user.email).slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-slate-800">
                              {user.full_name ?? user.email}
                            </p>
                            <p className="truncate text-xs text-slate-500">{user.email}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs font-medium text-slate-700">{user.completed_count}/{totalTasks} tasks</p>
                            <div className="mt-1 h-1.5 w-20 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                          <button
                            onClick={() => toggleAdmin(user.email, user.role)}
                            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                              user.role === 'admin'
                                ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {user.role === 'admin' ? 'Admin' : 'Employee'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stats Tab */}
              {tab === 'stats' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {[
                      { label: 'Total Users', value: users.length },
                      { label: 'Active Tasks', value: totalTasks },
                      { label: 'Fully Onboarded', value: users.filter(u => u.completed_count >= totalTasks).length },
                      { label: 'Avg Completion', value: `${users.length > 0 ? Math.round(users.reduce((a, u) => a + u.completed_count, 0) / users.length / (totalTasks || 1) * 100) : 0}%` },
                      { label: 'In Progress', value: users.filter(u => u.completed_count > 0 && u.completed_count < totalTasks).length },
                      { label: 'Not Started', value: users.filter(u => u.completed_count === 0).length },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
                        <p className="text-2xl font-bold text-blue-600">{value}</p>
                        <p className="mt-1 text-xs text-slate-500">{label}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h3 className="mb-3 text-sm font-semibold text-slate-700">Per-user Progress</h3>
                    {users.sort((a, b) => b.completed_count - a.completed_count).map(user => {
                      const pct = totalTasks > 0 ? Math.round((user.completed_count / totalTasks) * 100) : 0;
                      return (
                        <div key={user.id} className="mb-2">
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-slate-700">{user.full_name ?? user.email}</span>
                            <span className="font-medium text-slate-500">{pct}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-2 rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Task Drawer */}
      {editingTask && (
        <div className="absolute inset-0 z-60 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" style={{ maxHeight: '90vh' }}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-800">{isNew ? 'Add Task' : 'Edit Task'}</h3>
              <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Title</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={e => setEditingTask(t => t ? { ...t, title: e.target.value } : t)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
                <textarea
                  rows={3}
                  value={editingTask.description}
                  onChange={e => setEditingTask(t => t ? { ...t, description: e.target.value } : t)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Priority</label>
                  <select
                    value={editingTask.priority}
                    onChange={e => setEditingTask(t => t ? { ...t, priority: e.target.value } : t)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="urgent">Urgent (First Days)</option>
                    <option value="week1">Week 1</option>
                    <option value="month1">Month 1</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Due Label</label>
                  <input
                    type="text"
                    value={editingTask.due_label}
                    onChange={e => setEditingTask(t => t ? { ...t, due_label: e.target.value } : t)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Category</label>
                  <input
                    type="text"
                    value={editingTask.category}
                    onChange={e => setEditingTask(t => t ? { ...t, category: e.target.value } : t)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Sort Order</label>
                  <input
                    type="number"
                    value={editingTask.sort_order}
                    onChange={e => setEditingTask(t => t ? { ...t, sort_order: Number(e.target.value) } : t)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Link Label (optional)</label>
                <input
                  type="text"
                  value={editingTask.link_label ?? ''}
                  onChange={e => setEditingTask(t => t ? { ...t, link_label: e.target.value || null } : t)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Link URL (optional)</label>
                <input
                  type="url"
                  value={editingTask.link_url ?? ''}
                  onChange={e => setEditingTask(t => t ? { ...t, link_url: e.target.value || null } : t)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editingTask.active}
                  onChange={e => setEditingTask(t => t ? { ...t, active: e.target.checked } : t)}
                  className="rounded"
                />
                Active (visible to employees)
              </label>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={saveTask}
                disabled={isSaving || !editingTask.title.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isNew ? 'Create Task' : 'Save Changes'}
              </button>
              <button
                onClick={() => setEditingTask(null)}
                className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
