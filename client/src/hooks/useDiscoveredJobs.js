import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export function useDiscoveredJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [localOnly, setLocalOnly] = useState(false);

  const refresh = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      const data = await api.discovery.jobs(filters);
      setJobs(data);
      setError(null);
      setLocalOnly(false);
    } catch (e) {
      // Deployed builds (Vercel) don't ship the discovery pipeline — show the local-only state.
      if (/not found|404/i.test(e.message)) {
        setLocalOnly(true);
      } else {
        setError(e.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const promote = async (id) => {
    const result = await api.discovery.promote(id);
    setJobs((prev) => prev.map((j) => (j.id === id ? result.job : j)));
    return result;
  };

  const dismiss = async (id) => {
    await api.discovery.dismiss(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  return { jobs, loading, error, localOnly, refresh, promote, dismiss };
}
