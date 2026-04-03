import { Router, Request, Response, NextFunction } from 'express';
import OpenAI from 'openai';
import {
  getAllTasks,
  getUserByEmail,
  markTaskComplete,
  getUserProgress,
  getBotSession,
  saveBotSession,
} from '../db';
import { getOpenAiKey } from '../aws';
import { fetchConfluenceOnboardingContent, mergeConfluenceIntoSystemPrompt } from '../confluence';

// ── Shared system prompt (kept in sync with chat.ts) ─────────────────────────
const SYSTEM_PROMPT = `You are AHEAD's friendly and knowledgeable AI Onboarding Assistant answering questions in Microsoft Teams. Your job is to help new employees — especially those on the AI Practice team — get onboarded quickly and confidently.

Keep answers concise and well-formatted for Teams chat (use **bold** for key terms, bullet points for lists, avoid overly long responses). Always be direct and actionable.

## AHEAD General Onboarding

### First Week - Urgent Tasks
- **I-9 Form (Section 1)** – Complete by Monday. Contact onboarding@ahead.com.
- **I-9 Documents** – Meet with I-9 rep by Wednesday.
- **Headshot** – Upload to UKGPro by Friday. Business casual, clear background.
- **KnowBe4 Compliance Training** – Access via Okta.
- **UKG Documents** – Acknowledge via UKG > Home (Okta).
- **New Hire Gifts** – Fill out New Hire Gift Order Form.
- **Email Signature** – See Email Signatures Guidelines on ARCHIE.
- **Microsoft Teams** – Join role-relevant channels (ask your manager). Set up on mobile.

### Month 1
- **Benefits** – Enroll via ARCHIE > How to Enroll In Benefits.
- **Performance Goals** – Set in Learning and Performance Hub (Perform to IMPACT).
- **Concur** – Set up expense profile + mobile.
- **CertifAI** – Submit your certifications on ARCHIE.

## AI Practice Onboarding

### Key Documents
- IMPACT 2027: https://archie.ahead.com/sites/impact/sitepagemodern/22125/impact-2027-v2
- Hatch Sales Plays: https://archie.ahead.com/sites/focus-sales-plays/SitePageModern/14213/hatch
- Foundry: https://archie.ahead.com/sites/focus-sales-plays/SitePageModern/11622/ahead-foundry-formerly-esg
- Enablement Hub: https://archie.ahead.com/sites/solutions-and-selling/SitePageModern/11437/home

### Software Access (request via IT Service Center)
- Lucid, Glean, Smartsheet, Microsoft Copilot/Studio
- Windsurf (limited licenses — expanding)
- GitHub Enterprise: create account with AHEAD email, request access via IT ticket
- Coding assistants (Cursor etc.) – download and expense

### GitHub
1. Create GitHub account with AHEAD email
2. Request Enterprise access via IT ticket
3. AHEAD Labs (agentic-modernization) — contact Dan Wittenburg for Data Science repos

### Recurring Meetings
- **Brains Assembly** – General AI talks — Revo Tesha
- **Tech on Tap** – Tech/AI talks — Rushda Umrani
- **Hive Fridays** – Internal AI projects — Erin Hollingshad

## Key Contacts
- Onboarding: onboarding@ahead.com
- Office access: officeaccess@ahead.com
- GitHub/Data Science: Dan Wittenburg
- AmEx/Concur: Amanda Piron

## Key Systems
- Okta (SSO): https://ahead.okta.com
- ARCHIE (intranet): https://archie.ahead.com
- UKGPro (HR)
- KnowBe4 (compliance training)
- Concur (expenses)

Respond concisely. When unsure about role-specific details, suggest asking the manager or onboarding@ahead.com.`;

// ── Bot auth middleware ────────────────────────────────────────────────────────
function requireBotSecret(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.BOT_SECRET;
  if (!expected) {
    // Dev mode: allow through with a warning
    console.warn('[bot-auth] BOT_SECRET not set — allowing all bot requests (dev mode)');
    next();
    return;
  }
  const provided = req.headers['x-bot-secret'];
  if (!provided || provided !== expected) {
    res.status(401).json({ error: 'Invalid bot secret.' });
    return;
  }
  next();
}

const router = Router();
router.use(requireBotSecret);

// ── POST /api/bot/chat ────────────────────────────────────────────────────────
// Called by the Teams bot for every AI message. Loads history from DynamoDB,
// appends the new message, calls OpenAI, saves history, returns the reply.
router.post('/chat', async (req, res) => {
  const { teamsId, displayName, message } = req.body as {
    teamsId: string;
    displayName?: string;
    message: string;
  };

  if (!teamsId || !message) {
    res.status(400).json({ error: 'teamsId and message are required.' });
    return;
  }

  const session = (await getBotSession(teamsId)) ?? {
    teamsId,
    history: [] as { role: 'user' | 'assistant'; content: string }[],
    updatedAt: new Date().toISOString(),
  };

  if (displayName && !session.displayName) {
    session.displayName = displayName;
  }

  const history = session.history ?? [];
  history.push({ role: 'user', content: message });
  const trimmed = history.slice(-20);

  try {
    const confluenceContent = await fetchConfluenceOnboardingContent();
    const systemPrompt = confluenceContent
      ? mergeConfluenceIntoSystemPrompt(SYSTEM_PROMPT, confluenceContent)
      : SYSTEM_PROMPT;

    const apiKey = await getOpenAiKey();
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...trimmed,
      ],
      max_tokens: 600,
      temperature: 0.7,
    });

    const reply =
      response.choices[0]?.message?.content ?? 'Sorry, I could not generate a response.';
    trimmed.push({ role: 'assistant', content: reply });

    await saveBotSession({
      ...session,
      history: trimmed,
      updatedAt: new Date().toISOString(),
    });

    res.json({ reply });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[bot/chat] Error:', msg);
    res.status(500).json({ error: msg });
  }
});

// ── GET /api/bot/session/:teamsId ─────────────────────────────────────────────
router.get('/session/:teamsId', async (req, res) => {
  const session = await getBotSession(req.params.teamsId);
  if (!session) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }
  res.json(session);
});

// ── POST /api/bot/link — link Teams AAD ID to web app email ──────────────────
router.post('/link', async (req, res) => {
  const { teamsId, displayName, email } = req.body as {
    teamsId: string;
    displayName?: string;
    email: string;
  };

  if (!teamsId || !email) {
    res.status(400).json({ error: 'teamsId and email are required.' });
    return;
  }

  const user = await getUserByEmail(email);
  if (!user) {
    res.status(404).json({
      error: `No account found for ${email}. Please register in the web app first, or contact onboarding@ahead.com.`,
    });
    return;
  }

  const existing = (await getBotSession(teamsId)) ?? {
    teamsId,
    history: [],
    updatedAt: new Date().toISOString(),
  };

  await saveBotSession({
    ...existing,
    email: email.toLowerCase(),
    displayName: displayName ?? existing.displayName,
    linkedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  res.json({ ok: true, email: email.toLowerCase(), fullName: user.fullName });
});

// ── GET /api/bot/tasks — all active tasks ─────────────────────────────────────
router.get('/tasks', async (_req, res) => {
  const tasks = await getAllTasks();
  res.json(tasks);
});

// ── GET /api/bot/progress/:email ──────────────────────────────────────────────
router.get('/progress/:email', async (req, res) => {
  const user = await getUserByEmail(req.params.email);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  const completed = await getUserProgress(user.id);
  res.json({ completed });
});

// ── POST /api/bot/progress/:email/complete ────────────────────────────────────
router.post('/progress/:email/complete', async (req, res) => {
  const { taskId } = req.body as { taskId: string };
  if (!taskId) {
    res.status(400).json({ error: 'taskId is required.' });
    return;
  }
  const user = await getUserByEmail(req.params.email);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  await markTaskComplete(user.id, taskId);
  res.json({ ok: true });
});

export default router;
