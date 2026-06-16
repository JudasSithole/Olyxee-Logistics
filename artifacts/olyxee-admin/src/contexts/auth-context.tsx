import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, ApiError } from "../lib/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "admin" | "manager" | "staff";
  businessId: string;
}

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (args: {
    email: string;
    password: string;
    fullName: string;
    businessName: string;
  }) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (args: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (args: { password: string; token?: string }) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface ApiAuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  businessId: string;
}

function toAuthUser(u: ApiAuthUser): AuthUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: (u.role as AuthUser["role"]) ?? "staff",
    businessId: u.businessId ?? "",
  };
}

function errMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong. Please try again.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ user: ApiAuthUser }>("/api/auth/me")
      .then((data) => {
        if (cancelled) return;
        setUser(toAuthUser(data.user));
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setStatus("unauthenticated");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      signIn: async (email, password) => {
        try {
          const data = await apiFetch<{ user: ApiAuthUser }>("/api/auth/login", {
            method: "POST",
            body: { email, password },
          });
          setUser(toAuthUser(data.user));
          setStatus("authenticated");
          return { error: null };
        } catch (e) {
          return { error: errMessage(e) };
        }
      },
      signUp: async ({ email, password, fullName, businessName }) => {
        try {
          const data = await apiFetch<{ user: ApiAuthUser }>("/api/auth/signup", {
            method: "POST",
            body: { email, password, fullName, businessName },
          });
          setUser(toAuthUser(data.user));
          setStatus("authenticated");
          return { error: null };
        } catch (e) {
          return { error: errMessage(e) };
        }
      },
      signOut: async () => {
        try {
          await apiFetch("/api/auth/logout", { method: "POST" });
        } catch {
          // Ignore — clear local state regardless.
        }
        setUser(null);
        setStatus("unauthenticated");
      },
      requestPasswordReset: async (email) => {
        try {
          await apiFetch("/api/auth/forgot-password", {
            method: "POST",
            body: { email },
          });
          return { error: null };
        } catch (e) {
          return { error: errMessage(e) };
        }
      },
      resetPassword: async ({ password, token }) => {
        const resolvedToken =
          token ??
          (typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("token") ?? ""
            : "");
        try {
          await apiFetch("/api/auth/reset-password", {
            method: "POST",
            body: { token: resolvedToken, password },
          });
          return { error: null };
        } catch (e) {
          return { error: errMessage(e) };
        }
      },
      updateProfile: async ({ name, email, currentPassword, newPassword }) => {
        try {
          const body: Record<string, unknown> = {};
          if (name !== undefined) body.name = name;
          if (email !== undefined) body.email = email;
          if (currentPassword !== undefined) body.currentPassword = currentPassword;
          if (newPassword !== undefined) body.newPassword = newPassword;
          const data = await apiFetch<{ user: ApiAuthUser }>("/api/auth/me", {
            method: "PUT",
            body,
          });
          if (data?.user) setUser(toAuthUser(data.user));
          return { error: null };
        } catch (e) {
          return { error: errMessage(e) };
        }
      },
    }),
    [status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
