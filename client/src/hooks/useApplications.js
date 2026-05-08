import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

const COLUMNS = [
  { id: 'researching', label: 'Researching', color: '#a5b4fc' },
  { id: 'applied', label: 'Applied', color: '#7dd3fc' },
  { id: 'screen_scheduled', label: 'Screen Scheduled', color: '#c4b5fd' },
  { id: 'interviewing', label: 'Interviewing', color: '#fcd34d' },
  { id: 'offer', label: 'Offer', color: '#a78bfa' },
  { id: 'rejected', label: 'Rejected', color: '#fb7185' },
  { id: 'ghosted', label: 'Ghosted', color: '#9ca3af' },
  { id: 'withdrawn', label: 'Withdrawn', color: '#a8a29e' },
];

export { COLUMNS };

export function useApplications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      const data = await api.applications.list(filters);
      setApplications(data || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (data) => {
    const app = await api.applications.create(data);
    setApplications(prev => [...prev, app]);
    return app;
  };

  const update = async (id, data) => {
    const app = await api.applications.update(id, data);
    setApplications(prev => prev.map(a => a.id === id ? app : a));
    return app;
  };

  const move = async (id, status, position) => {
    await api.applications.move(id, { status, position });
    await refresh();
  };

  const remove = async (id) => {
    await api.applications.delete(id);
    setApplications(prev => prev.filter(a => a.id !== id));
  };

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.id] = applications
      .filter(a => a.status === col.id)
      .sort((a, b) => a.position - b.position);
    return acc;
  }, {});

  return { applications, grouped, loading, error, refresh, create, update, move, remove };
}
