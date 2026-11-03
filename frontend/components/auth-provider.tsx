"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { authApi, AuthResponse, AuthUser, sessionStorageApi } from "@/lib/api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (payload: { email: string; password: string }) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persistSession(session: AuthResponse) {
  sessionStorageApi.saveSession(session);
  return session.user;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function bootstrapSession() {
      const storedUser = sessionStorageApi.loadUser();
      if (storedUser) {
        setUser(storedUser);
      }

      try {
        const freshUser = await authApi.refreshProfile();
        if (!active) return;

        sessionStorageApi.updateUser(freshUser);
        setUser(freshUser);
      } catch {
        if (!active) return;

        sessionStorageApi.clear();
        setUser(null);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void bootstrapSession();

    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(payload) {
        const session = await authApi.login(payload);
        const nextUser = persistSession(session);
        startTransition(() => {
          setUser(nextUser);
        });
        return nextUser;
      },
      async logout() {
        try {
          await authApi.logout();
        } catch {
          // Client-side token cleanup is the source of truth for Phase 1 logout.
        } finally {
          sessionStorageApi.clear();
          startTransition(() => {
            setUser(null);
          });
        }
      },
      async refreshUser() {
        try {
          const freshUser = await authApi.refreshProfile();
          sessionStorageApi.updateUser(freshUser);
          setUser(freshUser);
          return freshUser;
        } catch {
          sessionStorageApi.clear();
          setUser(null);
          return null;
        }
      },
    }),
    [loading, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
