import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
        if (cancelled) return;
        setSession(s);
        setUser(s?.user ?? null);
        setInitializing(false);
      });
      const { data: { session: s } } = await supabase.auth.getSession();
      if (cancelled) return;
      setSession(s);
      setUser(s?.user ?? null);
      setInitializing(false);
      return () => {
        cancelled = true;
        subscription.unsubscribe();
      };
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };
  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    return { error: error?.message ?? null };
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  return <Ctx.Provider value={{ user, session, loading: initializing, signIn, signUp, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
}

