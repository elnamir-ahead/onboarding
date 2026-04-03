import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getUserByEmail, createUser } from '../db';
import { requireAuth, signToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { email, password, fullName } = req.body as {
    email?: string;
    password?: string;
    fullName?: string;
  };

  if (!email || !password || !fullName) {
    res.status(400).json({ error: 'email, password, and fullName are required.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const id = uuidv4();

  await createUser({
    email: normalizedEmail,
    id,
    passwordHash,
    fullName: fullName.trim(),
    role: 'employee',
    createdAt: new Date().toISOString(),
  });

  const token = signToken({ userId: id, email: normalizedEmail, role: 'employee' });
  res.status(201).json({
    token,
    user: { id, email: normalizedEmail, fullName: fullName.trim(), role: 'employee' },
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: 'email and password are required.' });
    return;
  }

  const user = await getUserByEmail(email.toLowerCase().trim());
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.json({
    token,
    user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
  });
});

// GET /api/auth/me — verify token and return profile
router.get('/me', requireAuth, async (req, res) => {
  const user = await getUserByEmail(req.user!.email);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  res.json({ id: user.id, email: user.email, fullName: user.fullName, role: user.role });
});

export default router;
