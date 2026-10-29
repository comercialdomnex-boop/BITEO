import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, supabaseConfigError } from '../lib/supabase';
import { toFriendlyAuthError, toFriendlyProfileError } from './errors';
import type { CurrentUser } from '../types';

/** Public projection of public.profiles (read through RLS: id = auth.uid()). */
export interface AuthProfile {
  id: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';
export type ProfileStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface SignUpInput {
  name: string;
  phone: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  /** Derived from the session + public.profiles. Null when nobody is signed in. */
  currentUser: CurrentUser | null;
  profile: AuthProfile | null;
  profileStatus: ProfileStatus;
  profileError: string | null;
  /** True while the user arrived through a password-recovery link. */
  isRecovery: boolean;
  signIn: (
    email: string,
    password: string,
    options?: { remember?: boolean }
  ) => Promise<{ error: string | null }>;
  signUp: (
    input: SignUpInput
  ) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  clearRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return ctx;
}

/**
 * "Lembrar de mim": when unchecked the session is discarded on the next app
 * start instead of being silently restored. The flag lives in localStorage
 * because Supabase persists the session itself.
 */
const REMEMBER_KEY = 'biteo.auth.remember';

function readMetadata(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [profileStatus, setProfileStatus] = useState<ProfileStatus>('idle');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isRecovery, setIsRecovery] = useState(false);

  // Boot: subscribe first (so no event is missed), then restore the session.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setStatus('unauthenticated');
      return;
    }

    let cancelled = false;

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (cancelled) return;
        setSession(newSession);
        setStatus(newSession ? 'authenticated' : 'unauthenticated');
        if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
        if (event === 'SIGNED_OUT') {
          setIsRecovery(false);
          setProfile(null);
          setProfileStatus('idle');
          setProfileError(null);
        }
      }
    );

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (cancelled) return;
        const restored = data.session;
        const remembered = localStorage.getItem(REMEMBER_KEY);

        if (restored && remembered === 'false') {
          // Explicit "do not remember": drop the restored session right away.
          localStorage.removeItem(REMEMBER_KEY);
          setSession(null);
          setStatus('unauthenticated');
          supabase.auth.signOut().catch(() => undefined);
          return;
        }

        // Recovery links land on #access_token=...&type=recovery. supabase-js
        // already consumed the hash by the time getSession resolves, so the
        // flag is set here too and the hash is cleared to avoid re-entering
        // reset mode on the next reload.
        if (restored && window.location.hash.includes('type=recovery')) {
          setIsRecovery(true);
          window.history.replaceState(
            null,
            document.title,
            window.location.pathname + window.location.search
          );
        }

        setSession(restored);
        setStatus(restored ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (!cancelled) setStatus('unauthenticated');
      });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // After sign-in (or session restore), load public.profiles for auth.uid().
  useEffect(() => {
    const supabase = getSupabase();
    const userId = session?.user?.id ?? null;

    if (!supabase || !userId) {
      setProfile(null);
      setProfileStatus('idle');
      setProfileError(null);
      return;
    }

    let cancelled = false;
    setProfileStatus('loading');
    setProfileError(null);

    supabase
      .from('profiles')
      .select('id, full_name, phone, avatar_url, created_at')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setProfile(null);
          setProfileStatus('error');
          setProfileError(toFriendlyProfileError(error));
          return;
        }
        setProfile(
          data
            ? {
                id: data.id,
                fullName: data.full_name ?? '',
                phone: data.phone ?? null,
                avatarUrl: data.avatar_url ?? null,
                createdAt: data.created_at ?? '',
              }
            : null
        );
        setProfileStatus('ready');
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  const currentUser = useMemo<CurrentUser | null>(() => {
    if (status !== 'authenticated' || !session?.user) return null;
    const user = session.user;
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

    return {
      id: user.id,
      name:
        profile?.fullName ||
        readMetadata(metadata.full_name) ||
        readMetadata(metadata.name) ||
        (user.email ? user.email.split('@')[0] : '') ||
        'Usuário BITEO',
      email: user.email ?? '',
      phone: profile?.phone ?? readMetadata(metadata.phone),
      createdAt: profile?.createdAt || user.created_at || new Date().toISOString(),
    };
  }, [status, session, profile]);

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (email, password, options) => {
      const supabase = getSupabase();
      if (!supabase) return { error: supabaseConfigError };

      try {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) return { error: toFriendlyAuthError(error) };
        localStorage.setItem(REMEMBER_KEY, String(options?.remember ?? true));
        return { error: null };
      } catch (err) {
        return { error: toFriendlyAuthError(err) };
      }
    },
    []
  );

  const signUp = useCallback<AuthContextValue['signUp']>(async input => {
    const supabase = getSupabase();
    if (!supabase) return { error: supabaseConfigError, needsEmailConfirmation: false };

    try {
      const { data, error } = await supabase.auth.signUp({
        email: input.email.trim(),
        password: input.password,
        options: {
          emailRedirectTo: window.location.origin,
          // read by private.handle_new_user() -> public.profiles. No store and
          // no membership are created here: only the profile row.
          data: {
            full_name: input.name.trim(),
            phone: input.phone,
          },
        },
      });

      if (error) return { error: toFriendlyAuthError(error), needsEmailConfirmation: false };

      // With confirmations enabled Supabase hides existing accounts: the same
      // shape comes back with an empty identities array.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        return {
          error: 'Já existe uma conta com este e-mail. Entre ou recupere a senha.',
          needsEmailConfirmation: false,
        };
      }

      localStorage.setItem(REMEMBER_KEY, 'true');
      return { error: null, needsEmailConfirmation: !data.session };
    } catch (err) {
      return { error: toFriendlyAuthError(err), needsEmailConfirmation: false };
    }
  }, []);

  const sendPasswordReset = useCallback<AuthContextValue['sendPasswordReset']>(
    async email => {
      const supabase = getSupabase();
      if (!supabase) return { error: supabaseConfigError };

      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin,
        });
        return { error: error ? toFriendlyAuthError(error) : null };
      } catch (err) {
        return { error: toFriendlyAuthError(err) };
      }
    },
    []
  );

  const updatePassword = useCallback<AuthContextValue['updatePassword']>(
    async newPassword => {
      const supabase = getSupabase();
      if (!supabase) return { error: supabaseConfigError };

      try {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        return { error: error ? toFriendlyAuthError(error) : null };
      } catch (err) {
        return { error: toFriendlyAuthError(err) };
      }
    },
    []
  );

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    localStorage.removeItem(REMEMBER_KEY);
    setIsRecovery(false);

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Network failure cannot leave a ghost session behind locally.
      }
    }

    setSession(null);
    setStatus('unauthenticated');
    setProfile(null);
    setProfileStatus('idle');
    setProfileError(null);
  }, []);

  const clearRecovery = useCallback(() => setIsRecovery(false), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      currentUser,
      profile,
      profileStatus,
      profileError,
      isRecovery,
      signIn,
      signUp,
      sendPasswordReset,
      updatePassword,
      signOut,
      clearRecovery,
    }),
    [
      status,
      session,
      currentUser,
      profile,
      profileStatus,
      profileError,
      isRecovery,
      signIn,
      signUp,
      sendPasswordReset,
      updatePassword,
      signOut,
      clearRecovery,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
