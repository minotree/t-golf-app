import { createRoot } from 'react-dom/client';
import { IonApp, IonContent, setupIonicReact } from '@ionic/react';
import { useEffect, useRef, useState } from 'react';
import '@ionic/react/css/core.css';
import './style.css';
import type { PoseInspection } from './analysis/inspectPose';
import { MotionResults, MotionReview } from './analysis/MotionResults';
import { AuthProvider } from './auth/Auth';
import { ResultHistory } from './data/ResultHistory';

setupIonicReact();

function App() {
  const preview = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const requestId = useRef(0);
  const [phase, setPhase] = useState<'idle' | 'opening' | 'ready' | 'recording' | 'review'>('idle');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [club, setClub] = useState('7번 아이언');
  const [angle, setAngle] = useState('정면');

  const analysisController = useRef<AbortController | null>(null);
  const [analysisState, setAnalysisState] = useState<'idle' | 'running' | 'done' | 'error' | 'cancelled'>('idle');
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [inspection, setInspection] = useState<PoseInspection | null>(null);
  const stopTracks = () => { stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };

  useEffect(() => () => { requestId.current++; if (recorder.current?.state === 'recording') recorder.current.stop(); stopTracks(); }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => {
    if (!url) return;
    void runInspection(url);
    return () => analysisController.current?.abort();
  }, [url]);

  async function runInspection(source: string) {
    if (analysisController.current && !analysisController.current.signal.aborted) return;
    const controller = new AbortController();
    analysisController.current = controller;
    setInspection(null); setAnalysisState('running');
    const timeout = window.setTimeout(() => controller.abort(), 120000);
    try {
      const { inspectPose } = await import('./analysis/inspectPose');
      const result = await inspectPose(source, controller.signal, message => {
        if (!controller.signal.aborted) setAnalysisMessage(message);
      });
      if (!controller.signal.aborted) { setInspection(result); setAnalysisState('done'); setAnalysisMessage('자세 검출과 실험 지표 계산을 완료했습니다. 실제 측정 정확도는 검증 전입니다.'); }
    } catch (error) {
      if (analysisController.current !== controller) return;
      setAnalysisState(controller.signal.aborted ? 'cancelled' : 'error');
      setAnalysisMessage(controller.signal.aborted ? '분석이 취소되었거나 제한 시간(2분)을 초과했습니다. 다시 시도할 수 있습니다.' : error instanceof Error ? error.message : '자세 검출을 실행하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      clearTimeout(timeout);
      if (analysisController.current === controller) analysisController.current = null;
    }
  }
  useEffect(() => {
    if (phase !== 'recording') return;
    const timer = window.setInterval(() => setSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [phase]);
  useEffect(() => { if (phase === 'recording' && seconds >= 30) recorder.current?.stop(); }, [seconds, phase]);
  useEffect(() => {
    const hide = () => { if (document.hidden) { requestId.current++; if (recorder.current?.state === 'recording') recorder.current.stop(); else { stopTracks(); setPhase(value => value === 'review' ? value : 'idle'); } } };
    document.addEventListener('visibilitychange', hide);
    return () => document.removeEventListener('visibilitychange', hide);
  }, []);

  async function openCamera() {
    setError(''); setPhase('opening');
    const id = ++requestId.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('촬영을 지원하지 않는 브라우저입니다.');
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (id !== requestId.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      if (preview.current) { preview.current.srcObject = media; await preview.current.play(); }
      if (id !== requestId.current) { stopTracks(); return; }
      setPhase('ready');
    } catch {
      if (id !== requestId.current) return;
      stopTracks(); setPhase('idle'); setError('카메라를 열 수 없습니다. HTTPS 연결과 Safari의 카메라 권한을 확인한 뒤 다시 시도해 주세요.');
    }
  }

  function startRecording() {
    if (!stream.current) return;
    try {
      const type = ['video/mp4', 'video/webm;codecs=vp8', 'video/webm'].find(value => MediaRecorder.isTypeSupported(value));
      const capture = new MediaRecorder(stream.current, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      capture.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      capture.onerror = () => { setError('촬영 중 오류가 발생했습니다. 다시 촬영해 주세요.'); stopTracks(); setPhase('idle'); };
      capture.onstop = () => {
        stopTracks();
        const blob = new Blob(chunks, { type: capture.mimeType });
        if (!blob.size) { setError('촬영된 영상이 없습니다. 다시 촬영해 주세요.'); setPhase('idle'); return; }
        setUrl(URL.createObjectURL(blob)); setPhase('review');
      };
      recorder.current = capture; capture.start(); setSeconds(0); setPhase('recording');
    } catch { setError('촬영을 시작하지 못했습니다. 카메라를 다시 열어 주세요.'); stopTracks(); setPhase('idle'); }
  }

  function reset() { requestId.current++; analysisController.current?.abort(); analysisController.current = null; setAnalysisState('idle'); setInspection(null); setAnalysisMessage(''); stopTracks(); setUrl(''); setError(''); setPhase('idle'); }

  return <IonApp><IonContent><main><AuthProvider>
    <header><a className="brand" href="/">⚑ <span>골프연습</span></a><span className="badge">PWA · 개발 중</span></header>
    <section className="intro"><span className="eyebrow">YOUR NEXT BETTER SWING</span><h1>한 번의 스윙,<br/>한 걸음 더 나아지게.</h1><p>촬영하고 돌아보세요. 좋은 스윙은 작은 발견에서 시작됩니다.</p></section>
    <div className="workspace"><section className="camera-panel" aria-label="스윙 촬영">
      <div className="panel-top"><span>스윙 촬영</span><span>{phase === 'recording' ? `● REC ${seconds}초 / 30초` : '영상은 서버로 전송되지 않습니다'}</span></div>
      <div className="viewfinder">
        <video ref={preview} autoPlay muted playsInline hidden={phase !== 'ready' && phase !== 'recording' && phase !== 'opening'} />
        {phase === 'review' && <video src={url} controls playsInline aria-label="촬영한 스윙 다시 보기" />}
        {phase === 'idle' && <div className="camera-empty"><div className="frame-icon">＋</div><h2>나의 스윙을 담아보세요</h2><p>머리부터 클럽 끝까지<br/>화면 안에 들어오도록 준비해 주세요.</p></div>}
        {phase === 'opening' && <p className="overlay" role="status">카메라 연결 중…</p>}
      </div>
      <div className="controls">
        {(phase === 'idle' || phase === 'opening') && <button className="primary" disabled={phase === 'opening'} onClick={openCamera}>{phase === 'opening' ? '카메라 연결 중…' : '카메라 켜기'}</button>}
        {phase === 'ready' && <><button className="primary" onClick={startRecording}>● 촬영 시작</button><button onClick={reset}>취소</button></>}
        {phase === 'recording' && <button className="primary" onClick={() => recorder.current?.stop()}>■ 촬영 종료 · 이번 스윙 확인</button>}
        {phase === 'review' && <><button className="primary" onClick={reset}>다음 스윙 촬영</button><a className="button" href={url} download={`swing-${Date.now()}.${recorder.current?.mimeType.includes('mp4') ? 'mp4' : 'webm'}`}>영상 보관</a></>}
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </section><aside>
      <section className="card"><span className="eyebrow">01 / SET UP</span><h2>오늘의 연습</h2><label htmlFor="club">클럽</label><select id="club" value={club} disabled={phase !== 'idle'} onChange={event => setClub(event.target.value)}>{['드라이버','우드 / 유틸리티','4번 아이언','5번 아이언','6번 아이언','7번 아이언','8번 아이언','9번 아이언','웨지','퍼터'].map(item => <option key={item}>{item}</option>)}</select><label htmlFor="angle">촬영 방향</label><select id="angle" value={angle} disabled={phase !== 'idle'} onChange={event => setAngle(event.target.value)}><option>정면</option><option>측후방</option></select><p className="hint">흔들리지 않게 고정하고, 밝은 곳에서 한 번의 스윙을 촬영해 주세요. 최대 30초까지 촬영됩니다.</p></section>
      <section className="card result"><span className="eyebrow">02 / SWING REVIEW</span><h2>{phase === 'review' ? '이번 스윙 다시 보기' : '스윙을 이해하는 네 가지 지표'}</h2>{inspection ? <MotionReview key={inspection.elapsedMs} inspection={inspection} club={club} cameraAngle={angle} /> : <MotionResults />}<p className="hint">촬영 종료 후 기기에서 자세 검출을 확인합니다. 최초 실행에는 외부 서버에서 모델·실행 파일을 다운로드합니다. 영상은 업로드하지 않습니다. 스윙 지표는 검증 중입니다.</p>
{phase === 'review' && <div className="inspection"><p role="status" aria-live="polite">{analysisMessage}</p>{analysisState === 'running' && <button onClick={() => analysisController.current?.abort()}>분석 취소</button>}{(analysisState === 'error' || analysisState === 'cancelled') && <button onClick={() => void runInspection(url)}>다시 분석</button>}{inspection && <dl><dt>영상 길이</dt><dd>{inspection.durationSeconds.toFixed(1)}초</dd><dt>자세 검출 프레임</dt><dd>{inspection.detectedFrames} / {inspection.sampledFrames}</dd><dt>주요 관절 가시성 충족</dt><dd>{inspection.usableFrames} / {inspection.sampledFrames}</dd><dt>총 처리 시간 (다운로드 포함)</dt><dd>{(inspection.elapsedMs / 1000).toFixed(1)}초</dd></dl>}<p className="hint">5fps 기술 검증 결과이며 분석 정확도 점수가 아닙니다. 전신과 손목이 보이도록 카메라를 고정해 주세요.</p></div>}</section>
    </aside></div><ResultHistory /><footer>로그인 없이 촬영 · 분석 결과 저장 시 로그인 필요<br/>iPhone 13 Pro Safari 실기기 검증 예정</footer>
  </AuthProvider></main></IonContent></IonApp>;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
