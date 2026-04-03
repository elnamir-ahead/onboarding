import express from 'express';
import {
  CloudAdapter,
  ConfigurationBotFrameworkAuthentication,
  TurnContext,
  ActivityHandler,
  MessageFactory,
} from 'botbuilder';

const {
  MICROSOFT_APP_ID = '',
  MICROSOFT_APP_PASSWORD = '',
  BOT_SECRET = '',
  BACKEND_URL = 'http://localhost:3001',
  PORT = '3978',
} = process.env;

if (!BOT_SECRET) {
  console.warn('[WARN] BOT_SECRET is not set. Requests to the backend will be rejected in production.');
}

// ── Backend API helpers ───────────────────────────────────────────────────────
type Task = {
  id: string;
  title: string;
  priority: string;
  due_label: string;
  category: string;
};

type BotSession = {
  teamsId: string;
  email?: string;
  displayName?: string;
};

async function backendFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const url = `${BACKEND_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-bot-secret': BOT_SECRET,
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

async function chatWithBackend(teamsId: string, displayName: string, message: string): Promise<string> {
  const data = (await backendFetch('/api/bot/chat', {
    method: 'POST',
    body: JSON.stringify({ teamsId, displayName, message }),
  })) as { reply: string };
  return data.reply;
}

async function getSession(teamsId: string): Promise<BotSession | null> {
  try {
    return (await backendFetch(`/api/bot/session/${encodeURIComponent(teamsId)}`)) as BotSession;
  } catch {
    return null;
  }
}

async function linkAccount(teamsId: string, displayName: string, email: string): Promise<{ fullName: string }> {
  return (await backendFetch('/api/bot/link', {
    method: 'POST',
    body: JSON.stringify({ teamsId, displayName, email }),
  })) as { fullName: string };
}

async function getTasks(): Promise<Task[]> {
  return (await backendFetch('/api/bot/tasks')) as Task[];
}

async function getProgress(email: string): Promise<string[]> {
  const data = (await backendFetch(`/api/bot/progress/${encodeURIComponent(email)}`)) as { completed: string[] };
  return data.completed;
}

async function markComplete(email: string, taskId: string): Promise<void> {
  await backendFetch(`/api/bot/progress/${encodeURIComponent(email)}/complete`, {
    method: 'POST',
    body: JSON.stringify({ taskId }),
  });
}

// ── Bot logic ─────────────────────────────────────────────────────────────────
class OnboardingBot extends ActivityHandler {
  constructor() {
    super();

    // Proactive welcome when a new member is added to the conversation
    this.onMembersAdded(async (context, next) => {
      const membersAdded = context.activity.membersAdded ?? [];
      for (const member of membersAdded) {
        if (member.id === context.activity.recipient.id) continue;

        let urgentBlock = '';
        try {
          const tasks = await getTasks();
          const urgent = tasks.filter(t => t.priority === 'urgent').slice(0, 3);
          if (urgent.length > 0) {
            urgentBlock =
              '\n\n**Your urgent first-week tasks:**\n' +
              urgent.map(t => `• **${t.title}** *(${t.due_label})*`).join('\n');
          }
        } catch {
          // Backend not reachable at welcome time — skip task list
        }

        await context.sendActivity(
          MessageFactory.text(
            `👋 **Welcome to AHEAD, ${member.name ?? 'new hire'}!**\n\n` +
            `I'm your AI Onboarding Assistant. I can answer any onboarding question and help you track your checklist.` +
            urgentBlock +
            `\n\n**Quick commands:**\n` +
            `• \`/link your-email@ahead.com\` — connect your account\n` +
            `• \`/tasks\` — see your full onboarding checklist\n` +
            `• \`/done <task name>\` — mark a task complete\n` +
            `• \`/progress\` — see your completion %\n\n` +
            `Or just ask me anything — *"What should I do first?"*, *"How do I get GitHub access?"*`
          )
        );
      }
      await next();
    });

    this.onMessage(async (context: TurnContext, next) => {
      const text = (context.activity.text ?? '').trim();
      if (!text) { await next(); return; }

      const teamsId = context.activity.from.id;
      const displayName = context.activity.from.name ?? 'New Hire';

      await context.sendActivity({ type: 'typing' });

      try {
        // ── /link <email> ────────────────────────────────────────────────────
        if (/^\/link\s+\S+/i.test(text)) {
          const email = text.replace(/^\/link\s+/i, '').trim();
          try {
            const result = await linkAccount(teamsId, displayName, email);
            await context.sendActivity(
              MessageFactory.text(
                `✅ **Account linked!** Welcome, ${result.fullName}!\n\n` +
                `Your Teams account is now connected to **${email}**.\n` +
                `Type \`/tasks\` to see your onboarding checklist.`
              )
            );
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Unknown error';
            await context.sendActivity(
              MessageFactory.text(
                `❌ **Could not link account:** ${msg}\n\n` +
                `Make sure you're registered in the web app first, or contact onboarding@ahead.com.`
              )
            );
          }
          await next();
          return;
        }

        // ── /tasks ────────────────────────────────────────────────────────────
        if (/^\/tasks$/i.test(text) || /show (my )?tasks|my checklist/i.test(text)) {
          const session = await getSession(teamsId);
          if (!session?.email) {
            await context.sendActivity(
              MessageFactory.text(
                `To view your checklist, first link your AHEAD account:\n` +
                `\`/link your-email@ahead.com\``
              )
            );
            await next();
            return;
          }

          const [tasks, completed] = await Promise.all([getTasks(), getProgress(session.email)]);
          const completedSet = new Set(completed);
          const incomplete = tasks.filter(t => !completedSet.has(t.id));
          const doneCount = completed.length;
          const pct = tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

          const urgent = incomplete.filter(t => t.priority === 'urgent');
          const week1 = incomplete.filter(t => t.priority === 'week1');
          const month1 = incomplete.filter(t => t.priority === 'month1');

          let msg = `📋 **Onboarding Checklist** — ${pct}% complete (${doneCount}/${tasks.length})\n\n`;

          if (incomplete.length === 0) {
            msg += `🎉 **You've completed all tasks! Congratulations!**\n`;
          } else {
            if (urgent.length > 0) {
              msg += `**🔴 Urgent:**\n${urgent.slice(0, 5).map(t => `• ${t.title} *(${t.due_label})*`).join('\n')}\n\n`;
            }
            if (week1.length > 0) {
              msg += `**🟡 Week 1:**\n${week1.slice(0, 5).map(t => `• ${t.title}`).join('\n')}`;
              if (week1.length > 5) msg += `\n*...and ${week1.length - 5} more*`;
              msg += '\n\n';
            }
            if (month1.length > 0) {
              msg += `**🟢 Month 1:**\n${month1.slice(0, 3).map(t => `• ${t.title}`).join('\n')}`;
              if (month1.length > 3) msg += `\n*...and ${month1.length - 3} more*`;
              msg += '\n\n';
            }
            msg += `Type \`/done <task name>\` to mark a task complete.`;
          }

          await context.sendActivity(MessageFactory.text(msg));
          await next();
          return;
        }

        // ── /progress ─────────────────────────────────────────────────────────
        if (/^\/progress$/i.test(text) || /my progress|how am i doing/i.test(text)) {
          const session = await getSession(teamsId);
          if (!session?.email) {
            await context.sendActivity(
              MessageFactory.text(
                `Link your account first:\n\`/link your-email@ahead.com\``
              )
            );
            await next();
            return;
          }

          const [tasks, completed] = await Promise.all([getTasks(), getProgress(session.email)]);
          const pct = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;
          const remaining = tasks.length - completed.length;
          const urgentRemaining = tasks.filter(
            t => t.priority === 'urgent' && !completed.includes(t.id)
          ).length;

          const msg =
            `📊 **Onboarding Progress**\n\n` +
            `✅ Completed: **${completed.length}** / ${tasks.length} tasks (**${pct}%**)\n` +
            `📌 Remaining: ${remaining} tasks\n` +
            (urgentRemaining > 0 ? `⚠️ Urgent remaining: **${urgentRemaining}**\n` : '') +
            `\nType \`/tasks\` for the full list.`;

          await context.sendActivity(MessageFactory.text(msg));
          await next();
          return;
        }

        // ── /done <task name> ─────────────────────────────────────────────────
        if (/^\/done\s+\S/i.test(text)) {
          const session = await getSession(teamsId);
          if (!session?.email) {
            await context.sendActivity(
              MessageFactory.text(
                `Link your account first:\n\`/link your-email@ahead.com\``
              )
            );
            await next();
            return;
          }

          const query = text.replace(/^\/done\s+/i, '').trim().toLowerCase();
          const tasks = await getTasks();
          const match = tasks.find(
            t =>
              t.title.toLowerCase().includes(query) ||
              t.id.toLowerCase().includes(query)
          );

          if (!match) {
            const suggestions = tasks
              .filter(t => t.title.toLowerCase().includes(query.split(' ')[0]))
              .slice(0, 3)
              .map(t => `• ${t.title}`)
              .join('\n');
            await context.sendActivity(
              MessageFactory.text(
                `❌ No task found matching "${query}".\n` +
                (suggestions ? `\nDid you mean?\n${suggestions}\n\n` : '') +
                `Type \`/tasks\` to see the full list.`
              )
            );
            await next();
            return;
          }

          await markComplete(session.email, match.id);
          const [allTasks, completed] = await Promise.all([getTasks(), getProgress(session.email)]);
          const pct = Math.round((completed.length / allTasks.length) * 100);

          await context.sendActivity(
            MessageFactory.text(
              `✅ Marked as done: **${match.title}**\n` +
              `You're now at **${pct}%** (${completed.length}/${allTasks.length} tasks).`
            )
          );
          await next();
          return;
        }

        // ── Default: AI chat ──────────────────────────────────────────────────
        const reply = await chatWithBackend(teamsId, displayName, text);
        await context.sendActivity(MessageFactory.text(reply));

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error('[bot] Error:', msg);
        await context.sendActivity(
          MessageFactory.text(`Sorry, something went wrong. Please try again.\n\n*${msg}*`)
        );
      }

      await next();
    });
  }
}

// ── Express + Bot Framework adapter ──────────────────────────────────────────
const botFrameworkAuth = new ConfigurationBotFrameworkAuthentication({
  MicrosoftAppId: MICROSOFT_APP_ID,
  MicrosoftAppPassword: MICROSOFT_APP_PASSWORD,
});

const adapter = new CloudAdapter(botFrameworkAuth);

adapter.onTurnError = async (context, error) => {
  console.error('[onTurnError]', error);
  await context.sendActivity('Something went wrong. Please try again.');
};

const bot = new OnboardingBot();
const app = express();
app.use(express.json());

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', bot: 'AHEAD Onboarding Bot', backend: BACKEND_URL })
);

app.post('/api/messages', async (req, res) => {
  await adapter.process(req, res, (context) => bot.run(context));
});

app.listen(parseInt(PORT, 10), () => {
  console.log(`\nAHEAD Onboarding Bot running on port ${PORT}`);
  console.log(`Webhook endpoint: POST /api/messages`);
  console.log(`Backend: ${BACKEND_URL}`);
  console.log('\nTo test locally with Teams, run:');
  console.log(`  npx ngrok http ${PORT}`);
  console.log('Then set the ngrok URL as the messaging endpoint in Azure Bot Service.');
});
