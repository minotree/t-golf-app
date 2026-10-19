import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeWindow } from '../src/analysis/motionMetrics.ts';

const frame = x => ({ head: { x, y: 0.1 }, torsoLength: 0.4, torsoAngleDegrees: 0 });
const samples = [0, 0.2, 0.4, 0.6, 0.8, 1].map(timeSeconds => ({ timeSeconds, motion: frame(timeSeconds === 0 ? 0.1 : 0.5) }));

test('구간 밖 준비 동작은 제외하고 선택 첫 프레임을 기준으로 계산', () => {
  const result = summarizeWindow(samples, 0.2, 0.8, 1);
  assert.equal(result.status, 'available');
  assert.equal(result.sampledFrames, 4);
  assert.equal(result.baselineSeconds, 0.2);
  assert.equal(result.motion.headDisplacementTorsoRatio.value, 0);
  assert.equal(summarizeWindow(samples, 0, 1, 1).motion.headDisplacementTorsoRatio.value, 1);
});
test('샘플 사이의 경계는 보간하지 않고 구간 안 첫 샘플 사용', () => {
  const result = summarizeWindow(samples, 0.21, 0.81, 1);
  assert.equal(result.status, 'available');
  assert.equal(result.baselineSeconds, 0.4);
  assert.equal(result.sampledFrames, 3);
});
test('역전·범위 밖·비정상 시간은 거부', () => {
  for (const [start, end, duration] of [[0.5, 0.5, 1], [1, 0, 1], [-1, 1, 1], [0, 2, 1], [NaN, 1, 1], [0, Infinity, 1], [0, 1, 0]]) {
    assert.equal(summarizeWindow(samples, start, end, duration).status, 'unavailable');
  }
});
test('샘플 3개 미만인 구간과 빈 영상은 거부', () => {
  assert.equal(summarizeWindow(samples, 0.01, 0.39, 1).status, 'unavailable');
  assert.equal(summarizeWindow([], 0, 1, 1).status, 'unavailable');
});
test('구간 첫 관절 누락을 나중의 정상 자세로 대체하지 않음', () => {
  const missing = { head: null, torsoLength: null, torsoAngleDegrees: null };
  const result = summarizeWindow(samples.map((sample, index) => index === 1 ? { ...sample, motion: missing } : sample), 0.2, 1, 1);
  assert.equal(result.status, 'available');
  assert.equal(result.motion.headDisplacementTorsoRatio.status, 'unavailable');
  assert.equal(result.motion.torsoAngleChangeDegrees.status, 'unavailable');
});
