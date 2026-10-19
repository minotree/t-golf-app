import { test, expect } from '@playwright/test';
import { readdir } from 'node:fs/promises';
test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.log('PAGE ERROR:', error.name, error.message));
  page.on('requestfailed', request => { if (request.url().startsWith('http://127.')) console.log('FAILED', new URL(request.url()).pathname, request.failure()?.errorText); });
});

async function useSyntheticCamera(page) {
  // OS 가상 카메라가 트랙을 조기에 종료하는 환경을 분리한다. 실제 MediaRecorder·디코더는 사용한다.
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
      const context = canvas.getContext('2d'); let tick = 0;
      const timer = setInterval(() => { context.fillStyle = tick++ % 2 ? '#173c34' : '#234f42'; context.fillRect(0, 0, 320, 240); }, 60);
      const stream = canvas.captureStream(15);
      const track = stream.getVideoTracks()[0]; const stop = track.stop.bind(track);
      track.stop = () => { clearInterval(timer); stop(); };
      return stream;
    };
  });
}

test('작은 화면·설치 manifest·아이콘·기본 접근성', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '카메라 켜기' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest.icons.some(icon => icon.sizes === '192x192')).toBe(true);
  expect((await page.request.get('/icon-180.png')).status()).toBe(200);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
});

test('서비스 워커 앱 화면 캐시와 오프라인 재열기', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    return (await Promise.all(names.map(async name => (await (await caches.open(name)).keys()).map(request => request.url)))).flat();
  });
  expect(cached.length).toBeGreaterThan(5);
  expect(cached.every(url => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
  expect(cached.some(url => /supabase|\.task|blob:/.test(url))).toBe(false);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: '카메라 켜기' })).toBeVisible();
  await expect(page.getByText('오프라인입니다.', { exact: false })).toBeVisible();
});

test('PC 합성 영상 촬영·종료·모델 실패 안내·재촬영', async ({ page, context }) => {
  await useSyntheticCamera(page);
  await context.grantPermissions(['camera']);
  await context.route(/storage\.googleapis\.com|cdn\.jsdelivr\.net/, route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: '카메라 켜기' }).click();
  await expect(page.getByRole('button', { name: '촬영 시작' })).toBeVisible();
  await expect.poll(() => page.locator('video').evaluate(video => video.currentTime)).toBeGreaterThan(0.2);
  await page.getByLabel('촬영 대기', { exact: true }).selectOption('0');
  await page.getByRole('button', { name: '촬영 시작' }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '촬영 종료', exact: false }).click();
  await expect(page.getByRole('button', { name: '다음 스윙 촬영' })).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 분석' })).toBeVisible({ timeout: 25000 });
  await page.getByRole('button', { name: '다음 스윙 촬영' }).click();
  await expect(page.getByRole('button', { name: '카메라 켜기' })).toBeVisible();
});

test('로그인 오류는 구체적으로 표시하고 가입 안내 제공', async ({ page }) => {
  await page.route('**/auth/v1/token**', route => route.fulfill({ status: route.request().method() === 'OPTIONS' ? 204 : 400, headers: { 'x-supabase-api-version': '2024-01-01', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }, contentType: 'application/json', body: route.request().method() === 'OPTIONS' ? '' : JSON.stringify({ code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'Invalid login credentials' }) }));
  await page.goto('/');
  const open = page.getByRole('button', { name: '로그인 / 회원가입', exact: true });
  if (!await open.count()) { test.skip(true, 'Supabase 미설정 빌드'); return; }
  await open.click();
  await page.getByLabel('이메일', { exact: true }).fill('test@example.com');
  await page.getByLabel('비밀번호', { exact: true }).fill('test-password-only');
  await page.locator('button[type=submit]').click();
  await expect(page.getByText('이메일 또는 비밀번호가 맞지 않습니다.', { exact: false })).toBeVisible();
});

test('실제 Worker·WASM·모델 초기화와 빈 이미지 추론', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/');
  const files = await readdir(new URL('../dist/assets/', import.meta.url));
  const workerPath = `/assets/${files.find(file => file.startsWith('poseWorker-'))}`;
  const result = await page.evaluate(async workerPath => {
    const worker = new Worker(workerPath, { type: 'module' });
    try {
      const request = message => new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Worker response timeout')), 90000);
        worker.onmessage = event => { clearTimeout(timer); event.data.type === 'error' ? reject(new Error(event.data.message)) : resolve(event.data); };
        worker.onerror = () => { clearTimeout(timer); reject(new Error('Worker initialization failed')); };
        worker.postMessage(message, message.bitmap ? [message.bitmap] : []);
      });
      await request({ type: 'init' });
      const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
      const context = canvas.getContext('2d'); context.fillStyle = '#173c34'; context.fillRect(0, 0, 320, 240);
      const bitmap = await createImageBitmap(canvas);
      return await request({ type: 'frame', bitmap, timestamp: 1 });
    } finally { worker.terminate(); }
  }, workerPath);
  expect(result.type).toBe('frame');
  expect(result.detected).toBe(false);
  expect(result.usable).toBe(false);
});

test('합성 영상 녹화부터 실제 모델 단건 분석까지 연결', async ({ page }) => {
  test.setTimeout(120000);
  await useSyntheticCamera(page);
  await page.goto('/');
  await page.getByRole('button', { name: '카메라 켜기' }).click();
  await page.getByLabel('촬영 대기', { exact: true }).selectOption('0');
  await page.getByRole('button', { name: '촬영 시작' }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '촬영 종료', exact: false }).click();
  await expect(page.getByText('자세 검출과 실험 지표 계산을 완료했습니다.', { exact: false })).toBeVisible({ timeout: 90000 });
  await expect(page.getByRole('button', { name: '구간 적용', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '다음 스윙 촬영' }).click();
  await expect(page.getByRole('button', { name: '카메라 켜기' })).toBeVisible();
});


test('solo camera selection and countdown cancellation', async ({ page, context }) => {
  await useSyntheticCamera(page);
  await page.addInitScript(() => {
    const getMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    window.cameraRequests = [];
    navigator.mediaDevices.getUserMedia = async constraints => {
      window.cameraRequests.push(constraints.video.facingMode.ideal);
      return getMedia(constraints);
    };
  });
  await context.route(/storage\.googleapis\.com|cdn\.jsdelivr\.net/, route => route.abort());
  await page.goto('/');
  await expect(page.getByLabel('사용 카메라')).toHaveValue('user');
  await page.getByRole('button', { name: '카메라 켜기' }).click();
  await expect(page.getByRole('button', { name: '촬영 시작' })).toBeVisible();
  await page.getByLabel('사용 카메라').selectOption('environment');
  await expect(page.getByRole('button', { name: '촬영 시작' })).toBeVisible();
  expect(await page.evaluate(() => window.cameraRequests)).toEqual(['user', 'environment']);
  await page.getByLabel('촬영 대기', { exact: true }).selectOption('5');
  await page.getByRole('button', { name: '촬영 시작' }).click();
  await expect(page.getByText('5초 후 촬영 시작', { exact: false })).toBeVisible();
  await expect(page.getByLabel('사용 카메라')).toBeDisabled();
  await page.getByRole('button', { name: '카운트다운 취소' }).click();
  await page.waitForTimeout(5200);
  await expect(page.getByRole('button', { name: '촬영 시작' })).toBeVisible();
  await expect(page.getByRole('button', { name: '촬영 종료', exact: false })).toHaveCount(0);
  await page.getByRole('button', { name: '촬영 시작' }).click();
  await expect(page.getByRole('button', { name: '촬영 종료', exact: false })).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '촬영 종료', exact: false }).click();
  await expect(page.getByRole('button', { name: '다음 스윙 촬영' })).toBeVisible();
});
