import { useId, useState } from 'react';
import { calculateTempo } from './tempo';

export function TempoReview({ duration }: { duration: number }) {
  const id = useId();
  const [start, setStart] = useState('');
  const [top, setTop] = useState('');
  const [impact, setImpact] = useState('');
  const complete = [start, top, impact].every(value => value.trim());
  const result = complete ? calculateTempo(Number(start), Number(top), Number(impact), duration) : null;
  return <section className="range-form"><h3>수동 스윙 템포</h3>
    <p className="hint">영상을 재생해 백스윙 시작·탑·임팩트 시간을 초 단위로 표시하세요. 자동 감지나 5fps 샘플의 임팩트 판정이 아닙니다.</p>
    <div className="range-inputs">{[
      { label: '시작', value: start, set: setStart }, { label: '탑', value: top, set: setTop }, { label: '임팩트', value: impact, set: setImpact },
    ].map((field, index) => <label key={field.label} htmlFor={`${id}-${index}`}>{field.label} (초)<input id={`${id}-${index}`} type="number" min="0" max={duration} step="any" inputMode="decimal" value={field.value} onChange={event => field.set(event.target.value)} /></label>)}</div>
    <p className="hint" role="status">{!result ? '세 시각을 모두 입력하면 계산합니다.' : result.status === 'unavailable' ? result.reason : `백스윙 ${result.backswingSeconds.toFixed(2)}초 · 다운스윙 ${result.downswingSeconds.toFixed(2)}초 · 템포 ${result.ratio.toFixed(2)} : 1`}</p>
    <p className="hint">수동 시각의 오차가 결과에 반영됩니다. 현재 템포는 기기 내 확인용이며 결과 저장에는 포함되지 않습니다.</p>
  </section>;
}
