export type Tempo = { status: 'available'; backswingSeconds: number; downswingSeconds: number; ratio: number }
  | { status: 'unavailable'; reason: string };

/** 사용자가 영상에서 지정한 시각만 계산한다. 자동 임팩트 검출 결과가 아니다. */
export function calculateTempo(start: number, top: number, impact: number, duration: number): Tempo {
  if (![start, top, impact, duration].every(Number.isFinite) || start < 0 || start >= top || top >= impact || impact > duration) {
    return { status: 'unavailable', reason: '영상 범위 안에서 시작 < 탑 < 임팩트 순서로 시간을 입력해 주세요.' };
  }
  const backswingSeconds = top - start, downswingSeconds = impact - top;
  if (downswingSeconds < 0.02) return { status: 'unavailable', reason: '다운스윙 구간이 너무 짧습니다. 영상에서 탑·임팩트 시각을 다시 확인해 주세요.' };
  return { status: 'available', backswingSeconds, downswingSeconds, ratio: backswingSeconds / downswingSeconds };
}
