import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL_KEY = 'ahead_supabase_url';
export const SUPABASE_ANON_KEY = 'ahead_supabase_anon_key';

let _client: SupabaseClient | null = null;
let _cachedUrl = '';
let _cachedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const url = localStorage.getItem(SUPABASE_URL_KEY) ?? '';
  const key = localStorage.getItem(SUPABASE_ANON_KEY) ?? '';
  if (!url || !key) return null;
  if (_client && _cachedUrl === url && _cachedKey === key) return _client;
  _client = createClient(url, key);
  _cachedUrl = url;
  _cachedKey = key;
  return _client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    localStorage.getItem(SUPABASE_URL_KEY) &&
    localStorage.getItem(SUPABASE_ANON_KEY)
  );
}

export type Database = {
  public: {
    Tables: {
      user_progress: {
        Row: { id: string; user_id: string; task_id: string; completed_at: string };
        Insert: { user_id: string; task_id: string };
        Delete: { user_id: string; task_id: string };
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string;
          priority: string;
          due_label: string;
          category: string;
          link_label: string | null;
          link_url: string | null;
          sort_order: number;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
      profiles: {
        Row: { id: string; email: string; full_name: string | null; role: string };
        Insert: { id: string; email: string; full_name?: string; role?: string };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
    };
  };
};
