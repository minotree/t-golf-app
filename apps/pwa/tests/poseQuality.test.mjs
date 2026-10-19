import test from 'node:test';
import assert from 'node:assert/strict';
import { hasVisibleJoints } from '../src/analysis/poseQuality.ts';

const visible = () => Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
test('주요 관절이 화면 안에서 보이는 프레임', () => {
  assert.equal(hasVisibleJoints(visible()), true);
});
test('손목 가림과 발목 화면 이탈은 사용 가능 프레임에서 제외', () => {
  const pose = visible();
  pose[15].visibility = 0.59;
  assert.equal(hasVisibleJoints(pose), false);
  pose[15].visibility = 0.9;
  pose[27].y = 1.01;
  assert.equal(hasVisibleJoints(pose), false);
});
test('관절 누락·비정상 좌표·비정상 가시성은 통과시키지 않음', () => {
  assert.equal(hasVisibleJoints([]), false);
  for (const field of ['x', 'y', 'visibility']) {
    const pose = visible();
    pose[0][field] = NaN;
    assert.equal(hasVisibleJoints(pose), false);
  }
});
