export interface PosePoint { x: number; y: number; visibility: number }
export interface FrameMotion {
  head: { x: number; y: number } | null;
  torsoLength: number | null;
  torsoAngleDegrees: number | null;
}
export type Metric = { status: 'available'; value: number; validFrames: number }
  | { status: 'unavailable'; reason: string; validFrames: number };
export interface MotionSummary {
  version: 'motion-2d-v1';
  headDisplacementTorsoRatio: Metric;
  torsoAngleChangeDegrees: Metric;
}
export interface MotionSample { timeSeconds: number; motion: FrameMotion }
export type WindowSummary = { status: 'available'; motion: MotionSummary; sampledFrames: number; baselineSeconds: number }
  | { status: 'unavailable'; reason: string };

export function summarizeWindow(samples: readonly MotionSample[], start: number, end: number, duration: number): WindowSummary {
  if (![start, end, duration].every(Number.isFinite) || duration <= 0 || start < 0 || end > duration || start >= end) {
    return { status: 'unavailable', reason: '시작·끝 시간을 영상 범위 안에서 지정해 주세요. 끝은 시작보다 뒤여야 합니다.' };
  }
  const selected = samples.filter(sample => sample.timeSeconds >= start && sample.timeSeconds <= end);
  const first = selected[0];
  if (!first || selected.length < 3) return { status: 'unavailable', reason: '선택 구간의 분석 프레임이 부족합니다. 구간을 넓혀 주세요.' };
  return { status: 'available', motion: summarizeMotion(selected.map(sample => sample.motion)), sampledFrames: selected.length, baselineSeconds: first.timeSeconds };
}

/** 폭으로 정규화한 영상 평면 좌표. y에도 높이/폭을 적용해 종횡비 왜곡을 피한다. */
export function extractFrameMotion(pose: readonly PosePoint[], width: number, height: number): FrameMotion {
  const empty: FrameMotion = { head: null, torsoLength: null, torsoAngleDegrees: null };
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return empty;
  const point = (index: number) => {
    const p = pose[index];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.visibility)
      || p.visibility < 0.6 || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return null;
    return { x: p.x, y: p.y * height / width };
  };
  const head = point(0);
  const leftShoulder = point(11), rightShoulder = point(12), leftHip = point(23), rightHip = point(24);
  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return { ...empty, head };
  const dx = (leftShoulder.x + rightShoulder.x - leftHip.x - rightHip.x) / 2;
  const dy = (leftShoulder.y + rightShoulder.y - leftHip.y - rightHip.y) / 2;
  const torsoLength = Math.hypot(dx, dy);
  // 극소 몸통이나 뒤집힌 검출은 기준 스케일로 사용하지 않는다. 임시 품질 기준이다.
  if (torsoLength < 0.02 || dy >= 0) return { ...empty, head };
  return { head, torsoLength, torsoAngleDegrees: Math.atan2(dx, -dy) * 180 / Math.PI };
}

/** 전체 촬영 구간의 최대 변화. 어드레스·탑·임팩트 구간 감지는 포함하지 않는다. */
export function summarizeMotion(frames: readonly FrameMotion[]): MotionSummary {
  const baseline = frames[0];
  const minimum = Math.max(3, Math.ceil(frames.length * 0.7));
  const heads = frames.filter(frame => frame.head !== null);
  const angles = frames.flatMap(frame => frame.torsoAngleDegrees === null ? [] : [frame.torsoAngleDegrees]);
  const unavailable = (validFrames: number, reason: string): Metric => ({ status: 'unavailable', validFrames, reason });
  let head: Metric = unavailable(heads.length, '첫 프레임의 코·몸통 기준을 확인하지 못했습니다. 준비 자세에서 촬영해 주세요.');
  let torso: Metric = unavailable(angles.length, '첫 프레임의 몸통 기준을 확인하지 못했습니다.');
  if (baseline?.head && baseline.torsoLength !== null) {
    const origin = baseline.head;
    const scale = baseline.torsoLength;
    head = heads.length < minimum ? unavailable(heads.length, '머리 검출 프레임이 부족합니다. 조명과 가림을 확인해 주세요.') : {
      status: 'available', validFrames: heads.length,
      value: Math.max(...heads.map(frame => frame.head ? Math.hypot(frame.head.x - origin.x, frame.head.y - origin.y) / scale : 0)),
    };
  }
  if (baseline?.torsoAngleDegrees !== null && baseline?.torsoAngleDegrees !== undefined) {
    const initial = baseline.torsoAngleDegrees;
    torso = angles.length < minimum ? unavailable(angles.length, '몸통 검출 프레임이 부족합니다. 어깨·골반을 화면에 담아 주세요.') : {
      status: 'available', validFrames: angles.length, value: Math.max(...angles.map(angle => Math.abs(angle - initial))),
    };
  }
  return { version: 'motion-2d-v1', headDisplacementTorsoRatio: head, torsoAngleChangeDegrees: torso };
}
