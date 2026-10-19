import test from 'node:test';
import assert from 'node:assert/strict';
import { toResultRow } from '../src/data/resultRecord.ts';

const draft = () => ({ analysisId: 'session-id', club: '7번 아이언', cameraAngle: '정면', duration: 5, start: 1, end: 4, baseline: 1.001, frames: 15, motion: { version: 'motion-2d-v1', headDisplacementTorsoRatio: { status: 'available', value: 0.2, validFrames: 15 }, torsoAngleChangeDegrees: { status: 'unavailable', reason: '가림', validFrames: 0 } } });
test('단위·버전·측정 불가 사유를 저장 계약에 보존', () => {
  const row = toResultRow(draft(), 'result-id', 'owner-id');
  assert.equal(row.head_ratio, 0.2);
  assert.equal(row.torso_degrees, null);
  assert.equal(row.torso_reason, '가림');
  assert.equal(row.calculation_version, 'motion-2d-v1');
  assert.equal(row.analysis_id, 'session-id');
  assert.equal(row.user_id, 'owner-id');
});
test('허용 목록 밖 영상·샘플·이메일·비밀번호는 전송 계약에 포함하지 않음', () => {
  const row = toResultRow({ ...draft(), video: 'private', samples: ['private'], email: 'private', password: 'private' }, 'id', 'user');
  for (const field of ['video', 'samples', 'email', 'password']) assert.equal(field in row, false);
});
test('범위·단위 오류는 저장 전에 거부', () => {
  for (const invalid of [{ start: -1 }, { end: 6 }, { baseline: 0 }, { frames: 2 }, { frames: 3.5 }, { duration: NaN }, { cameraAngle: 'unknown' }]) {
    assert.throws(() => toResultRow({ ...draft(), ...invalid }, 'id', 'user'));
  }
  const value = draft(); value.motion.headDisplacementTorsoRatio.value = Infinity;
  assert.throws(() => toResultRow(value, 'id', 'user'));
});
