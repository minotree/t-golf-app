import type { Metric, MotionSummary } from './motionMetrics';
import { summarizeWindow } from './motionMetrics';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import type { PoseInspection } from './inspectPose';
import { SaveResult } from '../data/SaveResult';

function Value({ metric, unit, multiplier = 1 }: { metric: Metric; unit: string; multiplier?: number }) {
  return metric.status === 'available'
    ? <strong>{(metric.value * multiplier).toFixed(1)}{unit}</strong>
    : <span className="hint">{metric.reason}</span>;
}

export function MotionResults({ motion }: { motion?: MotionSummary }) {
  if (!motion) return <div className="metrics">{['스윙 템포', '머리 이동', '몸통 기울기 변화', '어깨 회전'].map(label => <div key={label}><span>{label}</span><strong>준비 중</strong></div>)}</div>;
  return <>
    <p className="hint">실험 지표 · 적용 구간 · 5fps</p>
    <div className="metrics">
      <div><span>머리 최대 이동 / 초기 몸통 길이</span><Value metric={motion.headDisplacementTorsoRatio} unit="%" multiplier={100} /></div>
      <div><span>몸통 기울기 최대 변화 (2D)</span><Value metric={motion.torsoAngleChangeDegrees} unit="°" /></div>
      <div><span>스윙 템포</span><strong>구간 감지 검증 예정</strong></div>
      <div><span>어깨 회전</span><strong>3D 정확도 검증 예정</strong></div>
    </div>
    <p className="hint">적용 구간의 첫 분석 프레임이 기준이며 어드레스를 자동 확인하지 않습니다. 구간에 남은 준비·피니시도 포함됩니다. 5fps 간격의 샘플만 사용하며 경계 사이를 보간하지 않습니다. 머리는 코 위치로 추정하며, 미터 이동량·실제 척추각·좋고 나쁨의 점수가 아닙니다.</p>
  </>;
}

export function MotionReview({ inspection, club, cameraAngle }: { inspection: PoseInspection; club: string; cameraAngle: string }) {
  const id = useId();
  const [analysisId] = useState(() => crypto.randomUUID());
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState(String(inspection.durationSeconds));
  const [applied, setApplied] = useState({ start: 0, end: inspection.durationSeconds });
  const [error, setError] = useState('');
  const selected = summarizeWindow(inspection.samples, applied.start, applied.end, inspection.durationSeconds);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!start.trim() || !end.trim()) { setError('시작·끝 시간을 모두 입력해 주세요.'); return; }
    const result = summarizeWindow(inspection.samples, Number(start), Number(end), inspection.durationSeconds);
    if (result.status === 'unavailable') { setError(result.reason); return; }
    setError(''); setApplied({ start: Number(start), end: Number(end) });
  }

  return <>
    <form className="range-form" onSubmit={apply} noValidate>
      <h3>비교할 구간 선택</h3>
      <p className="hint">영상에서 준비 자세와 비교할 끝 시점을 확인한 뒤 시간을 입력해 주세요.</p>
      <div className="range-inputs">
        <label htmlFor={`${id}-start`}>시작 (초)<input id={`${id}-start`} type="number" inputMode="decimal" min="0" max={inspection.durationSeconds} step="any" value={start} onChange={event => setStart(event.target.value)} aria-describedby={`${id}-error`} /></label>
        <label htmlFor={`${id}-end`}>끝 (초)<input id={`${id}-end`} type="number" inputMode="decimal" min="0" max={inspection.durationSeconds} step="any" value={end} onChange={event => setEnd(event.target.value)} aria-describedby={`${id}-error`} /></label>
      </div>
      <button type="submit">구간 적용</button>
      <button type="button" onClick={() => { setStart('0'); setEnd(String(inspection.durationSeconds)); setApplied({ start: 0, end: inspection.durationSeconds }); setError(''); }}>전체 구간</button>
      <p id={`${id}-error`} role={error ? 'alert' : undefined} className="hint">{error}</p>
    </form>
    <p className="hint" role="status">현재 결과 구간: {applied.start.toFixed(2)}~{applied.end.toFixed(2)}초{selected.status === 'available' && ` · 기준 샘플 ${selected.baselineSeconds.toFixed(3)}초 · ${selected.sampledFrames}프레임`}</p>
    {selected.status === 'available' ? <MotionResults motion={selected.motion} /> : <p className="hint">{selected.reason}</p>}
    {selected.status === 'available' && <SaveResult key={`${applied.start}:${applied.end}`} draft={{ analysisId, club, cameraAngle, duration: inspection.durationSeconds, start: applied.start, end: applied.end, baseline: selected.baselineSeconds, frames: selected.sampledFrames, motion: selected.motion }} />}
  </>;
}
