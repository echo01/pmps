import { createContext, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { authApi, UserSession } from '../api/auth.api';
import { clearToken, getToken } from '../api/httpClient';
import { logger } from '../utils/logger';

type AuthContextValue = {
  user: UserSession | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (payload: { username: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
    window.history.replaceState(null, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  const refreshMe = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      setUser(null);
      return;
    }

    try {
      logger.info('[AUTH][ME][START]');
      const result = await authApi.me();
      setUser(result.user);
      logger.info('[AUTH][ME][API_SUCCESS]', { userId: result.user.id, roles: result.user.roles });
    } catch (error) {
      logger.error('[AUTH][ME][API_ERROR]', { message: error instanceof Error ? error.message : 'Unknown error' });
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (payload: { username: string; password: string }) => {
    logger.info('[LOGIN][SUBMIT][START]', { username: payload.username });
    const result = await authApi.login(payload);
    setUser(result.user);
    logger.info('[LOGIN][SUBMIT][API_SUCCESS]', { userId: result.user.id, roles: result.user.roles });
    window.history.replaceState(null, '', '/dashboard');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('pmps:unauthorized', onUnauthorized);
    return () => window.removeEventListener('pmps:unauthorized', onUnauthorized);
  }, [logout]);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    logout,
    refreshMe,
  }), [loading, login, logout, refreshMe, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
