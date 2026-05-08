import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

export function useSkills() {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.skills.list();
      setSkills(data || []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (data) => {
    const skill = await api.skills.create(data);
    setSkills(prev => [skill, ...prev]);
    return skill;
  };

  const update = async (id, data) => {
    const skill = await api.skills.update(id, data);
    setSkills(prev => prev.map(x => x.id === id ? skill : x));
    return skill;
  };

  const remove = async (id) => {
    await api.skills.delete(id);
    setSkills(prev => prev.filter(x => x.id !== id));
  };

  return { skills, loading, error, refresh, create, update, remove };
}
