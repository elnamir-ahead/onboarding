import { useState, useEffect, useCallback } from 'react';
import { api, getToken, type Task } from '../lib/api';
import { ONBOARDING_TASKS, type OnboardingTask } from '../data/onboardingData';

const LOCAL_KEY = 'ahead_onboarding_completed';

function loadLocal(): Set<string> {
  try {
    const s = localStorage.getItem(LOCAL_KEY);
    return s ? new Set(JSON.parse(s) as string[]) : new Set();
  } catch { return new Set(); }
}

function saveLocal(c: Set<string>) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(Array.from(c)));
}

function toOnboardingTask(t: Task): OnboardingTask {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority as OnboardingTask['priority'],
    dueLabel: t.due_label,
    category: t.category,
    link: t.link_label && t.link_url ? { label: t.link_label, url: t.link_url } : undefined,
  };
}

export interface ProgressState {
  completed: Set<string>;
  tasks: OnboardingTask[];
  isLoadingTasks: boolean;
  toggle: (taskId: string) => void;
  reset: () => void;
}

export function useProgress(userId: string | undefined): ProgressState {
  const [completed, setCompleted] = useState<Set<string>>(loadLocal);
  const [tasks, setTasks] = useState<OnboardingTask[]>(ONBOARDING_TASKS);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  const isLoggedIn = Boolean(userId && getToken());

  // Load tasks from backend (falls back to hardcoded if not logged in)
  useEffect(() => {
    if (!isLoggedIn) return;
    setIsLoadingTasks(true);
    api.tasks.list()
      .then(({ tasks: backendTasks }) => {
        if (backendTasks.length > 0) setTasks(backendTasks.map(toOnboardingTask));
      })
      .catch(() => { /* keep hardcoded tasks */ })
      .finally(() => setIsLoadingTasks(false));
  }, [isLoggedIn]);

  // Load user progress from backend
  useEffect(() => {
    if (!isLoggedIn) {
      setCompleted(loadLocal());
      return;
    }
    api.progress.get()
      .then(({ taskIds }) => setCompleted(new Set(taskIds)))
      .catch(() => { /* keep local */ });
  }, [isLoggedIn, userId]);

  // Always mirror to localStorage for offline resilience
  useEffect(() => { saveLocal(completed); }, [completed]);

  const toggle = useCallback(async (taskId: string) => {
    const wasCompleted = completed.has(taskId);
    // Optimistic update
    setCompleted(prev => {
      const next = new Set(prev);
      if (wasCompleted) next.delete(taskId); else next.add(taskId);
      return next;
    });

    if (!isLoggedIn) return;

    try {
      if (wasCompleted) {
        await api.progress.incomplete(taskId);
      } else {
        await api.progress.complete(taskId);
      }
    } catch {
      // Rollback on failure
      setCompleted(prev => {
        const next = new Set(prev);
        if (wasCompleted) next.add(taskId); else next.delete(taskId);
        return next;
      });
    }
  }, [completed, isLoggedIn]);

  const reset = useCallback(async () => {
    setCompleted(new Set());
    if (isLoggedIn) {
      await api.progress.reset().catch(() => { /* ignore */ });
    }
  }, [isLoggedIn]);

  return { completed, tasks, isLoadingTasks, toggle, reset };
}
