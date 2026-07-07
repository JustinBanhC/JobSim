import { useState, useEffect, useCallback } from 'react';
import AppShell from './components/layout/AppShell';
import ApplicationsPage from './pages/ApplicationsPage';
import DashboardPage from './pages/DashboardPage';
import DiscoverPage from './pages/DiscoverPage';
import SkillsPage from './pages/SkillsPage';
import ConnectionsPage from './pages/ConnectionsPage';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import AgentPanel from './components/AgentPanel';
import { useAuth } from './hooks/useAuth';
import { supabase } from './lib/supabase';

const SKIP_LANDING_KEY = 'jobSim_skip_landing';

function App() {
  const {
    user,
    loading: authLoading,
    emailConfirmed,
    confirmPending,
    confirmEmail,
    signUp,
    signIn,
    signOut,
    resendConfirmation,
  } = useAuth();

  const [view, setView] = useState('applications');
  const [agentOpen, setAgentOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [entered, setEntered] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(SKIP_LANDING_KEY) === '1';
  });

  useEffect(() => {
    if (!supabase) return;
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      supabase.auth.getSession().then(() => {
        window.history.replaceState(null, '', window.location.pathname);
      });
    }
  }, []);

  const enterWorkspace = useCallback(() => {
    localStorage.setItem(SKIP_LANDING_KEY, '1');
    setEntered(true);
  }, []);

  const showLanding = useCallback(() => {
    localStorage.removeItem(SKIP_LANDING_KEY);
    setEntered(false);
  }, []);

  const handleDataChange = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg-main)' }}>
        <p className="text-[10px] uppercase tracking-[0.22em]" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
          Loading...
        </p>
      </div>
    );
  }

  if (!entered) {
    return <LandingPage onEnter={enterWorkspace} />;
  }

  if (!user || !emailConfirmed || confirmPending) {
    return (
      <AuthPage
        signUp={signUp}
        signIn={signIn}
        confirmPending={confirmPending}
        confirmEmail={confirmEmail}
        onResend={resendConfirmation}
      />
    );
  }

  return (
    <AppShell
      view={view}
      onViewChange={setView}
      onShowLanding={showLanding}
      onAgentToggle={() => setAgentOpen((v) => !v)}
      onSignOut={signOut}
      userEmail={user.email}
    >
      {view === 'dashboard' && <DashboardPage key={`dashboard-${refreshKey}`} />}
      {view === 'applications' && <ApplicationsPage key={`apps-${refreshKey}`} />}
      {view === 'discover' && <DiscoverPage key={`discover-${refreshKey}`} />}
      {view === 'skills' && <SkillsPage key={`skills-${refreshKey}`} />}
      {view === 'connections' && <ConnectionsPage key={`contacts-${refreshKey}`} />}
      <AgentPanel
        open={agentOpen}
        onClose={() => setAgentOpen(false)}
        onDataChange={handleDataChange}
      />
    </AppShell>
  );
}

export default App;
