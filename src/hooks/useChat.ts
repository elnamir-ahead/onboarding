import { useState, useCallback } from 'react';
import { api, getToken } from '../lib/api';
import { SYSTEM_PROMPT } from '../data/onboardingData';

// Fallback: call OpenAI directly from browser if backend is unavailable
import OpenAI from 'openai';

function buildSystemPrompt(confluenceContent: string | null): string {
  if (!confluenceContent) return SYSTEM_PROMPT;
  return `## LIVE CONTENT FROM CONFLUENCE (fetched: ${new Date().toLocaleString()})
Prioritize this over the fallback knowledge below.

${confluenceContent}

---

## FALLBACK KNOWLEDGE BASE
${SYSTEM_PROMPT}`;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  role: 'assistant',
  content: `👋 Welcome to AHEAD! I'm your AI Onboarding Assistant.\n\nI'm here to help you navigate your first days, weeks, and month at AHEAD — especially on the **AI Practice team**.\n\nYou can ask me things like:\n- *"What should I do on my first day?"*\n- *"How do I set up GitHub access?"*\n- *"What meetings should I join for the AI Practice?"*\n- *"Who do I contact about my I-9?"*\n\nWhat would you like to know?`,
  timestamp: new Date(),
};

export function useChat(confluenceContent: string | null = null) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      history.push({ role: 'user', content: content.trim() });

      let assistantContent: string;

      try {
        if (getToken()) {
          // Authenticated: use backend (OpenAI key from AWS Secrets Manager)
          const { content: reply } = await api.chat.send(history, confluenceContent);
          assistantContent = reply;
        } else {
          // Not logged in: prompt to sign in
          assistantContent =
            '🔒 **Please sign in** to use the AI assistant.\n\nYou can still use the checklist on the left to track your onboarding progress!';
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';

        // If backend is unreachable and there's a locally stored OpenAI key, fall back
        const fallbackKey = localStorage.getItem('ahead_openai_key');
        if (fallbackKey && msg.includes('fetch')) {
          try {
            const client = new OpenAI({ apiKey: fallbackKey, dangerouslyAllowBrowser: true });
            const response = await client.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: buildSystemPrompt(confluenceContent) },
                ...history,
              ],
              max_tokens: 800,
              temperature: 0.7,
            });
            assistantContent = response.choices[0]?.message?.content ?? 'No response.';
          } catch (fallbackErr) {
            assistantContent = `❌ **Error:** ${fallbackErr instanceof Error ? fallbackErr.message : msg}`;
          }
        } else {
          setError(msg);
          assistantContent = `❌ **Error:** ${msg}`;
        }
      }

      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: assistantContent, timestamp: new Date() },
      ]);
      setIsLoading(false);
    },
    [messages, confluenceContent]
  );

  const clearChat = () => setMessages([WELCOME_MESSAGE]);

  return { messages, isLoading, error, sendMessage, clearChat };
}
