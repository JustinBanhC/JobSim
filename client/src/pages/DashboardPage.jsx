import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/layout/PageHeader';
import StatTile from '../components/dashboard/StatTile';
import PipelineFunnel from '../components/dashboard/PipelineFunnel';
import VelocityChart from '../components/dashboard/VelocityChart';
import FollowUpList from '../components/dashboard/FollowUpList';
import { COLUMNS } from '../hooks/useApplications';
import { api } from '../lib/api';

const mono = { fontFamily: 'var(--font-mono)' };

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const WEEKS_SHOWN = 8;

const CLOSED_STATUSES = new Set(['rejected', 'ghosted', 'withdrawn']);
// "Applied or beyond": every stage that implies an application went out.
const APPLIED_OR_BEYOND = new Set(['applied', 'screen_scheduled', 'interviewing', 'offer', 'rejected', 'ghosted']);
const PROGRESSED = new Set(['screen_scheduled', 'interviewing', 'offer']);
const FOLLOW_UP_STATUSES = new Set(['applied', 'screen_scheduled', 'interviewing']);

const STALE_APP_DAYS = 7;
const URGENT_APP_DAYS = 14;
const STALE_CONTACT_DAYS = 5;

function daysSince(dateStr) {
  if (!dateStr) return null;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

/** Monday 00:00 of the week containing d. */
function startOfWeek(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function computeWeeklyVelocity(applications) {
  const currentWeekStart = startOfWeek(new Date());
  const buckets = new Array(WEEKS_SHOWN).fill(0);
  for (const app of applications) {
    const raw = app.date_applied || app.date_created;
    if (!raw) continue;
    const t = new Date(raw);
    if (Number.isNaN(t.getTime())) continue;
    const weeksAgo = Math.round((currentWeekStart - startOfWeek(t)) / WEEK_MS);
    if (weeksAgo >= 0 && weeksAgo < WEEKS_SHOWN) {
      buckets[WEEKS_SHOWN - 1 - weeksAgo] += 1;
    }
  }
  const weeks = buckets.map((count, i) => {
    const start = new Date(currentWeekStart.getTime() - (WEEKS_SHOWN - 1 - i) * WEEK_MS);
    return {
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      count,
      isCurrent: i === WEEKS_SHOWN - 1,
    };
  });
  return { weeks, delta: buckets[WEEKS_SHOWN - 1] - buckets[WEEKS_SHOWN - 2] };
}

export default function DashboardPage() {
  const [applications, setApplications] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const [apps, people] = await Promise.all([
        api.applications.list(),
        api.contacts.list(),
      ]);
      setApplications(apps || []);
      setContacts(people || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const logFollowUp = useCallback(async (id) => {
    try {
      setBusyId(id);
      await api.applications.addActivity(id, { type: 'follow_up', note: 'Followed up' });
      await load({ silent: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const stats = useMemo(() => {
    const counts = {};
    for (const col of COLUMNS) counts[col.id] = 0;
    for (const app of applications) {
      if (counts[app.status] !== undefined) counts[app.status] += 1;
    }
    const total = applications.length;
    const activeCount = applications.filter((a) => !CLOSED_STATUSES.has(a.status)).length;
    const appliedOrBeyond = applications.filter((a) => APPLIED_OR_BEYOND.has(a.status)).length;
    const progressed = applications.filter((a) => PROGRESSED.has(a.status)).length;
    const responseRate = appliedOrBeyond > 0 ? Math.round((progressed / appliedOrBeyond) * 100) : null;
    return {
      counts,
      total,
      activeCount,
      appliedOrBeyond,
      progressed,
      responseRate,
      interviewCount: counts.interviewing || 0,
      offerCount: counts.offer || 0,
    };
  }, [applications]);

  const velocity = useMemo(() => computeWeeklyVelocity(applications), [applications]);

  const staleApps = useMemo(() => (
    applications
      .filter((a) => FOLLOW_UP_STATUSES.has(a.status))
      .map((app) => ({ app, days: daysSince(app.date_updated) }))
      .filter(({ days }) => days !== null && days > STALE_APP_DAYS)
      .map((entry) => ({ ...entry, urgent: entry.days >= URGENT_APP_DAYS }))
      .sort((a, b) => b.days - a.days)
  ), [applications]);

  const staleContacts = useMemo(() => (
    contacts
      .filter((c) => c.outreach_status === 'reached_out')
      .map((contact) => ({ contact, days: daysSince(contact.date_updated) }))
      .filter(({ days }) => days !== null && days > STALE_CONTACT_DAYS)
      .sort((a, b) => b.days - a.days)
  ), [contacts]);

  return (
    <>
      <PageHeader
        variant="dossier"
        eyebrow="Mission control"
        title="Dashboard"
        description="Funnel, velocity and response signals computed from the live pipeline. Stale threads surface below — clear them before they go cold."
      />
      <div className="flex-1 px-5 md:px-10 lg:px-14 pt-8 pb-14">
        {error && (
          <div
            className="mb-4 p-3 border text-[10px] uppercase tracking-[0.18em]"
            style={{ ...mono, borderColor: 'var(--color-danger)', color: 'var(--color-danger)', backgroundColor: 'rgba(248,113,113,0.06)' }}
          >
            {error}
          </div>
        )}
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-32">
            <div
              className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin motion-reduce:animate-none"
              style={{ borderColor: 'var(--color-accent)', borderTopColor: 'transparent' }}
            />
            <p className="text-[10px] uppercase tracking-[0.28em]" style={{ ...mono, color: 'var(--color-text-muted)' }}>
              Loading…
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* ── STAT TILES ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatTile
                label="Active pipeline"
                value={stats.activeCount}
                sub={`${stats.total} tracked total`}
                accent
              />
              <StatTile
                label="Response rate"
                value={stats.responseRate === null ? '—' : `${stats.responseRate}%`}
                sub={`${stats.progressed} of ${stats.appliedOrBeyond} applied moved past applied`}
              />
              <StatTile
                label="Interviewing"
                value={stats.interviewCount}
                sub="Live interview loops"
              />
              <StatTile
                label="Offers"
                value={stats.offerCount}
                sub="On the table now"
              />
            </div>

            {/* ── CHARTS ── */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <PipelineFunnel
                columns={COLUMNS}
                counts={stats.counts}
                total={stats.total}
                activeCount={stats.activeCount}
              />
              <VelocityChart weeks={velocity.weeks} delta={velocity.delta} />
            </div>

            {/* ── FOLLOW-UPS ── */}
            <FollowUpList
              staleApps={staleApps}
              staleContacts={staleContacts}
              onLogFollowUp={logFollowUp}
              busyId={busyId}
            />
          </div>
        )}
      </div>
    </>
  );
}
