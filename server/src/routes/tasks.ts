import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getAllTasks, upsertTask, deleteTask } from '../db';

const router = Router();
router.use(requireAuth);

// GET /api/tasks — get all active tasks
router.get('/', async (_req, res) => {
  const tasks = await getAllTasks(false);
  res.json({ tasks });
});

// GET /api/tasks/all — get all tasks including inactive (admin only)
router.get('/all', requireAdmin, async (_req, res) => {
  const tasks = await getAllTasks(true);
  res.json({ tasks });
});

// PUT /api/tasks/:id — create or update a task (admin only)
router.put('/:id', requireAdmin, async (req, res) => {
  const task = { ...req.body, id: req.params.id };
  await upsertTask(task);
  res.json({ ok: true, task });
});

// DELETE /api/tasks/:id — delete a task (admin only)
router.delete('/:id', requireAdmin, async (req, res) => {
  await deleteTask(req.params.id);
  res.json({ ok: true });
});

export default router;
