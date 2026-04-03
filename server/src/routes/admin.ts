import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getAllUsers, getAllProgress, updateUserRole } from '../db';

const router = Router();
router.use(requireAuth, requireAdmin);

// GET /api/admin/users — all users with their progress count
router.get('/users', async (_req, res) => {
  const [users, progress] = await Promise.all([getAllUsers(), getAllProgress()]);

  const countMap: Record<string, number> = {};
  for (const p of progress) {
    countMap[p.userId] = (countMap[p.userId] ?? 0) + 1;
  }

  const enriched = users.map(u => ({
    ...u,
    completed_count: countMap[u.id] ?? 0,
  }));

  res.json({ users: enriched });
});

// PATCH /api/admin/users/:email/role — toggle admin role
router.patch('/users/:email/role', async (req, res) => {
  const { role } = req.body as { role?: 'employee' | 'admin' };
  if (role !== 'employee' && role !== 'admin') {
    res.status(400).json({ error: 'role must be "employee" or "admin".' });
    return;
  }
  await updateUserRole(decodeURIComponent(req.params.email), role);
  res.json({ ok: true });
});

export default router;
