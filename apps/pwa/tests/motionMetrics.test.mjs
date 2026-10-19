import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFrameMotion, summarizeMotion } from '../src/analysis/motionMetrics.ts';

function pose() {
  const points = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 1 }));
  points[0] = { x: 0.5, y: 0.1, visibility: 1 };
  points[11] = { x: 0.4, y: 0.3, visibility: 1 };
  points[12] = { x: 0.6, y: 0.3, visibility: 1 };
  points[23] = { x: 0.4, y: 0.7, visibility: 1 };
  points[24] = { x: 0.6, y: 0.7, visibility: 1 };
  return points;
}
test('고정 자세에서는 두 지표가 0', () => {
  const frame = extractFrameMotion(pose(), 100, 100);
  const result = summarizeMotion([frame, frame, frame]);
  assert.equal(result.headDisplacementTorsoRatio.value, 0);
  assert.equal(result.torsoAngleChangeDegrees.value, 0);
});
test('머리 이동을 초기 몸통 길이로 정규화', () => {
  const start = extractFrameMotion(pose(), 100, 100);
  const moved = pose(); moved[0].x += 0.1;
  const result = summarizeMotion([start, extractFrameMotion(moved, 100, 100), start]);
  assert.ok(Math.abs(result.headDisplacementTorsoRatio.value - 0.25) < 1e-9);
});
test('같은 픽셀 기하를 세로·가로 영상에서 동일하게 계산', () => {
  const a = pose(); a[11].x += 0.1; a[12].x += 0.1;
  const b = a.map(p => ({ ...p, y: p.y / 2 }));
  const square = extractFrameMotion(a, 100, 100);
  const portrait = extractFrameMotion(b, 100, 200);
  assert.equal(square.torsoAngleDegrees, portrait.torsoAngleDegrees);
  assert.equal(square.torsoLength, portrait.torsoLength);
});
test('몸통축 45도 변화는 최대 변화 45도로 계산', () => {
  const start = extractFrameMotion(pose(), 100, 100);
  const points = pose(); points[11].x = 0.8; points[12].x = 1;
  const tilted = extractFrameMotion(points, 100, 100);
  const result = summarizeMotion([start, tilted, start]);
  assert.ok(Math.abs(result.torsoAngleChangeDegrees.value - 45) < 1e-9);
});
test('첫 프레임 누락·짧은 구간·낮은 커버리지는 수치를 제공하지 않음', () => {
  const valid = extractFrameMotion(pose(), 100, 100);
  const missing = extractFrameMotion([], 100, 100);
  for (const frames of [[missing, valid, valid, valid], [valid, valid], [valid, missing, missing, valid, valid]]) {
    const result = summarizeMotion(frames);
    assert.equal(result.headDisplacementTorsoRatio.status, 'unavailable');
    assert.equal(result.torsoAngleChangeDegrees.status, 'unavailable');
  }
});
test('코 가림은 머리만, 어깨 가림은 몸통 기준을 무효화', () => {
  const points = pose(); points[0].visibility = 0.2;
  const frame = extractFrameMotion(points, 100, 100);
  const result = summarizeMotion([frame, frame, frame]);
  assert.equal(result.headDisplacementTorsoRatio.status, 'unavailable');
  assert.equal(result.torsoAngleChangeDegrees.status, 'available');
  points[11].visibility = 0.2;
  assert.equal(extractFrameMotion(points, 100, 100).torsoAngleDegrees, null);
});
test('비정상 입력과 퇴화 몸통에서 각도·스케일 생성하지 않음', () => {
  assert.equal(extractFrameMotion(pose(), 0, 100).torsoLength, null);
  const points = pose(); points[11].y = points[12].y = 0.7;
  assert.equal(extractFrameMotion(points, 100, 100).torsoLength, null);
  points[0].x = NaN;
  assert.equal(extractFrameMotion(points, 100, 100).head, null);
});
test('추정 어깨축 회전과 각도 경계 연속성', () => {
  const frames = [179, -179, 178].map(shoulderYawDegrees => ({ ...extractFrameMotion(pose(), 100, 100), shoulderYawDegrees }));
  assert.equal(summarizeMotion(frames).shoulderAxisChangeDegrees.value, 2);
});
test('어깨 world 좌표 90도 방향 변화, world 누락 시 측정 불가', () => {
  const world = pose().map(p => ({ ...p, z: 0 }));
  world[11].x = -0.2; world[12].x = 0.2;
  const first = extractFrameMotion(pose(), 100, 100, world);
  world[11].x = world[12].x = 0; world[11].z = -0.2; world[12].z = 0.2;
  const rotated = extractFrameMotion(pose(), 100, 100, world);
  assert.equal(summarizeMotion([first, rotated, first]).shoulderAxisChangeDegrees.value, 90);
  const missing = extractFrameMotion(pose(), 100, 100);
  assert.equal(summarizeMotion([missing, rotated, first]).shoulderAxisChangeDegrees.status, 'unavailable');
});
