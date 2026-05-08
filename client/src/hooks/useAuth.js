import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const DEV_USER = {
  id: 'dev-local-user',
  email: 'dev@localhost',
  email_confirmed_at: new Date().toISOString(),
};

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirmPending, setConfirmPending] = useState(false);
  const confirmEmailRef = useRef('');

  const emailConfirmed = Boolean(user?.email_confirmed_at);

  useEffect(() => {
    if (!supabase) {
      setUser(DEV_USER);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);

      if (event === 'SIGNED_IN' && u?.email_confirmed_at) {
        setConfirmPending(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Auth not configured');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    confirmEmailRef.current = email;
    setConfirmPending(true);
    return data;
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) throw new Error('Auth not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user?.email_confirmed_at) {
      confirmEmailRef.current = email;
      setConfirmPending(true);
      throw new Error('Email not confirmed');
    }
    setConfirmPending(false);
    return data;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setConfirmPending(false);
    confirmEmailRef.current = '';
  }, []);

  const resendConfirmation = useCallback(async (email) => {
    if (!supabase) throw new Error('Auth not configured');
    const target = email || confirmEmailRef.current;
    if (!target) throw new Error('No email address to resend to');
    const { error } = await supabase.auth.resend({ type: 'signup', email: target });
    if (error) throw error;
  }, []);

  return {
    user,
    loading,
    emailConfirmed,
    confirmPending,
    confirmEmail: confirmEmailRef.current,
    signUp,
    signIn,
    signOut,
    resendConfirmation,
  };
}
