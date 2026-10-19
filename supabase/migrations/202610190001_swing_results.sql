-- 결과만 저장한다. 영상·원시 관절 좌표와 사용자 비밀번호는 저장하지 않는다.
create table public.swing_results (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  analysis_id uuid not null,
  created_at timestamptz not null default now(),
  club text not null check (char_length(club) between 1 and 40),
  camera_angle text not null check (camera_angle in ('정면', '측후방')),
  model_version text not null check (model_version = 'pose-full-v1-sdk-0.10.35'),
  calculation_version text not null check (calculation_version = 'motion-2d-v1'),
  duration_seconds double precision not null check (duration_seconds > 0 and duration_seconds <= 31),
  start_seconds double precision not null check (start_seconds >= 0),
  end_seconds double precision not null,
  baseline_seconds double precision not null,
  sampled_frames integer not null check (sampled_frames between 3 and 155),
  head_ratio double precision check (head_ratio >= 0 and head_ratio < 10000),
  head_reason text check (char_length(head_reason) <= 300),
  torso_degrees double precision check (torso_degrees >= 0 and torso_degrees <= 180),
  torso_reason text check (char_length(torso_reason) <= 300),
  check (start_seconds < end_seconds and end_seconds <= duration_seconds),
  check (baseline_seconds >= start_seconds and baseline_seconds <= end_seconds),
  check ((head_ratio is null) <> (head_reason is null)),
  check ((torso_degrees is null) <> (torso_reason is null)),
  unique (user_id, analysis_id, start_seconds, end_seconds)
);
create index swing_results_owner_created on public.swing_results (user_id, created_at desc);
alter table public.swing_results enable row level security;
revoke all on public.swing_results from anon, authenticated;
grant select, insert on public.swing_results to authenticated;
create policy "read own results" on public.swing_results for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "insert own results" on public.swing_results for insert to authenticated
  with check ((select auth.uid()) = user_id);
-- UPDATE/DELETE는 허용하지 않는다. 동일 ID 중복 저장은 기본 키로 막는다.
