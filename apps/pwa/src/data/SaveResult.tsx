import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/Auth';
import { supabase } from './supabase';
import { toResultRow } from './resultRecord';
import type { ResultDraft } from './resultRecord';

export function SaveResult({ draft }: { draft: ResultDraft }) {
  const { user, ready, showLogin } = useAuth();
  const ids = useRef(new Map<string, string>());
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [savedOwner, setSavedOwner] = useState('');
  const saved = !!user && savedOwner === user.id;
  const [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function save() {
    if (!supabase || !user || inFlight.current || saved) return;
    inFlight.current = true; setBusy(true); setPending(false); setMessage('');
    try {
      const { data: identity, error: authError } = await supabase.auth.getUser();
      if (authError || identity.user?.id !== user.id) throw new Error('로그인 상태를 다시 확인해 주세요.');
      const id = ids.current.get(user.id) ?? crypto.randomUUID();
      ids.current.set(user.id, id);
      const row = toResultRow(draft, id, user.id);
      const { error } = await supabase.from('swing_results').insert(row);
      if (error) {
        // 응답 유실 후 재시도해도 이미 저장한 동일 ID를 성공으로 처리한다.
        if (error.code !== '23505') throw error;
        const { data, error: readError } = await supabase.from('swing_results').select('id').eq('analysis_id', draft.analysisId).eq('start_seconds', draft.start).eq('end_seconds', draft.end).eq('user_id', user.id).single();
        if (readError || !data) throw error;
      }
      if (mounted.current) { setSavedOwner(user.id); setMessage('분석 결과를 저장했습니다. 영상은 전송하지 않았습니다.'); }
    } catch { if (mounted.current) setMessage('저장하지 못했습니다. 로그인·네트워크를 확인한 뒤 다시 시도해 주세요.'); }
    finally { inFlight.current = false; if (mounted.current) setBusy(false); }
  }
  useEffect(() => { if (pending && user && ready) void save(); }, [pending, user, ready]);

  return <div>
    <button disabled={!supabase || !ready || busy || saved} onClick={() => {
      if (!user) { setPending(true); showLogin(); setMessage('로그인하면 현재 구간의 결과를 이어서 저장합니다.'); }
      else void save();
    }}>{saved ? '저장 완료' : busy ? '저장 중…' : '이 구간 결과 저장'}</button>
    {pending && <button onClick={() => { setPending(false); setMessage('저장 대기를 취소했습니다.'); }}>저장 대기 취소</button>}
    {!supabase && <p className="hint">결과 저장은 서비스 연결 후 사용할 수 있습니다.</p>}
    {message && <p className="hint" role="status">{message}</p>}
  </div>;
}
