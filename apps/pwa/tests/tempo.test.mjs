import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTempo } from '../src/analysis/tempo.ts';

test('수동 시각으로 백스윙·다운스윙·비율 계산', () => {
  assert.deepEqual(calculateTempo(1, 4, 5, 10), { status: 'available', backswingSeconds: 3, downswingSeconds: 1, ratio: 3 });
});
test('시각 순서·범위·유한값 검사', () => {
  for (const args of [[-1, 1, 2, 3], [0, 0, 1, 3], [0, 2, 1, 3], [0, 1, 4, 3], [0, NaN, 2, 3], [0, 1, 1.001, 3]]) assert.equal(calculateTempo(...args).status, 'unavailable');
});
