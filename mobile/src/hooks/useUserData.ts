import { useEffect, useState } from 'react';
import type { z } from 'zod';

import { useAuth } from '@/auth/AuthProvider';
import { loadUserData } from '@/services/user-data';

export function useUserData<T>(key: string, schema: z.ZodType<T>) {
  const { user } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    setError(false);
    void loadUserData(user.uid, key, schema)
      .then((value) => {
        if (active) setData(value);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [key, schema, user]);

  return { data, loading, error };
}
