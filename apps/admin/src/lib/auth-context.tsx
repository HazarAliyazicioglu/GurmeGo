"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { z } from "zod";
import { supabase } from "./supabase";
import { translateAuthError } from "./auth-errors";

type Role = "curator" | "admin" | null;

// Only the one claim this app reads. Not an API-input schema (nothing here is validated server
// input) — it's a display-only decode of a JWT payload we already hold, so a local schema (rather
// than one from packages/shared) is the right scope: `.passthrough()` since Supabase JWTs carry many
// other standard claims (sub, exp, ...) this app has no reason to model.
const JwtPayloadSchema = z.object({ user_role: z.string().optional() }).passthrough();

function decodeRole(accessToken: string): Role {
  // Decode the JWT payload (base64url, no verification needed client-side — this is display-only
  // gating, the backend's RolesGuard is the actual security boundary, this just avoids showing a
  // non-curator user a broken page before their first API call 403s).
  try {
    const decoded: unknown = JSON.parse(atob(accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    const parsed = JwtPayloadSchema.safeParse(decoded);
    // Normalize casing here, at the single point this decode first reads the claim: the Prisma
    // `UserRole` enum stores roles UPPERCASE (see apps/api's admin-users.service.ts, which writes
    // `role.toUpperCase()`), so a real Supabase custom access token hook would emit e.g. "CURATOR".
    // Lowercase before comparing so this panel recognizes the DB's casing too.
    const role = parsed.success ? parsed.data.user_role?.toLowerCase() : undefined;
    return role === "curator" || role === "admin" ? role : null;
  } catch {
    return null;
  }
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  role: Role;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<{ error: string | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stateChangeReceived = false;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!stateChangeReceived) {
          setSession(data.session);
          setLoading(false);
        }
      })
      .catch(() => {
        // Without this, a rejected getSession() (network error, Supabase down, ...) leaves `loading`
        // true forever — every protected page stays blank with no feedback. Surface a terminal error
        // state instead so consuming pages (see (protected)/layout.tsx) can render a real message.
        if (!stateChangeReceived) {
          setError("Oturum bilgisi alınamadı. Bağlantınızı kontrol edip sayfayı yenileyin.");
          setLoading(false);
        }
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      stateChangeReceived = true;
      setError(null);
      setSession(newSession);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/sifre-yenile`,
    });
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const value: AuthContextValue = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      role: session?.access_token ? decodeRole(session.access_token) : null,
      loading,
      error,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
    }),
    [session, loading, error, signIn, signOut, requestPasswordReset, updatePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
