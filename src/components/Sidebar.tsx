import { useState } from 'react';
import { CheckCircle2, Circle, ExternalLink, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import { type OnboardingTask, type TaskPriority } from '../data/onboardingData';

interface SidebarProps {
  tasks: OnboardingTask[];
  completed: Set<string>;
  onToggle: (id: string) => void;
  onReset: () => void;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; bg: string; border: string }> = {
  urgent: { label: 'First Days', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  week1: { label: 'Week 1', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  month1: { label: 'Month 1', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
};

function TaskItem({
  task,
  isCompleted,
  onToggle,
}: {
  task: OnboardingTask;
  isCompleted: boolean;
  onToggle: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`rounded-lg border transition-all duration-200 ${
        isCompleted ? 'border-green-200 bg-green-50 opacity-75' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-start gap-2 p-2.5">
        <button
          onClick={onToggle}
          className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110"
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : (
            <Circle className="h-5 w-5 text-slate-300 hover:text-slate-400" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <p
              className={`text-sm font-medium leading-snug ${
                isCompleted ? 'text-slate-400 line-through' : 'text-slate-800'
              }`}
            >
              {task.title}
            </p>
            <button
              onClick={() => setExpanded(e => !e)}
              className="mt-0.5 flex-shrink-0 text-slate-400 hover:text-slate-600"
            >
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${PRIORITY_CONFIG[task.priority].bg} ${PRIORITY_CONFIG[task.priority].color}`}
            >
              {task.dueLabel}
            </span>
            <span className="text-xs text-slate-400">{task.category}</span>
          </div>

          {expanded && (
            <div className="mt-2 space-y-1.5">
              <p className="text-xs leading-relaxed text-slate-600">{task.description}</p>
              {task.link && (
                <a
                  href={task.link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {task.link.label}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({
  priority,
  tasks,
  completed,
  onToggle,
}: {
  priority: TaskPriority;
  tasks: OnboardingTask[];
  completed: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(priority !== 'month1');
  const cfg = PRIORITY_CONFIG[priority];
  const doneCount = tasks.filter(t => completed.has(t.id)).length;

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 transition-colors ${cfg.bg} ${cfg.border} hover:opacity-90`}
      >
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-bold ${cfg.color} ${cfg.bg}`}
          >
            {doneCount}/{tasks.length}
          </span>
        </div>
        {open ? (
          <ChevronDown className={`h-4 w-4 ${cfg.color}`} />
        ) : (
          <ChevronRight className={`h-4 w-4 ${cfg.color}`} />
        )}
      </button>

      {open && (
        <div className="mt-1.5 space-y-1.5 pl-0.5">
          {tasks.map(task => (
            <TaskItem
              key={task.id}
              task={task}
              isCompleted={completed.has(task.id)}
              onToggle={() => onToggle(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ tasks, completed, onToggle, onReset }: SidebarProps) {
  const total = tasks.length;
  const done = tasks.filter(t => completed.has(t.id)).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const byPriority = (p: TaskPriority) => tasks.filter(t => t.priority === p);

  return (
    <aside className="flex h-full w-80 flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-800">Onboarding Progress</h2>
          <button
            onClick={onReset}
            title="Reset all"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs text-slate-500">{done} of {total} tasks complete</span>
            <span className="text-xs font-bold text-blue-600">{pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {pct === 100 && (
          <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-center text-sm font-medium text-green-700">
            🎉 All done! Welcome to AHEAD!
          </div>
        )}
      </div>

      {/* Task list */}
      <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
        <Section priority="urgent" tasks={byPriority('urgent')} completed={completed} onToggle={onToggle} />
        <Section priority="week1" tasks={byPriority('week1')} completed={completed} onToggle={onToggle} />
        <Section priority="month1" tasks={byPriority('month1')} completed={completed} onToggle={onToggle} />
      </div>
    </aside>
  );
}
