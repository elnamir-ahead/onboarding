import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { bootstrapTables } from './db';
import authRoutes from './routes/auth';
import progressRoutes from './routes/progress';
import tasksRoutes from './routes/tasks';
import chatRoutes from './routes/chat';
import adminRoutes from './routes/admin';
import botRoutes from './routes/bot';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

const app = express();
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN === '*'
    ? true // allow all (for internal/dev deployments behind VPC)
    : process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'];

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'AHEAD Onboarding API' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bot', botRoutes);

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

async function start() {
  console.log('[server] Bootstrapping DynamoDB tables...');
  await bootstrapTables();

  app.listen(PORT, () => {
    console.log(`\n[server] AHEAD Onboarding API running on http://localhost:${PORT}`);
    console.log('[server] AWS Region:', process.env.AWS_REGION ?? 'us-east-1');
    console.log('[server] OpenAI Secret ARN:', process.env.OPENAI_SECRET_ARN ?? '(not set)');
  });
}

start().catch(err => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
