import { useEffect, useRef, useState } from 'react';
import { Trash2, Settings, X, Eye, EyeOff, RefreshCw, ExternalLink } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import { useConfluence, CONFLUENCE_EMAIL_KEY, CONFLUENCE_TOKEN_KEY } from '../hooks/useConfluence';
import { ChatMessage, TypingIndicator } from './ChatMessage';
import { ChatInput } from './ChatInput';

function formatLastSynced(date: Date | null): string {
  if (!date) return 'Never synced';
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'Just synced';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString();
}

export function ChatPanel() {
  const [showSettings, setShowSettings] = useState(false);

  // Confluence credential input state
  const [confluenceEmail, setConfluenceEmail] = useState('');
  const [confluenceToken, setConfluenceToken] = useState('');
  const [showConfToken, setShowConfToken] = useState(false);

  const confluence = useConfluence();
  const { messages, isLoading, sendMessage, clearChat } = useChat(confluence.content);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const openSettings = () => {
    setConfluenceEmail(localStorage.getItem(CONFLUENCE_EMAIL_KEY) ?? '');
    setConfluenceToken(localStorage.getItem(CONFLUENCE_TOKEN_KEY) ?? '');
    setShowSettings(true);
  };

  const saveAndSyncConfluence = async () => {
    localStorage.setItem(CONFLUENCE_EMAIL_KEY, confluenceEmail.trim());
    localStorage.setItem(CONFLUENCE_TOKEN_KEY, confluenceToken.trim());
    await confluence.sync();
  };

  const clearConfluence = () => {
    localStorage.removeItem(CONFLUENCE_EMAIL_KEY);
    localStorage.removeItem(CONFLUENCE_TOKEN_KEY);
    localStorage.removeItem('ahead_confluence_content');
    localStorage.removeItem('ahead_confluence_synced');
    setConfluenceEmail('');
    setConfluenceToken('');
  };

  const handleSaveAll = async () => {
    if (confluenceEmail.trim() && confluenceToken.trim()) {
      await saveAndSyncConfluence();
    }
    setShowSettings(false);
  };

  // Confluence status
  const confStatus = confluence.error
    ? 'error'
    : confluence.isSyncing
    ? 'syncing'
    : confluence.content
    ? 'synced'
    : 'idle';

  const confStatusColor = {
    synced: 'bg-green-500',
    syncing: 'bg-amber-400 animate-pulse',
    error: 'bg-red-400',
    idle: 'bg-slate-300',
  }[confStatus];

  const confStatusLabel = {
    synced: `Confluence synced · ${formatLastSynced(confluence.lastSynced)}`,
    syncing: 'Syncing Confluence…',
    error: `Confluence error: ${confluence.error}`,
    idle: 'Confluence not configured',
  }[confStatus];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 shadow-sm">
            <span className="text-lg font-bold text-white">A</span>
          </div>
          <div>
            <h2 className="font-bold text-slate-800">AHEAD Onboarding AI</h2>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs text-slate-500">AWS Powered</span>
              </div>
              <div className="flex items-center gap-1.5" title={confStatusLabel}>
                <span className={`h-2 w-2 rounded-full ${confStatusColor}`} />
                <span className="text-xs text-slate-500">
                  {confluence.content ? 'Live docs' : 'Static docs'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => confluence.sync()}
            disabled={!confluence.isConfigured || confluence.isSyncing}
            title={confStatusLabel}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${confluence.isSyncing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openSettings}
            title="Settings"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={clearChat}
            title="Clear chat"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" style={{ maxHeight: '90vh' }}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800">Settings</h3>
              <button onClick={() => setShowSettings(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* AWS info banner */}
            <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-800">AWS Backend Connected</p>
              <p className="mt-1 text-xs text-blue-700">
                OpenAI API key is securely stored in{' '}
                <strong>AWS Secrets Manager</strong> — no key entry needed here.
                <br />Region: <code>us-east-1</code>
              </p>
            </div>

            {/* ── Confluence Section ── */}
            <div className="mb-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Confluence Live Sync</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              {confluence.content && !confluence.error && (
                <div className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">
                  Last synced: {formatLastSynced(confluence.lastSynced)} · AI is using live Confluence docs.
                </div>
              )}
              {confluence.error && (
                <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  Error: {confluence.error}
                </div>
              )}

              <label className="mb-2 block text-sm font-medium text-slate-700">Atlassian Email</label>
              <input
                type="email"
                value={confluenceEmail}
                onChange={e => setConfluenceEmail(e.target.value)}
                placeholder="you@ahead.com"
                className="mb-3 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />

              <label className="mb-2 block text-sm font-medium text-slate-700">Atlassian API Token</label>
              <div className="relative">
                <input
                  type={showConfToken ? 'text' : 'password'}
                  value={confluenceToken}
                  onChange={e => setConfluenceToken(e.target.value)}
                  placeholder="Your Atlassian API token…"
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 pr-10 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  onClick={() => setShowConfToken(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-xs text-slate-500">Stored in browser only.</p>
                {confluence.isConfigured && (
                  <button onClick={clearConfluence} className="text-xs text-red-500 hover:underline">Remove</button>
                )}
              </div>
              <a
                href="https://id.atlassian.net/manage-profile/security/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
              >
                Generate an Atlassian API token <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <button
              onClick={handleSaveAll}
              disabled={confluence.isSyncing}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {confluence.isSyncing ? 'Syncing Confluence…' : 'Save & Sync'}
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="scrollbar-thin flex-1 overflow-y-auto bg-slate-50 p-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.map(message => (
            <ChatMessage key={message.id} message={message} />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
