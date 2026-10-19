import { useEffect, useRef, useState } from 'react';

export function InstallPanel({ canReload }: { canReload: boolean }) {
  const [online, setOnline] = useState(navigator.onLine);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const applyingUpdate = useRef(false);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  useEffect(() => {
    const onOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOnline);
    let active = true;
    let registration: ServiceWorkerRegistration | undefined;
    const checkWaiting = () => { if (active && registration?.waiting) setWaiting(registration.waiting); };
    const changed = () => { if (active && applyingUpdate.current) window.location.reload(); };
    if (import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL, updateViaCache: 'none' }).then(value => {
        registration = value; checkWaiting();
        value.addEventListener('updatefound', () => { value.installing?.addEventListener('statechange', checkWaiting); });
      }).catch(() => { if (active) setError('오프라인 화면을 준비하지 못했습니다. 인터넷 연결 후 다시 열어 주세요.'); });
      navigator.serviceWorker.addEventListener('controllerchange', changed);
    }
    return () => { active = false; window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOnline); navigator.serviceWorker?.removeEventListener('controllerchange', changed); };
  }, []);
  return <section className="card install-panel" aria-label="앱 설치와 업데이트">
    <h2>{standalone ? '홈 화면 앱으로 실행 중' : '홈 화면에서 바로 연습하기'}</h2>
    {!standalone && <p>iPhone Safari의 공유 메뉴 → 홈 화면에 추가를 선택하세요. PC Chrome·Edge에서는 주소창의 앱 설치 메뉴를 사용할 수 있습니다.</p>}
    <p className="hint">처음 한 번 온라인에서 연 뒤 앱 화면은 오프라인에서도 다시 열 수 있습니다. 자세 분석 모델 다운로드·로그인·서버 저장에는 인터넷이 필요합니다. 영상과 분석 결과는 새로고침 시 유지되지 않습니다.</p>
    {!online && <p role="status">오프라인입니다. 로그인·저장을 위해 인터넷에 연결해 주세요.</p>}
    {waiting && <><p role="status">새 버전이 준비되었습니다. 촬영·분석 결과를 정리한 뒤 적용해 주세요.</p><button disabled={!canReload || updating} onClick={() => { applyingUpdate.current = true; setUpdating(true); waiting.postMessage({ type: 'ACTIVATE_UPDATE' }); }}>새 버전 적용</button>{!canReload && <p className="hint">현재 영상을 보관하거나 결과를 저장한 뒤 ‘다음 스윙 촬영’을 눌러 업데이트할 수 있습니다.</p>}</>}
    {error && <p role="status">{error}</p>}
    <details><summary>테스트 버전 데이터 안내</summary><p className="hint">촬영 영상과 관절 샘플은 기기 메모리에서만 처리합니다. 저장을 선택하면 계정에 연결된 분석 결과만 서버에 전송합니다. 로그인 상태는 이 브라우저에 유지될 수 있으므로 공용 기기에서는 로그아웃하세요. 모델과 실행 파일을 다운로드할 때 외부 서버에 연결합니다.</p><a href={`${import.meta.env.BASE_URL}third-party-notices.txt`} target="_blank" rel="noreferrer">오픈소스·모델 이용 고지</a></details>
  </section>;
}
