import { requestPose } from './workerClient';
import type { MotionSample } from './motionMetrics';

export interface PoseInspection {
  durationSeconds: number;
  sampledFrames: number;
  detectedFrames: number;
  usableFrames: number;
  elapsedMs: number;
  samples: MotionSample[];
}

function waitForVideo(video: HTMLVideoElement, event: 'loadedmetadata' | 'seeked', signal: AbortSignal, action: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      video.removeEventListener(event, done);
      video.removeEventListener('error', failed);
      signal.removeEventListener('abort', aborted);
      error ? reject(error) : resolve();
    };
    const done = () => finish();
    const failed = () => finish(new Error('촬영 영상을 읽지 못했습니다. 다시 촬영해 주세요.'));
    const aborted = () => finish(new DOMException('취소됨', 'AbortError'));
    const timer = window.setTimeout(() => finish(new Error('영상 읽기 시간이 초과되었습니다. 다시 시도해 주세요.')), 15000);
    video.addEventListener(event, done, { once: true });
    video.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted(); else action();
  });
}

/** 기술 검증용 5fps 샘플링. 스윙 타이밍이나 임팩트 측정용이 아니다. */
export async function inspectPose(url: string, signal: AbortSignal, progress: (message: string) => void): Promise<PoseInspection> {
  const started = performance.now();
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  let worker: Worker | undefined;
  try {
    progress('촬영 영상 확인 중…');
    await waitForVideo(video, 'loadedmetadata', signal, () => { video.src = url; video.load(); });
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 31) throw new Error('영상 길이를 확인하지 못했습니다. 30초 이내로 다시 촬영해 주세요.');
    progress('자세 모델 다운로드 중… 처음 실행 시 시간이 걸릴 수 있습니다.');
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
      throw new Error('이 브라우저는 백그라운드 자세 분석을 지원하지 않습니다. Safari 최신 버전에서 확인해 주세요.');
    }
    signal.throwIfAborted();
    worker = new Worker(new URL('./poseWorker.ts', import.meta.url), { type: 'module' });
    await requestPose(worker, { type: 'init' }, signal);
    signal.throwIfAborted();
    const sampledFrames = Math.ceil(video.duration * 5);
    let detectedFrames = 0;
    let usableFrames = 0;
    const samples: MotionSample[] = [];
    for (let index = 0; index < sampledFrames; index++) {
      signal.throwIfAborted();
      const time = Math.min(index / 5 + 0.001, video.duration - 0.001);
      await waitForVideo(video, 'seeked', signal, () => { video.currentTime = time; });
      const bitmap = await createImageBitmap(video);
      const result = await requestPose(worker, { type: 'frame', bitmap, timestamp: time * 1000 }, signal);
      if (result.type !== 'frame') throw new Error('분석 응답이 올바르지 않습니다.');
      if (result.detected) detectedFrames++;
      if (result.usable) usableFrames++;
      samples.push({ timeSeconds: time, motion: result.motion });
      progress(`자세 검출 확인 중… ${Math.round((index + 1) / sampledFrames * 100)}%`);
      // 영상 탐색은 화면에서, 동기 추론은 Worker에서 수행한다.
      await new Promise(resolve => window.setTimeout(resolve, 0));
    }
    signal.throwIfAborted();
    return { durationSeconds: video.duration, sampledFrames, detectedFrames, usableFrames, elapsedMs: performance.now() - started, samples };
  } finally {
    worker?.terminate();
    video.removeAttribute('src');
    video.load();
  }
}
