import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export function useEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      const data = await api.events.list(filters);
      setEvents(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (data) => {
    const event = await api.events.create(data);
    setEvents((prev) => [event, ...prev]);
    return event;
  };

  const update = async (id, data) => {
    const event = await api.events.update(id, data);
    setEvents((prev) => prev.map((e) => (e.id === id ? event : e)));
    return event;
  };

  const setStatus = (id, status) => update(id, { status });

  const remove = async (id) => {
    await api.events.delete(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  return { events, loading, error, refresh, create, update, setStatus, remove };
}
