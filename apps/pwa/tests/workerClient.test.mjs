import test from 'node:test';
import assert from 'node:assert/strict';
import { requestPose } from '../src/analysis/workerClient.ts';

class FakeWorker extends EventTarget {
  sent = [];
  postMessage(request, transfers) { this.sent.push({ request, transfers }); }
  reply(data) { this.dispatchEvent(new MessageEvent('message', { data })); }
}

test('요청 응답과 프레임 소유권 전송', async () => {
  const worker = new FakeWorker();
  const bitmap = { close() {} };
  const promise = requestPose(worker, { type: 'frame', bitmap, timestamp: 10 }, new AbortController().signal);
  assert.deepEqual(worker.sent[0].transfers, [bitmap]);
  worker.reply({ type: 'frame', detected: true, usable: false });
  assert.deepEqual(await promise, { type: 'frame', detected: true, usable: false });
});

test('진행 중 요청을 취소하고 늦게 오는 응답은 무시', async () => {
  const worker = new FakeWorker();
  const controller = new AbortController();
  const promise = requestPose(worker, { type: 'init' }, controller.signal);
  controller.abort();
  await assert.rejects(promise, { name: 'AbortError' });
  worker.reply({ type: 'ready' });
});

test('이미 취소된 프레임은 전송하지 않고 비트맵 해제', async () => {
  const worker = new FakeWorker();
  const controller = new AbortController();
  controller.abort();
  let closed = false;
  await assert.rejects(requestPose(worker, { type: 'frame', bitmap: { close() { closed = true; } }, timestamp: 10 }, controller.signal), { name: 'AbortError' });
  assert.equal(closed, true);
  assert.equal(worker.sent.length, 0);
});

test('Worker 초기화 실패와 실행 오류를 호출자에게 전달', async () => {
  const worker = new FakeWorker();
  const init = requestPose(worker, { type: 'init' }, new AbortController().signal);
  worker.reply({ type: 'error', message: '모델 실패' });
  await assert.rejects(init, /모델 실패/);
  const frame = requestPose(worker, { type: 'init' }, new AbortController().signal);
  worker.dispatchEvent(new Event('error'));
  await assert.rejects(frame, /분석 작업/);
});
