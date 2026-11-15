-- ============================================================
--  미니게임 허브 DB  (Supabase → SQL Editor 에 전체 붙여넣고 Run)
--  여러 번 실행해도 안전하게 만들어져 있다.
--  규칙: docs/SPEC.md 4장(점수), 6장(로그인), 7장(데이터)
-- ============================================================

create extension if not exists pgcrypto with schema extensions;  -- PIN 암호화용

-- 1) 표 ------------------------------------------------------

-- 플레이어. 닉네임은 겹칠 수 없다 (영문 대소문자 구분 없이)
create table if not exists public.players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 10),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists players_name_key on public.players (lower(name));

-- PIN (암호화해서 저장. 사이트에서는 아무도 못 읽음)
create table if not exists public.player_secrets (
  player_id     uuid primary key references public.players (id) on delete cascade,
  pin_hash      text not null,
  failed        int  not null default 0,   -- 연속으로 틀린 횟수
  locked_until  timestamptz                -- 5번 틀리면 10분 잠금
);

-- 기기(브라우저) ↔ 플레이어 연결
--  기기마다 익명 로그인 uid가 하나씩 생긴다. 닉네임+PIN을 넣으면 그 uid가 플레이어에 연결된다.
--  그래서 휴대폰·컴퓨터 등 여러 기기가 같은 플레이어로 기록된다.
create table if not exists public.player_devices (
  auth_uid   uuid primary key references auth.users (id) on delete cascade,
  player_id  uuid not null references public.players (id) on delete cascade,
  linked_at  timestamptz not null default now()
);
create index if not exists player_devices_player_idx on public.player_devices (player_id);

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
--  읽기: 닉네임·게임·기록은 누구나 / PIN·기기 연결은 아무도 못 읽음
--  쓰기: 전부 아래 함수(login, rename_player, logout, submit_score)로만. 삭제: 관리자만(SQL Editor)

alter table public.players        enable row level security;
alter table public.player_secrets enable row level security;
alter table public.player_devices enable row level security;
alter table public.games          enable row level security;
alter table public.bests          enable row level security;

drop policy if exists "players read" on public.players;
create policy "players read" on public.players for select using (true);

drop policy if exists "games read" on public.games;
create policy "games read" on public.games for select using (true);

drop policy if exists "bests read" on public.bests;
create policy "bests read" on public.bests for select using (true);

revoke all on public.player_secrets, public.player_devices from anon, authenticated;

-- 3) 로그인 · 닉네임 · 점수 함수 ------------------------------

-- 이 기기에 연결된 플레이어 id (없으면 null)
create or replace function public.current_player_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select player_id from public.player_devices where auth_uid = auth.uid();
$$;

-- 내 정보: { id, name } 또는 null
create or replace function public.me()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('id', p.id, 'name', p.name)
  from public.players p
  where p.id = public.current_player_id();
$$;

-- 닉네임 + PIN(숫자 4자리)으로 접속
--  없는 닉네임              → 새로 등록   { status: 'created', id, name }
--  있는 닉네임 + PIN 맞음   → 이어하기    { status: 'login', id, name }
--  PIN 틀림                 →             { status: 'wrong_pin', left }  (5번 틀리면 10분 잠금)
--  잠김                     →             { status: 'locked', seconds }
--  (틀린 횟수가 저장되도록 에러 대신 결과로 돌려준다)
create or replace function public.login(p_name text, p_pin text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_name   text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_player public.players;
  v_sec    public.player_secrets;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if char_length(v_name) not between 2 and 10 then return json_build_object('status', 'bad_name'); end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then return json_build_object('status', 'bad_pin'); end if;

  select * into v_player from public.players where lower(name) = lower(v_name);

  if not found then
    begin
      insert into public.players (name) values (v_name) returning * into v_player;
    exception when unique_violation then
      return json_build_object('status', 'retry');  -- 같은 순간에 다른 사람이 먼저 만듦
    end;
    insert into public.player_secrets (player_id, pin_hash)
    values (v_player.id, extensions.crypt(p_pin, extensions.gen_salt('bf')));
    insert into public.player_devices (auth_uid, player_id) values (v_uid, v_player.id)
    on conflict (auth_uid) do update set player_id = excluded.player_id, linked_at = now();
    return json_build_object('status', 'created', 'id', v_player.id, 'name', v_player.name);
  end if;

  select * into v_sec from public.player_secrets where player_id = v_player.id for update;

  if v_sec.locked_until is not null and v_sec.locked_until > now() then
    return json_build_object('status', 'locked',
      'seconds', ceil(extract(epoch from v_sec.locked_until - now())));
  end if;

  if v_sec.pin_hash = extensions.crypt(p_pin, v_sec.pin_hash) then
    update public.player_secrets set failed = 0, locked_until = null where player_id = v_player.id;
    insert into public.player_devices (auth_uid, player_id) values (v_uid, v_player.id)
    on conflict (auth_uid) do update set player_id = excluded.player_id, linked_at = now();
    return json_build_object('status', 'login', 'id', v_player.id, 'name', v_player.name);
  end if;

  if v_sec.failed + 1 >= 5 then
    update public.player_secrets set failed = 0, locked_until = now() + interval '10 minutes'
    where player_id = v_player.id;
    return json_build_object('status', 'locked', 'seconds', 600);
  end if;
  update public.player_secrets set failed = failed + 1 where player_id = v_player.id;
  return json_build_object('status', 'wrong_pin', 'left', 5 - (v_sec.failed + 1));
end;
$$;

-- 닉네임 바꾸기 (기록·PIN은 그대로)  →  { status: 'ok' | 'taken' | 'bad_name', name }
create or replace function public.rename_player(p_name text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid  uuid := public.current_player_id();
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
begin
  if v_pid is null then raise exception 'log in first'; end if;
  if char_length(v_name) not between 2 and 10 then return json_build_object('status', 'bad_name'); end if;
  begin
    update public.players set name = v_name, updated_at = now() where id = v_pid;
  exception when unique_violation then
    return json_build_object('status', 'taken');
  end;
  return json_build_object('status', 'ok', 'name', v_name);
end;
$$;

-- 이 기기에서 접속 끊기 (기록은 그대로. 닉네임+PIN으로 다시 들어올 수 있음)
create or replace function public.logout()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.player_devices where auth_uid = auth.uid();
$$;

-- 점수 저장: 최고 기록보다 좋을 때만 저장. 결과: { improved, previous, best }
create or replace function public.submit_score(
  p_game_id text, p_score bigint, p_order text default 'desc', p_limit bigint default 100000000
) returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pid      uuid := public.current_player_id();
  v_game     public.games;
  v_prev     bigint;
  v_improved boolean;
begin
  if v_pid is null then
    raise exception 'log in first';
  end if;
  if p_game_id is null or p_game_id !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'bad game id';
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

  select score into v_prev from public.bests where game_id = p_game_id and player_id = v_pid;

  v_improved := v_prev is null
    or (v_game.score_order = 'desc' and p_score > v_prev)
    or (v_game.score_order = 'asc'  and p_score < v_prev);

  if v_improved then
    insert into public.bests (game_id, player_id, score, achieved_at)
    values (p_game_id, v_pid, p_score, now())
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

revoke all on function public.current_player_id()                      from public, anon;
revoke all on function public.me()                                     from public, anon;
revoke all on function public.login(text, text)                        from public, anon;
revoke all on function public.rename_player(text)                      from public, anon;
revoke all on function public.logout()                                 from public, anon;
revoke all on function public.submit_score(text, bigint, text, bigint) from public, anon;
grant execute on function public.current_player_id()                      to authenticated;
grant execute on function public.me()                                     to authenticated;
grant execute on function public.login(text, text)                        to authenticated;
grant execute on function public.rename_player(text)                      to authenticated;
grant execute on function public.logout()                                 to authenticated;
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
--
--  PIN을 잊은 사람 → PIN을 0000으로 초기화 (본인에게 알려주기):
--    update public.player_secrets
--    set pin_hash = extensions.crypt('0000', extensions.gen_salt('bf')), failed = 0, locked_until = null
--    where player_id = (select id from public.players where name = '닉네임');
--
--  잠긴 계정 바로 풀기:
--    update public.player_secrets set failed = 0, locked_until = null
--    where player_id = (select id from public.players where name = '닉네임');
--
--  플레이어 완전히 삭제 (기록도 같이 지워짐):
--    delete from public.players where name = '닉네임';
--
--  전부 지우고 처음부터 다시 (⚠ 모든 기록 삭제. 그 다음 이 파일 전체를 다시 Run):
--    drop table if exists public.bests, public.player_devices, public.player_secrets,
--                         public.players, public.games cascade;
