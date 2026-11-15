-- ============================================================
--  미니게임 허브 DB  (Supabase → SQL Editor 에 전체 붙여넣고 Run)
--  여러 번 실행해도 안전하게 만들어져 있다.
--  규칙: docs/SPEC.md 4장(점수), 7장(데이터)
-- ============================================================

-- 1) 표 ------------------------------------------------------

-- 플레이어 (익명 로그인 uid = id)
create table if not exists public.players (
  id          uuid primary key references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 2 and 10),
  updated_at  timestamptz not null default now()
);

-- 게임 설정 (첫 점수가 들어올 때 game.json 값으로 자동 등록)
create table if not exists public.games (
  id           text primary key check (id ~ '^[a-z0-9-]{1,40}$'),
  score_order  text not null default 'desc' check (score_order in ('asc', 'desc')),
  score_limit  bigint not null default 100000000 check (score_limit between 1 and 100000000),
  created_at   timestamptz not null default now()
);

-- 플레이어별·게임별 최고 기록 1개
create table if not exists public.bests (
  game_id      text not null references public.games (id) on delete cascade,
  player_id    uuid not null references public.players (id) on delete cascade,
  score        bigint not null check (score >= 0),
  achieved_at  timestamptz not null default now(),
  primary key (game_id, player_id)
);
create index if not exists bests_game_score_idx on public.bests (game_id, score);
create index if not exists bests_player_idx on public.bests (player_id);

-- 2) 보안 규칙 (RLS) -----------------------------------------
--  읽기: 누구나 / 이름: 본인만 / 점수: submit_score 함수로만 / 삭제: 불가

alter table public.players enable row level security;
alter table public.games   enable row level security;
alter table public.bests   enable row level security;

drop policy if exists "players read"   on public.players;
drop policy if exists "players insert" on public.players;
drop policy if exists "players update" on public.players;
create policy "players read"   on public.players for select using (true);
create policy "players insert" on public.players for insert to authenticated
  with check ((select auth.uid()) = id);
create policy "players update" on public.players for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "games read" on public.games;
create policy "games read" on public.games for select using (true);

drop policy if exists "bests read" on public.bests;
create policy "bests read" on public.bests for select using (true);

-- 3) 점수 저장 함수 ------------------------------------------
--  최고 기록보다 좋을 때만 저장. 결과: { improved, previous, best }

create or replace function public.submit_score(
  p_game_id text, p_score bigint, p_order text default 'desc', p_limit bigint default 100000000
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_game     public.games;
  v_prev     bigint;
  v_improved boolean;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_game_id is null or p_game_id !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'bad game id';
  end if;
  if not exists (select 1 from public.players where id = v_uid) then
    raise exception 'set a nickname first';
  end if;

  insert into public.games (id, score_order, score_limit)
  values (
    p_game_id,
    case when p_order = 'asc' then 'asc' else 'desc' end,
    least(greatest(coalesce(p_limit, 100000000), 1), 100000000)
  )
  on conflict (id) do nothing;

  select * into v_game from public.games where id = p_game_id;

  if p_score is null or p_score < 0 or p_score > v_game.score_limit then
    raise exception 'score out of range';
  end if;

  select score into v_prev from public.bests where game_id = p_game_id and player_id = v_uid;

  v_improved := v_prev is null
    or (v_game.score_order = 'desc' and p_score > v_prev)
    or (v_game.score_order = 'asc'  and p_score < v_prev);

  if v_improved then
    insert into public.bests (game_id, player_id, score, achieved_at)
    values (p_game_id, v_uid, p_score, now())
    on conflict (game_id, player_id)
    do update set score = excluded.score, achieved_at = excluded.achieved_at;
  end if;

  return json_build_object(
    'improved', v_improved,
    'previous', v_prev,
    'best', case when v_improved then p_score else v_prev end
  );
end;
$$;

revoke all on function public.submit_score(text, bigint, text, bigint) from public, anon;
grant execute on function public.submit_score(text, bigint, text, bigint) to authenticated;

-- 4) 게임별 랭킹 (순위 + 포인트) ------------------------------
--  포인트 = 100 × (나보다 기록이 나쁜 사람 수 + 1) ÷ 참여자 수   (소수 첫째 자리)

create or replace view public.game_ranking with (security_invoker = true) as
select
  game_id, player_id, name, score, achieved_at,
  rank()   over (partition by game_id order by k desc)        as rank,
  count(*) over (partition by game_id)                         as players,
  round(
    100.0 * (rank() over (partition by game_id order by k asc))
    / count(*) over (partition by game_id), 1
  ) as points
from (
  select b.game_id, b.player_id, p.name, b.score, b.achieved_at,
         case when g.score_order = 'asc' then -b.score else b.score end as k
  from public.bests b
  join public.players p on p.id = b.player_id
  join public.games   g on g.id = b.game_id
) t;
-- (rank() over k asc) = 나보다 나쁜 사람 수 + 1

grant select on public.game_ranking to anon, authenticated;

-- 5) 종합 랭킹 -----------------------------------------------
--  p_games: 사이트에 보이는 게임 ID 목록 (예제 게임 제외용)
--  동점: 참여 게임 수 많은 순 → 마지막 기록을 먼저 세운 순

create or replace function public.overall_ranking(p_games text[])
returns table (
  rank bigint, player_id uuid, name text, total numeric,
  games_played bigint, last_at timestamptz, per_game jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    rank() over (order by sum(r.points) desc, count(*) desc, max(r.achieved_at) asc),
    r.player_id,
    min(r.name),
    sum(r.points),
    count(*),
    max(r.achieved_at),
    jsonb_object_agg(r.game_id, r.points)
  from public.game_ranking r
  where r.game_id = any (p_games)
  group by r.player_id
  order by 1;
$$;

grant execute on function public.overall_ranking(text[]) to anon, authenticated;

-- ============================================================
--  관리용 SQL (필요할 때 한 줄씩 골라서 실행)
-- ============================================================
--  예제 게임 기록 지우기 (오픈 전에):
--    delete from public.bests where game_id like 'sample-%';
--
--  게임의 점수 방향이나 상한선을 나중에 바꿨을 때 (game.json과 맞추기):
--    update public.games set score_order = 'asc', score_limit = 600000 where id = '게임ID';
--
--  특정 게임 기록 전부 초기화:
--    delete from public.bests where game_id = '게임ID';
--
--  이상한 기록 한 개 지우기 (닉네임으로 찾기):
--    delete from public.bests b using public.players p
--    where b.player_id = p.id and b.game_id = '게임ID' and p.name = '닉네임';
