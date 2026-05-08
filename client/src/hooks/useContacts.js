import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export function useContacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.contacts.list();
      setContacts(data || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (data) => {
    const tags = Array.isArray(data.tags) ? data.tags : [];
    const contact = await api.contacts.create({ ...data, tags });
    setContacts(prev => [contact, ...prev]);
    return contact;
  };

  const update = async (id, data) => {
    if (data.tags !== undefined) {
      data.tags = Array.isArray(data.tags) ? data.tags : [];
    }
    const contact = await api.contacts.update(id, data);
    setContacts(prev => prev.map(x => x.id === id ? contact : x));
    return contact;
  };

  const remove = async (id) => {
    await api.contacts.delete(id);
    setContacts(prev => prev.filter(x => x.id !== id));
  };

  return { contacts, loading, error, refresh, create, update, remove };
}
