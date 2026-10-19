import type { PoseReply, PoseRequest } from './poseWorker';

/** 프레임을 한 건씩 전송하여 영상 전체 비트맵이 메모리에 쌓이지 않게 한다. */
export function requestPose(worker: Worker, request: PoseRequest, signal: AbortSignal): Promise<PoseReply> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      worker.removeEventListener('message', message);
      worker.removeEventListener('error', error);
      worker.removeEventListener('messageerror', error);
      signal.removeEventListener('abort', abort);
    };
    const fail = (reason: Error) => { cleanup(); reject(reason); };
    const abort = () => fail(new DOMException('취소됨', 'AbortError'));
    const error = () => fail(new Error('분석 작업을 실행하지 못했습니다. Safari 최신 버전에서 다시 시도해 주세요.'));
    const message = (event: MessageEvent<PoseReply>) => {
      cleanup();
      if (event.data.type === 'error') reject(new Error(event.data.message));
      else resolve(event.data);
    };
    const timer = setTimeout(() => fail(new Error('자세 분석 응답 시간이 초과되었습니다. 다시 시도해 주세요.')), request.type === 'init' ? 90000 : 15000);
    worker.addEventListener('message', message);
    worker.addEventListener('error', error);
    worker.addEventListener('messageerror', error);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { if (request.type === 'frame') request.bitmap.close(); abort(); return; }
    try { worker.postMessage(request, request.type === 'frame' ? [request.bitmap] : []); }
    catch { if (request.type === 'frame') request.bitmap.close(); error(); }
  });
}
