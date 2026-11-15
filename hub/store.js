// 점수 저장소 — 로컬 테스트 모드(localStorage)와 Supabase 모드를 같은 함수로 제공한다.
// 랭킹 계산 규칙은 docs/SPEC.md 4장. Supabase 쪽 계산은 supabase/schema.sql 에 같은 규칙으로 있다.
(function () {
  const cfg = window.MINIHUB_CONFIG || {};
  const online = !!(cfg.supabaseUrl && cfg.supabaseKey);

  const round1 = (x) => Math.round(x * 10) / 10;

  // 같은 규칙으로 순위·포인트를 계산 (로컬 모드 전용)
  // entries: [{player_id, name, score, achieved_at}], order: "asc" | "desc"
  function rankGame(entries, order) {
    const key = (e) => (order === "asc" ? -e.score : e.score); // 클수록 좋음
    const n = entries.length;
    return entries
      .map((e) => {
        const k = key(e);
        const better = entries.filter((o) => key(o) > k).length;
        const worse = entries.filter((o) => key(o) < k).length;
        return { ...e, rank: better + 1, players: n, points: round1((100 * (worse + 1)) / n) };
      })
      .sort((a, b) => a.rank - b.rank || a.achieved_at.localeCompare(b.achieved_at));
  }

  function rankOverall(perGameRows) {
    const byPlayer = new Map();
    for (const r of perGameRows) {
      let p = byPlayer.get(r.player_id);
      if (!p) {
        p = { player_id: r.player_id, name: r.name, total: 0, games_played: 0, last_at: "", per_game: {} };
        byPlayer.set(r.player_id, p);
      }
      p.total = round1(p.total + r.points);
      p.games_played++;
      p.per_game[r.game_id] = r.points;
      if (r.achieved_at > p.last_at) p.last_at = r.achieved_at;
    }
    const list = [...byPlayer.values()].sort(
      (a, b) => b.total - a.total || b.games_played - a.games_played || a.last_at.localeCompare(b.last_at)
    );
    list.forEach((p, i) => (p.rank = i + 1));
    return list;
  }

  // ───────────────── 로컬 테스트 모드 ─────────────────
  function LocalStore() {
    const DB_KEY = "minihub_local_db";
    const UID_KEY = "minihub_local_uid";
    const load = () => {
      try { return JSON.parse(localStorage.getItem(DB_KEY)) || {}; } catch { return {}; }
    };
    const save = (db) => { try { localStorage.setItem(DB_KEY, JSON.stringify(db)); } catch {} };
    let uid = null;

    function db() {
      const d = load();
      d.players ||= {}; d.games ||= {}; d.bests ||= {};
      return d;
    }
    function gameRows(d, gameId) {
      const g = d.games[gameId];
      const rows = Object.entries(d.bests[gameId] || {}).map(([pid, b]) => ({
        game_id: gameId, player_id: pid, name: d.players[pid]?.name || "?", score: b.score, achieved_at: b.at,
      }));
      return rankGame(rows, g?.order || "desc");
    }

    return {
      mode: "local",
      async init() {
        try { uid = localStorage.getItem(UID_KEY); } catch {}
        if (!uid) {
          uid = "local_" + Math.random().toString(36).slice(2, 10);
          try { localStorage.setItem(UID_KEY, uid); } catch {}
        }
      },
      uid: () => uid,
      async getName() { return db().players[uid]?.name || null; },
      async setName(name) {
        const d = db(); d.players[uid] = { name }; save(d);
      },
      async submitScore(game, score) {
        const d = db();
        d.games[game.id] ||= { order: game.scoreOrder, limit: game.scoreLimit };
        const g = d.games[game.id];
        if (score > g.limit) throw new Error("score out of range");
        d.bests[game.id] ||= {};
        const prev = d.bests[game.id][uid]?.score ?? null;
        const improved = prev === null || (g.order === "asc" ? score < prev : score > prev);
        if (improved) d.bests[game.id][uid] = { score, at: new Date().toISOString() };
        save(d);
        return { improved, previous: prev, best: improved ? score : prev };
      },
      async getGameRanking(gameId, limit = 50) { return gameRows(db(), gameId).slice(0, limit); },
      async getMyGameEntry(gameId) { return gameRows(db(), gameId).find((r) => r.player_id === uid) || null; },
      async getMyBests() {
        const d = db(); const out = {};
        for (const [gid, m] of Object.entries(d.bests)) if (m[uid]) out[gid] = m[uid].score;
        return out;
      },
      async getOverall(gameIds, limit = 100) {
        const d = db();
        return rankOverall(gameIds.flatMap((id) => gameRows(d, id))).slice(0, limit);
      },
      async getMyOverall(gameIds) {
        const d = db();
        return rankOverall(gameIds.flatMap((id) => gameRows(d, id))).find((r) => r.player_id === uid) || null;
      },
    };
  }

  // ───────────────── Supabase 모드 ─────────────────
  function SupabaseStore() {
    let sb = null;
    let uid = null;
    const must = ({ data, error }) => {
      if (error) throw error;
      return data;
    };

    return {
      mode: "online",
      async init() {
        if (!window.supabase) throw new Error("Supabase 라이브러리를 불러오지 못했습니다");
        sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
        let { data } = await sb.auth.getSession();
        if (!data.session) {
          const res = await sb.auth.signInAnonymously();
          if (res.error) throw res.error;
          data = res.data;
        }
        uid = data.session.user.id;
      },
      uid: () => uid,
      async getName() {
        const row = must(await sb.from("players").select("name").eq("id", uid).maybeSingle());
        return row?.name || null;
      },
      async setName(name) {
        must(await sb.from("players").upsert({ id: uid, name, updated_at: new Date().toISOString() }));
      },
      async submitScore(game, score) {
        return must(
          await sb.rpc("submit_score", {
            p_game_id: game.id, p_score: score, p_order: game.scoreOrder, p_limit: game.scoreLimit,
          })
        );
      },
      async getGameRanking(gameId, limit = 50) {
        return must(
          await sb.from("game_ranking").select("*").eq("game_id", gameId)
            .order("rank").order("achieved_at").limit(limit)
        );
      },
      async getMyGameEntry(gameId) {
        return must(
          await sb.from("game_ranking").select("*").eq("game_id", gameId).eq("player_id", uid).maybeSingle()
        );
      },
      async getMyBests() {
        const rows = must(await sb.from("bests").select("game_id, score").eq("player_id", uid));
        return Object.fromEntries(rows.map((r) => [r.game_id, r.score]));
      },
      async getOverall(gameIds, limit = 100) {
        return must(await sb.rpc("overall_ranking", { p_games: gameIds }).order("rank").limit(limit));
      },
      async getMyOverall(gameIds) {
        return must(
          await sb.rpc("overall_ranking", { p_games: gameIds }).eq("player_id", uid).maybeSingle()
        );
      },
    };
  }

  window.HubStore = online ? SupabaseStore() : LocalStore();
})();
