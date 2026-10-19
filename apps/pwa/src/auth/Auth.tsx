import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../data/supabase';
import { authErrorMessage } from './authErrorMessage';

interface AuthState { user: User | null; ready: boolean; showLogin: () => void }
const AuthContext = createContext<AuthState>({ user: null, ready: false, showLogin: () => {} });
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(!supabase);
  const [open, setOpen] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null); setReady(true);
      if (session?.user && event !== 'TOKEN_REFRESHED') { setMessage(''); setPassword(''); }
      if (event === 'PASSWORD_RECOVERY') { setRecovery(true); setOpen(true); }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (open) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || busy) return;
    setBusy(true); setMessage('');
    try {
      const redirectTo = window.location.origin + window.location.pathname;
      const result = recovery ? await supabase.auth.updateUser({ password })
        : mode === 'login' ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : mode === 'signup' ? await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo } })
        : await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (result.error) throw result.error;
      setPassword('');
      if (recovery) { setRecovery(false); setMessage('비밀번호를 변경했습니다.'); }
      else setMessage(mode === 'signup' ? '이메일에서 가입 확인 안내를 확인해 주세요.' : mode === 'reset' ? '등록된 주소라면 비밀번호 재설정 메일이 전송됩니다.' : '로그인했습니다.');
    } catch (error) { setMessage(authErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function logout() {
    if (!supabase || busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setPassword(''); setMessage('로그아웃했습니다.'); setRecovery(false);
    } catch { setMessage('로그아웃하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  }

  return <AuthContext.Provider value={{ user, ready, showLogin: () => setOpen(true) }}>
    {children}
    <section className="card account" ref={formRef} aria-label="계정">
      <h2>연습 기록 계정</h2>
      {!supabase ? <p className="hint">결과 저장 기능을 준비 중입니다. 지금은 로그인 없이 촬영·분석할 수 있습니다.</p>
        : !ready ? <p role="status">로그인 상태 확인 중…</p>
        : user && !recovery ? <><p>로그인됨: {user.email}</p><button disabled={busy} onClick={logout}>로그아웃</button></>
        : <><button onClick={() => setOpen(value => !value)}>{open ? '로그인 입력 닫기' : '로그인 / 회원가입'}</button>{open && <form onSubmit={submit}>
          <h3>{recovery ? '새 비밀번호 설정' : mode === 'signup' ? '회원가입' : mode === 'reset' ? '비밀번호 재설정' : '로그인'}</h3>
          {!recovery && mode === 'login' && <p className="hint">처음 이용한다면 회원가입 후 이메일의 확인 링크를 열어 주세요. Supabase 대시보드 계정과 이 앱의 회원 계정은 별개입니다.</p>}
          {!recovery && <label htmlFor="account-email">이메일<input id="account-email" type="email" autoComplete="email" required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></label>}
          {(recovery || mode !== 'reset') && <label htmlFor="account-password">비밀번호<input id="account-password" type="password" minLength={8} autoComplete={mode === 'login' && !recovery ? 'current-password' : 'new-password'} required value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /></label>}
          <button type="submit" disabled={busy}>{busy ? '처리 중…' : recovery ? '비밀번호 변경' : mode === 'login' ? '로그인' : mode === 'signup' ? '회원가입' : '재설정 메일 보내기'}</button>
          {!recovery && <div>{(['login', 'signup', 'reset'] as const).map(value => <button key={value} type="button" disabled={busy || mode === value} onClick={() => { setMode(value); setPassword(''); setMessage(''); }}>{value === 'login' ? '로그인' : value === 'signup' ? '회원가입' : '비밀번호 찾기'}</button>)}</div>}
        </form>}</>}
      {message && <p className="hint" role="status">{message}</p>}
      <p className="hint">영상은 저장하지 않으며 분석 결과를 저장할 때만 로그인합니다. 이메일 확인 링크로 페이지가 다시 열리면 메모리의 영상·분석 결과는 유지되지 않습니다.</p>
    </section>
  </AuthContext.Provider>;
}
