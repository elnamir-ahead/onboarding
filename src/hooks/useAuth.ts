import { useState, useEffect, useCallback } from 'react';
import { api, getToken, setToken, clearToken, type UserProfile } from '../lib/api';

export type { UserProfile as Profile };

export interface AuthState {
  user: UserProfile | null;
  profile: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isConfigured: true; // backend is always available
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  signOut: () => void;
  refreshProfile: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: validate existing token and load profile
  useEffect(() => {
    const token = getToken();
    if (!token) { setIsLoading(false); return; }

    api.auth.me()
      .then(profile => setUser(profile))
      .catch(() => { clearToken(); })
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<string | null> => {
    try {
      const { token, user } = await api.auth.login(email, password);
      setToken(token);
      setUser(user);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Login failed.';
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string): Promise<string | null> => {
    try {
      const { token, user } = await api.auth.register(email, password, fullName);
      setToken(token);
      setUser(user);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : 'Registration failed.';
    }
  }, []);

  const signOut = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await api.auth.me();
      setUser(profile);
    } catch { /* ignore */ }
  }, []);

  return {
    user,
    profile: user,
    isLoading,
    isAdmin: user?.role === 'admin',
    isConfigured: true,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  };
}
