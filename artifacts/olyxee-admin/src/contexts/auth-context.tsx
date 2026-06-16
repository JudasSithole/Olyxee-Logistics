import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { Profile } from "../lib/database.types";

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
  session: Session | null;
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
    newPassword?: string;
  }) => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  resetPassword: (args: { password: string }) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function profileToAuthUser(profile: Profile): AuthUser {
  return {
    id: profile.id,
    email: profile.email,
    name: profile.full_name,
    role: profile.role,
    businessId: profile.business_id ?? "",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (error || !data) return null;
    return data as Profile;
  }, []);

  useEffect(() => {
    // Check existing session on mount
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      if (s?.user) {
        const profile = await loadProfile(s.user.id);
        if (profile) {
          setUser(profileToAuthUser(profile));
          setStatus("authenticated");
          return;
        }
      }
      setUser(null);
      setStatus("unauthenticated");
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, s) => {
        setSession(s);
        if (s?.user && event !== "SIGNED_OUT") {
          const profile = await loadProfile(s.user.id);
          if (profile) {
            setUser(profileToAuthUser(profile));
            setStatus("authenticated");
            return;
          }
        }
        setUser(null);
        setStatus(event === "SIGNED_OUT" ? "unauthenticated" : "loading");
      },
    );

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      session,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return { error: error.message };
        return { error: null };
      },
      signUp: async ({ email, password, fullName, businessName }) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, business_name: businessName },
          },
        });
        if (error) return { error: error.message };
        return { error: null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      requestPasswordReset: async (email) => {
        const redirectTo = `${window.location.origin}/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) return { error: error.message };
        return { error: null };
      },
      resetPassword: async ({ password }) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return { error: error.message };
        return { error: null };
      },
      updateProfile: async ({ name, email, newPassword }) => {
        // Update auth email / password
        const authUpdates: { email?: string; password?: string } = {};
        if (email) authUpdates.email = email;
        if (newPassword) authUpdates.password = newPassword;
        if (Object.keys(authUpdates).length > 0) {
          const { error } = await supabase.auth.updateUser(authUpdates);
          if (error) return { error: error.message };
        }
        // Update profile row
        if (name || email) {
          const currentUser = (await supabase.auth.getUser()).data.user;
          if (!currentUser) return { error: "Not authenticated" };
          const updates: { full_name?: string; email?: string } = {};
          if (name) updates.full_name = name;
          if (email) updates.email = email;
          const { error } = await supabase
            .from("profiles")
            .update(updates)
            .eq("id", currentUser.id);
          if (error) return { error: error.message };
          // Refresh local user
          const profile = await loadProfile(currentUser.id);
          if (profile) setUser(profileToAuthUser(profile));
        }
        return { error: null };
      },
    }),
    [status, user, session, loadProfile],
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
