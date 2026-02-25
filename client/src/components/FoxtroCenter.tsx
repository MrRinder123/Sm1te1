import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAppStore } from '../store/useAppStore';

export const FoxtroCenter = () => {
  const user = useAppStore((s) => s.user);
  const [tier, setTier] = useState<'NONE' | 'FOXTRO' | 'FULLFOXTRO'>('NONE');

  useEffect(() => {
    api.get('/foxtro/me').then(({ data }) => setTier(data?.subscriptionTier ?? 'NONE')).catch(() => null);
  }, []);

  const subscribe = async (nextTier: 'FOXTRO' | 'FULLFOXTRO') => {
    const { data } = await api.post('/foxtro/subscribe', { tier: nextTier });
    setTier(data.subscriptionTier);
  };

  const cancel = async () => {
    const { data } = await api.post('/foxtro/cancel');
    setTier(data.subscriptionTier);
  };

  if (!user) return null;

  return (
    <div className="rounded border border-panelAlt p-2 space-y-2 bg-panelAlt/40">
      <p className="text-xs uppercase text-slate-400">Foxtro</p>
      <p className="text-sm">Plan: <span className="font-semibold">{tier}</span></p>
      <div className="flex gap-2">
        <button className="text-xs bg-accent px-2 py-1 rounded" onClick={() => subscribe('FOXTRO')}>Get Foxtro</button>
        <button className="text-xs bg-indigo-500 px-2 py-1 rounded" onClick={() => subscribe('FULLFOXTRO')}>Get FullFoxtro</button>
      </div>
      {tier !== 'NONE' && <button className="text-xs bg-red-500/80 px-2 py-1 rounded" onClick={cancel}>Cancel</button>}
    </div>
  );
};
