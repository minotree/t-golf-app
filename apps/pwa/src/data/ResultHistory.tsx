import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/Auth';
import { supabase } from './supabase';

interface Entry { id: string; created_at: string; club: string; start_seconds: number; end_seconds: number; head_ratio: number | null; torso_degrees: number | null }
function isEntry(value: unknown): value is Entry {
  if (typeof value !== 'object' || value === null) return false;
  return 'id' in value && typeof value.id === 'string' && 'created_at' in value && typeof value.created_at === 'string'
    && 'club' in value && typeof value.club === 'string'
    && 'start_seconds' in value && typeof value.start_seconds === 'number' && Number.isFinite(value.start_seconds)
    && 'end_seconds' in value && typeof value.end_seconds === 'number' && Number.isFinite(value.end_seconds)
    && 'head_ratio' in value && (value.head_ratio === null || typeof value.head_ratio === 'number' && Number.isFinite(value.head_ratio))
    && 'torso_degrees' in value && (value.torso_degrees === null || typeof value.torso_degrees === 'number' && Number.isFinite(value.torso_degrees));
}

export function ResultHistory() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [owner, setOwner] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => { generation.current++; setEntries([]); setOwner(''); setBusy(false); setError(''); return () => { generation.current++; }; }, [user?.id]);
  async function load() {
    if (!supabase || !user || busy) return;
    const run = ++generation.current;
    setBusy(true); setError('');
    try {
      const { data, error } = await supabase.from('swing_results').select('id,created_at,club,start_seconds,end_seconds,head_ratio,torso_degrees').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
      if (error || !data || !data.every(isEntry)) throw new Error('조회 실패');
      if (generation.current === run) { setEntries(data); setOwner(user.id); }
    } catch { if (generation.current === run) setError('기록을 불러오지 못했습니다. 다시 시도해 주세요.'); }
    finally { if (generation.current === run) setBusy(false); }
  }
  if (!user || !supabase) return null;
  return <section className="card account"><h2>저장한 연습 기록</h2><button disabled={busy} onClick={load}>{busy ? '불러오는 중…' : '최근 20건 불러오기 / 새로고침'}</button>
    {error && <p role="alert">{error}</p>}
    {owner === user.id && (entries.length ? <ul>{entries.map(entry => <li key={entry.id}><strong>{entry.club}</strong> · {new Date(entry.created_at).toLocaleString('ko-KR')}<p className="hint">구간 {entry.start_seconds.toFixed(2)}~{entry.end_seconds.toFixed(2)}초 · 머리 이동 {entry.head_ratio === null ? '측정 불가' : `${(entry.head_ratio * 100).toFixed(1)}%`} · 몸통 변화 {entry.torso_degrees === null ? '측정 불가' : `${entry.torso_degrees.toFixed(1)}°`} · 실험 지표</p></li>)}</ul> : <p role="status">저장된 기록이 없습니다.</p>)}
  </section>;
}
