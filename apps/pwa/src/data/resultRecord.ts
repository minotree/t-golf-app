import type { MotionSummary } from '../analysis/motionMetrics';

export interface ResultDraft {
  analysisId: string;
  club: string; cameraAngle: string; duration: number; start: number; end: number;
  baseline: number; frames: number; motion: MotionSummary;
}

/** 영상·샘플을 받지 않는 허용 목록으로 전송 계약을 제한한다. */
export function toResultRow(draft: ResultDraft, id: string, userId: string) {
  const { headDisplacementTorsoRatio: head, torsoAngleChangeDegrees: torso } = draft.motion;
  if (!draft.club.trim() || draft.club.length > 40 || !['정면', '측후방'].includes(draft.cameraAngle)
    || ![draft.duration, draft.start, draft.end, draft.baseline, draft.frames].every(Number.isFinite)
    || draft.duration <= 0 || draft.duration > 31 || draft.start < 0 || draft.start >= draft.end
    || draft.end > draft.duration || draft.baseline < draft.start || draft.baseline > draft.end
    || !Number.isInteger(draft.frames) || draft.frames < 3 || draft.frames > 155
    || (head.status === 'available' && (!Number.isFinite(head.value) || head.value < 0 || head.value >= 10000))
    || (torso.status === 'available' && (!Number.isFinite(torso.value) || torso.value < 0 || torso.value > 180))) {
    throw new Error('저장할 분석 결과의 범위를 확인해 주세요.');
  }
  return {
    id, user_id: userId, analysis_id: draft.analysisId, club: draft.club, camera_angle: draft.cameraAngle,
    model_version: 'pose-full-v1-sdk-0.10.35', calculation_version: draft.motion.version,
    duration_seconds: draft.duration, start_seconds: draft.start, end_seconds: draft.end,
    baseline_seconds: draft.baseline, sampled_frames: draft.frames,
    head_ratio: head.status === 'available' ? head.value : null,
    head_reason: head.status === 'unavailable' ? head.reason : null,
    torso_degrees: torso.status === 'available' ? torso.value : null,
    torso_reason: torso.status === 'unavailable' ? torso.reason : null,
  };
}
