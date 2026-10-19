import { createClient } from '@supabase/supabase-js';

const url: unknown = import.meta.env.VITE_SUPABASE_URL;
const key: unknown = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const configured = typeof url === 'string' && /^https:\/\/[^/]+\.supabase\.co\/?$/.test(url)
  && typeof key === 'string' && key.startsWith('sb_publishable_');

// 미설정 시에도 촬영·분석을 허용하며 서버 비밀 키는 받지 않는다.
export const supabase = configured ? createClient(url, key, {
  global: {
    fetch: async (input, options) => {
      const controller = new AbortController();
      const abort = () => controller.abort();
      const upstream = options?.signal;
      upstream?.addEventListener('abort', abort, { once: true });
      if (upstream?.aborted) controller.abort();
      const timer = setTimeout(abort, 20000);
      try { return await fetch(input, { ...options, signal: controller.signal }); }
      finally { clearTimeout(timer); upstream?.removeEventListener('abort', abort); }
    },
  },
}) : null;
