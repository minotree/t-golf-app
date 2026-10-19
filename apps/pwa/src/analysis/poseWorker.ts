import { PoseLandmarker } from '@mediapipe/tasks-vision';
import { hasVisibleJoints } from './poseQuality';
import { extractFrameMotion } from './motionMetrics';
import type { FrameMotion } from './motionMetrics';

export type PoseRequest = { type: 'init' } | { type: 'frame'; bitmap: ImageBitmap; timestamp: number };
export type PoseReply = { type: 'ready' } | { type: 'frame'; detected: boolean; usable: boolean; motion: FrameMotion } | { type: 'error'; message: string };

let landmarker: PoseLandmarker | undefined;

// Worker 종료로 초기화·추론 자원을 함께 정리하고, 비트맵은 프레임마다 해제한다.
self.onmessage = async (event: MessageEvent<PoseRequest>) => {
  const request = event.data;
  try {
    if (request.type === 'init') {
      const root = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
      landmarker = await PoseLandmarker.createFromOptions({
        wasmLoaderPath: `${root}/vision_wasm_module_internal.js`,
        wasmBinaryPath: `${root}/vision_wasm_module_internal.wasm`,
      }, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
          delegate: 'CPU',
        },
        canvas: new OffscreenCanvas(1, 1),
        runningMode: 'VIDEO', numPoses: 1,
        minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
        outputSegmentationMasks: false,
      });
      self.postMessage({ type: 'ready' } satisfies PoseReply);
    } else {
      if (!landmarker) throw new Error('자세 모델이 준비되지 않았습니다.');
      const pose = landmarker.detectForVideo(request.bitmap, request.timestamp).landmarks[0];
      const motion = extractFrameMotion(pose ?? [], request.bitmap.width, request.bitmap.height);
      self.postMessage({ type: 'frame', detected: !!pose, usable: !!pose && hasVisibleJoints(pose), motion } satisfies PoseReply);
    }
  } catch {
    self.postMessage({ type: 'error', message: request.type === 'init'
      ? '자세 모델을 준비하지 못했습니다. 네트워크와 브라우저 지원을 확인하고 다시 시도해 주세요.'
      : '영상 프레임을 분석하지 못했습니다. 다시 촬영해 주세요.' } satisfies PoseReply);
  } finally {
    if (request.type === 'frame') request.bitmap.close();
  }
};
