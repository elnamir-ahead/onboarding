import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getUserProgress,
  markTaskComplete,
  markTaskIncomplete,
  resetUserProgress,
} from '../db';

const router = Router();
router.use(requireAuth);

// GET /api/progress — get all completed task IDs for the current user
router.get('/', async (req, res) => {
  const taskIds = await getUserProgress(req.user!.userId);
  res.json({ taskIds });
});

// POST /api/progress/:taskId — mark task complete
router.post('/:taskId', async (req, res) => {
  await markTaskComplete(req.user!.userId, req.params.taskId);
  res.json({ ok: true });
});

// DELETE /api/progress/:taskId — mark task incomplete
router.delete('/:taskId', async (req, res) => {
  await markTaskIncomplete(req.user!.userId, req.params.taskId);
  res.json({ ok: true });
});

// DELETE /api/progress — reset all progress
router.delete('/', async (req, res) => {
  await resetUserProgress(req.user!.userId);
  res.json({ ok: true });
});

export default router;
