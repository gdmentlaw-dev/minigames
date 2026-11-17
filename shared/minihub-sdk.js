// minihub-sdk.js v4 — 게임 점수·진행 상황을 랭킹 DB에 직접 기록하는 공용 파일
// ⚠ 게임 담당자는 수정 금지. 아래 CONFIG만 허브 담당자가 채운다.
// 사용법: docs/SPEC.md 5장
//
//   <script src="../../shared/minihub-sdk.js"></script>
//   MiniHub.init("게임ID");                 // 접속 전이면 닉네임+PIN 입력창을 띄움
//   MiniHub.onReady(player => ...);         // player = { id, name }
//   const r = await MiniHub.submitScore(n); // 0 이상 정수. r = { improved, previous, best, rank, players }
//   await MiniHub.save({ stage: 3 });       // 진행 저장 (선택)
//   const s = await MiniHub.load();         // 진행 불러오기 (선택) → 저장값 또는 null
//
(function () {
  if (window.MiniHub) return;

  // ===== 허브 담당자 설정 (Supabase → Project Settings → API) =====
  // 둘 다 비어 있으면 "로컬 테스트 모드": 점수가 이 브라우저에만 저장된다.
  const CONFIG = {
    siteTitle: "미니게임",
    supabaseUrl: "https://lrwqrbmsehyevepqlcwp.supabase.co",
    supabaseKey: "sb_publishable_lORBdTR6LW_Bjf1shr4Z0w_KPIjrLOO", // publishable 키 또는 legacy anon 키 (⚠ service_role / secret 키 금지)
  };
  // ================================================================

  const SUPABASE_LIB = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js";
  const DEFAULT_LIMIT = 100000000;
  const online = !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);

  // 사이트 루트 주소 (이 파일이 /shared/ 안에 있으므로 한 단계 위)
  const SCRIPT_SRC = (document.currentScript && document.currentScript.src) || location.href;
  const ROOT = new URL("../", SCRIPT_SRC).href;

  // ───────────── 이사 안내: 옛 주소(github.io)로 들어오면 새 주소로 안내 ─────────────
  const NEW_SITE = "https://minigame63.pages.dev";
  if (/\.github\.io$/i.test(location.hostname)) {
    const rest = location.pathname.slice(new URL(ROOT).pathname.length);
    const target = NEW_SITE + "/" + rest + location.search + location.hash;
    const show = () => {
      const d = document.createElement("div");
      d.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:#16132e;color:#f4f2ff;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;font:16px/1.6 Pretendard,system-ui,sans-serif";
      d.innerHTML =
        '<div style="max-width:360px"><div style="font-size:40px">📦</div>' +
        '<h2 style="margin:8px 0">미니게임이 새 주소로 이사했어요!</h2>' +
        '<p style="margin:0 0 20px;opacity:.85">앞으로는 새 주소에서 즐겨 주세요.<br>닉네임과 PIN을 다시 입력하면<br>기존 기록은 그대로 이어져요.</p>' +
        '<a href="' + esc(target) + '" style="display:inline-block;background:#ffc83d;color:#16132e;font-weight:700;padding:12px 24px;border-radius:12px;text-decoration:none">새 주소로 이동</a>' +
        '<p style="margin:16px 0 0;font-size:13px;opacity:.6">' + esc(NEW_SITE.replace("https://", "")) + "</p></div>";
      document.body.appendChild(d);
    };
    if (document.body) show(); else document.addEventListener("DOMContentLoaded", show);
  }

  const round1 = (x) => Math.round(x * 10) / 10;
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtScore = (score, unit) =>
    score === null || score === undefined ? "-" : Number(score).toLocaleString("ko-KR") + (unit || "");

  // ───────────── 랭킹 계산 (로컬 모드용. DB는 supabase/schema.sql 에 같은 규칙) ─────────────
  function rankGame(entries, order) {
    const key = (e) => (order === "asc" ? -e.score : e.score);
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
  function rankOverall(rows) {
    const m = new Map();
    for (const r of rows) {
      let p = m.get(r.player_id);
      if (!p) m.set(r.player_id, (p = { player_id: r.player_id, name: r.name, total: 0, games_played: 0, last_at: "", per_game: {} }));
      p.total = round1(p.total + r.points);
      p.games_played++;
      p.per_game[r.game_id] = r.points;
      if (r.achieved_at > p.last_at) p.last_at = r.achieved_at;
    }
    const list = [...m.values()].sort(
      (a, b) => b.total - a.total || b.games_played - a.games_played || a.last_at.localeCompare(b.last_at)
    );
    list.forEach((p, i) => (p.rank = i + 1));
    return list;
  }

  // ───────────── 저장소: 로컬 테스트 모드 ─────────────
  // 로그인 규칙 (DB의 login 함수와 같음)
  const cleanName = (s) => String(s ?? "").trim().replace(/\s+/g, " ");
  const validName = (s) => s.length >= 2 && s.length <= 10;
  const validPin = (s) => /^[0-9]{4}$/.test(s);
  const MAX_FAIL = 5, LOCK_MS = 10 * 60 * 1000;

  // ───────────── 저장소: 로컬 테스트 모드 (이 브라우저 안에서 온라인 DB를 흉내냄) ─────────────
  function LocalStore() {
    const DB_KEY = "minihub_local_db", UID_KEY = "minihub_local_uid";
    let uid = null; // 기기 id (온라인의 익명 로그인 uid 역할)
    const db = () => {
      let d = {};
      try { d = JSON.parse(localStorage.getItem(DB_KEY)) || {}; } catch {}
      d.players ||= {}; d.games ||= {}; d.bests ||= {}; d.devices ||= {}; d.saves ||= {};
      return d;
    };
    const save = (d) => { try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch {} };
    const pidOf = (d) => d.devices[uid] || null;
    const rows = (d, gid) =>
      rankGame(
        Object.entries(d.bests[gid] || {}).map(([pid, b]) => ({
          game_id: gid, player_id: pid, name: d.players[pid]?.name || "?", score: b.score, achieved_at: b.at,
        })),
        d.games[gid]?.order || "desc"
      );
    return {
      mode: "local",
      async init() {
        try { uid = localStorage.getItem(UID_KEY); } catch {}
        if (!uid) {
          uid = "local_" + Math.random().toString(36).slice(2, 10);
          try { localStorage.setItem(UID_KEY, uid); } catch {}
        }
      },
      async me() {
        const d = db(), pid = pidOf(d);
        return pid && d.players[pid] ? { id: pid, name: d.players[pid].name } : null;
      },
      async login(rawName, pin) {
        const name = cleanName(rawName);
        if (!validName(name)) return { status: "bad_name" };
        if (!validPin(pin)) return { status: "bad_pin" };
        const d = db();
        const found = Object.entries(d.players).find(([, p]) => p.name.toLowerCase() === name.toLowerCase());
        if (!found) {
          const pid = "p_" + Math.random().toString(36).slice(2, 10);
          d.players[pid] = { name, pin, failed: 0, lockedUntil: 0 }; // 로컬 테스트용이라 PIN을 그대로 저장
          d.devices[uid] = pid;
          save(d);
          return { status: "created", id: pid, name };
        }
        const [pid, p] = found;
        if (p.lockedUntil > Date.now()) return { status: "locked", seconds: Math.ceil((p.lockedUntil - Date.now()) / 1000) };
        if (p.pin === pin) {
          p.failed = 0; p.lockedUntil = 0; d.devices[uid] = pid; save(d);
          return { status: "login", id: pid, name: p.name };
        }
        p.failed = (p.failed || 0) + 1;
        if (p.failed >= MAX_FAIL) { p.failed = 0; p.lockedUntil = Date.now() + LOCK_MS; save(d); return { status: "locked", seconds: LOCK_MS / 1000 }; }
        save(d);
        return { status: "wrong_pin", left: MAX_FAIL - p.failed };
      },
      async rename(rawName) {
        const name = cleanName(rawName);
        if (!validName(name)) return { status: "bad_name" };
        const d = db(), pid = pidOf(d);
        if (!pid) throw new Error("log in first");
        if (Object.entries(d.players).some(([id, p]) => id !== pid && p.name.toLowerCase() === name.toLowerCase())) return { status: "taken" };
        d.players[pid].name = name; save(d);
        return { status: "ok", name };
      },
      async logout() { const d = db(); delete d.devices[uid]; save(d); },
      async loadSave(gid) { const d = db(), pid = pidOf(d); return (pid && d.saves[pid]?.[gid]) ?? null; },
      async saveGame(gid, data) {
        const d = db(), pid = pidOf(d);
        if (!pid) throw new Error("log in first");
        d.saves[pid] ||= {};
        if (data === null) delete d.saves[pid][gid]; else d.saves[pid][gid] = data;
        save(d);
      },
      async submitScore(game, score) {
        const d = db(), pid = pidOf(d);
        if (!pid) throw new Error("log in first");
        d.games[game.id] ||= { order: game.scoreOrder, limit: game.scoreLimit };
        const g = d.games[game.id];
        if (score > g.limit) throw new Error("score out of range");
        d.bests[game.id] ||= {};
        const prev = d.bests[game.id][pid]?.score ?? null;
        const improved = prev === null || (g.order === "asc" ? score < prev : score > prev);
        if (improved) d.bests[game.id][pid] = { score, at: new Date().toISOString() };
        save(d);
        return { improved, previous: prev, best: improved ? score : prev };
      },
      async getGameRanking(gid, limit = 100) { return rows(db(), gid).slice(0, limit); },
      async getMyGameEntry(gid) { const d = db(); return rows(d, gid).find((r) => r.player_id === pidOf(d)) || null; },
      async getMyBests() {
        const d = db(), pid = pidOf(d), out = {};
        for (const [gid, m] of Object.entries(d.bests)) if (pid && m[pid]) out[gid] = m[pid].score;
        return out;
      },
      async getOverall(ids, limit = 100) { const d = db(); return rankOverall(ids.flatMap((id) => rows(d, id))).slice(0, limit); },
      async getMyOverall(ids) { const d = db(); return rankOverall(ids.flatMap((id) => rows(d, id))).find((r) => r.player_id === pidOf(d)) || null; },
      async getGameRankingPrev() { return null; }, // 로컬 모드는 어제 순위 이력이 없다
      async getOverallPrev() { return null; },
    };
  }

  // ───────────── 저장소: Supabase (온라인) ─────────────
  function loadScript(src) {
    return new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = ok;
      s.onerror = () => fail(new Error("라이브러리를 불러오지 못했습니다: " + src));
      document.head.appendChild(s);
    });
  }
  function SupabaseStore() {
    let sb = null, pid = null; // pid = 이 기기에 연결된 플레이어 id
    const must = ({ data, error }) => { if (error) throw error; return data; };
    const keep = (r) => { if (r && r.id) pid = r.id; return r; };
    return {
      mode: "online",
      async init() {
        if (!window.supabase) await loadScript(SUPABASE_LIB);
        sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
        let { data } = await sb.auth.getSession();
        if (!data.session) {
          const res = await sb.auth.signInAnonymously();
          if (res.error) throw res.error;
          data = res.data;
        }
      },
      async me() { pid = null; return keep(must(await sb.rpc("me"))) || null; },
      async login(name, pin) { return keep(must(await sb.rpc("login", { p_name: name, p_pin: pin }))); },
      async rename(name) { return must(await sb.rpc("rename_player", { p_name: name })); },
      async logout() { must(await sb.rpc("logout")); pid = null; },
      async loadSave(gid) { return must(await sb.rpc("load_save", { p_game_id: gid })) ?? null; },
      async saveGame(gid, data) { must(await sb.rpc("save_game", { p_game_id: gid, p_data: data })); },
      async submitScore(game, score) {
        return must(await sb.rpc("submit_score", {
          p_game_id: game.id, p_score: score, p_order: game.scoreOrder, p_limit: game.scoreLimit,
        }));
      },
      async getGameRanking(gid, limit = 100) {
        return must(await sb.from("game_ranking").select("*").eq("game_id", gid).order("rank").order("achieved_at").limit(limit));
      },
      async getMyGameEntry(gid) {
        if (!pid) return null;
        return must(await sb.from("game_ranking").select("*").eq("game_id", gid).eq("player_id", pid).maybeSingle());
      },
      async getMyBests() {
        if (!pid) return {};
        const r = must(await sb.from("bests").select("game_id, score").eq("player_id", pid));
        return Object.fromEntries(r.map((x) => [x.game_id, x.score]));
      },
      async getOverall(ids, limit = 100) { return must(await sb.rpc("overall_ranking", { p_games: ids }).order("rank").limit(limit)); },
      async getMyOverall(ids) {
        if (!pid) return null;
        return must(await sb.rpc("overall_ranking", { p_games: ids }).eq("player_id", pid).maybeSingle());
      },
      // 직전(가장 최근 기록 갱신 바로 전) 순위. DB에 6번 항목(직전 순위)이 아직 없으면 오류 → 호출한 쪽에서 무시
      async getGameRankingPrev(gid) {
        return must(await sb.rpc("game_ranking_prev", { p_game: gid }).limit(1000));
      },
      async getOverallPrev(ids) {
        return must(await sb.rpc("overall_ranking_prev", { p_games: ids }).limit(1000));
      },
    };
  }

  const store = online ? SupabaseStore() : LocalStore();

  // ───────────── game.json 읽기 ─────────────
  async function loadGame(id) {
    if (!/^[a-z0-9-]{1,40}$/.test(id)) { console.warn("[MiniHub] 게임 ID 형식이 잘못됐습니다:", id); return null; }
    try {
      const res = await fetch(new URL(`games/${id}/game.json`, ROOT), { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const g = await res.json();
      if (g.id !== id) console.warn(`[MiniHub] games/${id}/game.json 의 id(${g.id})가 폴더 이름과 다릅니다`);
      const lim = Math.floor(Number(g.scoreLimit ?? DEFAULT_LIMIT));
      return {
        id,
        title: g.title || id,
        author: g.author || "",
        description: g.description || "",
        controls: g.controls || "",
        scoreOrder: g.scoreOrder === "asc" ? "asc" : "desc",
        scoreUnit: g.scoreUnit || "점",
        scoreLimit: lim > 0 && lim <= DEFAULT_LIMIT ? lim : DEFAULT_LIMIT,
        url: new URL(`games/${id}/${g.entry || "index.html"}`, ROOT).href,
        thumbnail: new URL(`games/${id}/${g.thumbnail || "thumbnail.png"}`, ROOT).href,
        hidden: !!g.hidden,
      };
    } catch (e) {
      console.warn(`[MiniHub] games/${id}/game.json 을 읽지 못했습니다`, e);
      return null;
    }
  }

  async function listGames({ includeHidden = false } = {}) {
    let ids = [];
    try { ids = await (await fetch(new URL("games/index.json", ROOT), { cache: "no-cache" })).json(); }
    catch (e) { console.warn("[MiniHub] games/index.json 을 읽지 못했습니다", e); }
    const games = (await Promise.all([...new Set(ids)].map(loadGame))).filter(Boolean);
    return games.filter((g) => includeHidden || !g.hidden);
  }

  // ───────────── 화면 (닉네임 창, 알림) — 게임 CSS와 섞이지 않게 Shadow DOM 사용 ─────────────
  let ui = null;
  function getUI() {
    if (ui) return ui;
    const host = document.createElement("div");
    host.id = "minihub-ui";
    host.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483647;";
    if (document.documentElement.dataset.minihubTheme === "light") host.dataset.theme = "light";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>
      :host{all:initial;
        --font:Pretendard,system-ui,-apple-system,"Segoe UI",sans-serif; --head:var(--font);
        --card:#231f45; --text:#f4f2ff; --sub:#b9b3e6; --field:#16132e; --line:#3a3470; --focus:#7c6cf0;
        --btn:#ffc83d; --btn-text:#16132e; --ghost:#2d2858; --err:#ff6b6b; --back:rgba(0,0,0,.6);
        --toast:#2d2858; --toast-line:#7c6cf0; --hi:#ffc83d; --r:20px; --r-in:12px; --shadow:rgba(0,0,0,.4)}
      /* 밝은 화면(랭킹 메인페이지)용: <html data-minihub-theme="light"> */
      :host([data-theme=light]){
        --font:Lora,"Noto Serif KR",serif; --head:"Cormorant Garamond","Noto Serif KR",serif;
        --card:#f3f2f2; --text:#201f1d; --sub:#605d5d; --field:#fff; --line:rgba(32,31,29,.22); --focus:#b68235;
        --btn:#fff3e4; --btn-text:#7d5411; --ghost:transparent; --err:#b0443a; --back:rgba(45,43,43,.42);
        --toast:#f3f2f2; --toast-line:#b68235; --hi:#7d5411; --r:4px; --r-in:4px; --shadow:rgba(45,43,43,.22)}
      *{box-sizing:border-box;font-family:var(--font)}
      .bg{position:fixed;inset:0;background:var(--back);display:flex;align-items:center;justify-content:center;padding:16px;pointer-events:auto}
      form{background:var(--card);color:var(--text);border-radius:var(--r);padding:24px;width:min(100%,340px);display:flex;flex-direction:column;gap:10px}
      :host([data-theme=light]) form{border:1px solid #b68235;box-shadow:0 12px 32px var(--shadow);word-break:keep-all}
      h2{margin:0;font-size:20px;font-family:var(--head)} p{margin:0;font-size:14px;color:var(--sub)}
      :host([data-theme=light]) h2{font-size:26px;font-weight:600;line-height:1.15}
      input{font:inherit;font-size:18px;padding:12px 14px;border-radius:var(--r-in);border:1px solid var(--line);background:var(--field);color:var(--text);outline:none}
      input:focus{border-color:var(--focus)}
      .row{display:flex;gap:8px;justify-content:flex-end;margin-top:6px}
      button{border:0;border-radius:var(--r-in);padding:12px 18px;font:inherit;font-weight:800;cursor:pointer;background:var(--btn);color:var(--btn-text)}
      button.ghost{background:var(--ghost);color:var(--text)}
      :host([data-theme=light]) button{font-family:var(--head);font-weight:600;font-size:16px;border:1px solid #b68235;min-height:44px}
      :host([data-theme=light]) button:hover{background:#ffe3bf}
      :host([data-theme=light]) button.ghost{border-color:var(--line)}
      :host([data-theme=light]) button.ghost:hover{background:rgba(32,31,29,.07)}
      .err{color:var(--err);line-height:1.5} p b{color:var(--text)}
      label{display:block;font-size:15px;font-weight:700}
      label input{display:block;width:100%;margin-top:6px}
      label small{font-weight:400;color:var(--sub);margin-left:4px}
      input[name=pin]{letter-spacing:.4em}
      button.wide{width:100%;text-align:left}
      button:disabled{opacity:.6;cursor:default}
      .toasts{position:fixed;left:50%;top:12px;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;width:min(92vw,360px)}
      .toast{background:var(--toast);color:var(--text);border:1px solid var(--toast-line);border-radius:calc(var(--r-in) + 2px);padding:10px 14px;font-size:14px;
             box-shadow:0 8px 24px var(--shadow);transition:opacity .4s,transform .4s}
      .toast.out{opacity:0;transform:translateY(-8px)} .toast b{color:var(--hi)}
    </style><div class="toasts"></div>`;
    (document.body || document.documentElement).appendChild(host);
    ui = root;
    return ui;
  }

  function toast(html, ms = 3500) {
    const box = getUI().querySelector(".toasts");
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = html;
    box.appendChild(el);
    setTimeout(() => el.classList.add("out"), ms);
    setTimeout(() => el.remove(), ms + 400);
  }

  // 공통 대화상자. onSubmit(form, fail)이 값을 돌려주면 닫히고, fail(msg)로 에러 표시. 취소 → null
  function dialog(inner, { cancel = true, onSubmit, onReady } = {}) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "bg";
      wrap.innerHTML = `<form autocomplete="off" novalidate>${inner}
          <p class="err" hidden></p>
          <div class="row">${cancel ? '<button type="button" class="ghost" data-x>취소</button>' : ""}<button data-ok>확인</button></div>
        </form>`;
      getUI().appendChild(wrap);
      const form = wrap.querySelector("form"), err = form.querySelector(".err");
      // 입력 중 키·터치가 게임으로 새지 않게
      ["keydown", "keyup", "keypress", "pointerdown", "touchstart"].forEach((t) =>
        wrap.addEventListener(t, (e) => e.stopPropagation())
      );
      const close = (v) => { wrap.remove(); resolve(v); };
      const fail = (msg) => { err.innerHTML = msg; err.hidden = false; };
      const busy = (on) => form.querySelectorAll("button").forEach((b) => (b.disabled = on));
      wrap.querySelector("[data-x]")?.addEventListener("click", () => close(null));
      setTimeout(() => form.querySelector("input")?.focus(), 50);
      onReady?.(form, close);
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        err.hidden = true;
        busy(true);
        try {
          const v = await onSubmit(form, fail);
          if (v !== undefined) return close(v);
        } catch (ex) {
          console.error(ex);
          fail("저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요");
        }
        busy(false);
      });
    });
  }

  // 닉네임 + PIN 접속 창 → 성공하면 { id, name }, 취소하면 null
  function askLogin({ cancel = false } = {}) {
    return dialog(
      `<h2>${cancel ? "다른 닉네임으로 접속" : "반가워요! 👋"}</h2>
       <p><b>처음이면</b> 닉네임과 PIN을 새로 정하세요.<br><b>다른 기기에서 했던 사람은</b> 그때 쓴 닉네임과 PIN을 넣으면 기록이 이어져요.</p>
       <label>닉네임 <small>2~10자</small><input name="nick" maxlength="10" placeholder="닉네임"></label>
       <label>PIN <small>숫자 4자리 · 꼭 기억하세요</small>
         <input name="pin" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="••••"></label>`,
      {
        cancel,
        async onSubmit(form, fail) {
          const name = cleanName(form.nick.value), pin = form.pin.value.trim();
          if (!validName(name)) return fail("닉네임은 2~10자로 입력해주세요");
          if (!validPin(pin)) return fail("PIN은 숫자 4자리로 입력해주세요");
          const r = await store.login(name, pin);
          switch (r && r.status) {
            case "created":
              toast(`✅ <b>${esc(r.name)}</b>님 등록 완료! PIN을 꼭 기억해 두세요`, 5000);
              return { id: r.id, name: r.name };
            case "login":
              toast(`👋 <b>${esc(r.name)}</b>님 다시 오셨네요! 기록이 이어져요`, 4000);
              return { id: r.id, name: r.name };
            case "wrong_pin":
              form.pin.value = "";
              return fail(`이미 있는 닉네임인데 PIN이 맞지 않아요 (남은 기회 ${r.left}번)<br>처음 오셨다면 다른 닉네임을 써주세요`);
            case "locked":
              return fail(`PIN을 여러 번 틀려서 잠겼어요. ${Math.ceil(r.seconds / 60)}분 뒤에 다시 해주세요<br>PIN을 잊었다면 운영자에게 말해주세요`);
            case "retry":
              return fail("잠시 후 다시 눌러주세요");
            default:
              return fail("닉네임이나 PIN 형식이 맞지 않아요");
          }
        },
      }
    );
  }

  // 닉네임 바꾸기 창 → 새 이름, 취소하면 null
  function askRename(current) {
    return dialog(
      `<h2>닉네임 바꾸기</h2>
       <p>기록과 PIN은 그대로 유지돼요</p>
       <label>새 닉네임 <small>2~10자</small><input name="nick" maxlength="10" value="${esc(current)}"></label>`,
      {
        async onSubmit(form, fail) {
          const name = cleanName(form.nick.value);
          if (!validName(name)) return fail("닉네임은 2~10자로 입력해주세요");
          if (name === current) return name;
          const r = await store.rename(name);
          if (r.status === "ok") return r.name;
          if (r.status === "taken") return fail("이미 다른 사람이 쓰는 닉네임이에요");
          return fail("닉네임 형식이 맞지 않아요");
        },
      }
    );
  }

  // 내 정보 메뉴: 닉네임 바꾸기 / 다른 닉네임으로 접속
  function accountMenu(current) {
    return dialog(
      `<h2>👤 ${esc(current)}</h2>
       <p>다른 기기에서도 이 닉네임과 PIN을 넣으면 같은 기록으로 이어져요</p>
       <button type="button" class="ghost wide" data-act="rename">✏️ 닉네임 바꾸기</button>
       <button type="button" class="ghost wide" data-act="switch">🔁 다른 닉네임으로 접속</button>`,
      {
        onReady(form, close) {
          form.querySelector("[data-ok]").remove();
          form.querySelector("[data-x]").textContent = "닫기";
          form.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => close(b.dataset.act)));
        },
        onSubmit() {},
      }
    );
  }

  // ───────────── 공개 API ─────────────
  let gameId = null, game = null, player = null, readyPromise = null, readyCbs = [], queue = Promise.resolve();

  function domReady() {
    return document.readyState === "loading"
      ? new Promise((r) => document.addEventListener("DOMContentLoaded", r, { once: true }))
      : Promise.resolve();
  }

  function init(id, opts = {}) {
    if (readyPromise) return readyPromise;
    gameId = id ? String(id) : null;
    readyPromise = (async () => {
      await domReady();
      if (gameId) {
        game = await loadGame(gameId);
        if (!game) console.error(`[MiniHub] games/${gameId}/game.json 이 없거나 잘못돼서 점수를 저장할 수 없습니다`);
      }
      try {
        await store.init();
      } catch (e) {
        console.error("[MiniHub] 서버 연결 실패", e);
        toast("⚠ 랭킹 서버에 연결하지 못했어요. 기록이 저장되지 않아요", 6000);
        player = { id: "offline", name: "Guest" };
        throw e;
      }
      let me = await store.me().catch((e) => { console.error(e); return null; });
      if (!me && opts.askName !== false) me = await askLogin();
      player = me || { id: null, name: "Guest" };
      const cbs = readyCbs; readyCbs = [];
      cbs.forEach((cb) => { try { cb(player); } catch (e) { console.error(e); } });
      return player;
    })();
    readyPromise.catch(() => {
      const cbs = readyCbs; readyCbs = [];
      cbs.forEach((cb) => { try { cb(player); } catch (e) { console.error(e); } });
    });
    return readyPromise;
  }

  async function doSubmit(raw, opts) {
    const score = Math.floor(Number(raw));
    if (!isFinite(score) || score < 0) { console.warn("[MiniHub] 잘못된 점수:", raw); return null; }
    if (!readyPromise) { console.warn("[MiniHub] MiniHub.init(게임ID)을 먼저 호출하세요"); return null; }
    try { await readyPromise; } catch { return null; }
    if (!game) return null;
    if (!player || !player.id) {
      if (opts.toast !== false) toast("닉네임으로 접속해야 기록이 저장돼요");
      return null;
    }
    if (score > game.scoreLimit) {
      console.warn(`[MiniHub] 점수 ${score}가 상한선(scoreLimit ${game.scoreLimit})을 넘어 저장하지 않습니다`);
      return null;
    }
    let res;
    try {
      res = await store.submitScore(game, score);
    } catch (e) {
      console.error("[MiniHub] 점수 저장 실패", e);
      if (opts.toast !== false) toast("⚠ 기록을 저장하지 못했어요. 인터넷 연결을 확인해주세요", 5000);
      return null;
    }
    const me = await store.getMyGameEntry(game.id).catch(() => null);
    const out = {
      score,
      improved: !!res.improved,
      previous: res.previous ?? null,
      best: res.best,
      rank: me ? me.rank : null,
      players: me ? me.players : null,
    };
    if (opts.toast !== false) {
      const u = game.scoreUnit, rk = me ? ` · ${me.rank}위 / ${me.players}명` : "";
      if (out.improved && out.previous !== null) toast(`🎉 <b>신기록!</b> ${esc(fmtScore(out.previous, u))} → <b>${esc(fmtScore(score, u))}</b>${rk}`, 5000);
      else if (out.improved) toast(`✅ 첫 기록 <b>${esc(fmtScore(score, u))}</b> 저장!${rk}`, 5000);
      else toast(`최고 기록 <b>${esc(fmtScore(out.best, u))}</b>${rk}`);
    }
    return out;
  }

  // ───────────── 게임 진행 저장 (플레이어별·게임별 1칸, 최대 20KB) ─────────────
  const SAVE_MAX = 20000;
  let saveSeq = 0, saveChain = Promise.resolve();

  async function readyForSave(what) {
    if (!gameId) { console.warn(`[MiniHub] ${what}: 먼저 MiniHub.init("게임ID")를 호출하세요`); return false; }
    try { await init(gameId); } catch { return false; }
    if (!player || !player.id) { console.warn(`[MiniHub] ${what}: 로그인 전이라 할 수 없어요`); return false; }
    return true;
  }

  async function loadProgress() {
    if (!(await readyForSave("load"))) return null;
    try { return await store.loadSave(gameId); }
    catch (e) { console.error("[MiniHub] 저장값 불러오기 실패", e); return null; }
  }

  function saveProgress(data) {
    let value;
    try {
      const json = JSON.stringify(data === undefined ? null : data);
      if (new Blob([json]).size > SAVE_MAX) { console.warn(`[MiniHub] 저장값이 너무 커요 (최대 ${SAVE_MAX / 1000}KB)`); return Promise.resolve(false); }
      value = JSON.parse(json);
    } catch (e) {
      console.warn("[MiniHub] 저장할 수 없는 값이에요 (숫자·글자·배열·객체만 가능)", e);
      return Promise.resolve(false);
    }
    const seq = ++saveSeq;
    const p = saveChain.then(async () => {
      if (seq !== saveSeq) return true; // 더 새로운 저장이 뒤에 있으면 건너뜀 (그게 덮어씀)
      if (!(await readyForSave("save"))) return false;
      try { await store.saveGame(gameId, value); return true; }
      catch (e) { console.error("[MiniHub] 진행 저장 실패", e); return false; }
    });
    saveChain = p.catch(() => {});
    return p;
  }

  window.MiniHub = {
    version: 4,
    get mode() { return store.mode; },
    root: ROOT,
    siteTitle: CONFIG.siteTitle,

    // 게임용
    init,
    onReady(cb) { if (player) cb(player); else readyCbs.push(cb); },
    getPlayer() { return player; },
    submitScore(score, opts = {}) {
      const p = queue.then(() => doSubmit(score, opts));
      queue = p.catch(() => {});
      return p;
    },
    // 내 정보 메뉴 (닉네임 바꾸기 / 다른 닉네임으로 접속). 바뀐 player를 돌려준다
    async changeName() {
      try { await init(gameId); } catch { return player; }
      if (!player.id) { const p = await askLogin({ cancel: true }); if (p) player = p; return player; }
      const act = await accountMenu(player.name);
      if (act === "rename") {
        const n = await askRename(player.name);
        if (n && n !== player.name) { player = { ...player, name: n }; toast("닉네임을 바꿨어요. 랭킹에도 바로 반영돼요"); }
      } else if (act === "switch") {
        const p = await askLogin({ cancel: true });
        if (p) player = p;
      }
      return player;
    },
    // 게임 진행 저장/불러오기 (로그인한 플레이어별로 서버에 저장 → 다른 기기에서도 이어짐)
    save: saveProgress,          // await MiniHub.save({ stage: 3 })  → true/false. null을 넣으면 삭제
    load: loadProgress,          // await MiniHub.load()              → 저장값 또는 null
    async getMyBest() {          // 이 게임의 내 최고 기록 (없으면 null)
      if (!(await readyForSave("getMyBest"))) return null;
      return (await store.getMyBests().catch(() => ({})))[gameId] ?? null;
    },
    exit() { location.href = ROOT + "index.html"; },
    rankingUrl(id) { return ROOT + "index.html" + (id ? "#" + encodeURIComponent(id) : ""); },

    // 랭킹 조회 (허브 페이지·게임 안 순위 표시용)
    listGames,
    loadGame,
    getGameRanking: async (id, limit) => { await init(gameId); return store.getGameRanking(id, limit); },
    getMyGameEntry: async (id) => { await init(gameId); return store.getMyGameEntry(id); },
    getMyBests: async () => { await init(gameId); return store.getMyBests(); },
    getOverall: async (ids, limit) => { await init(gameId); return store.getOverall(ids, limit); },
    getMyOverall: async (ids) => { await init(gameId); return store.getMyOverall(ids); },
    getGameRankingPrev: async (id) => { await init(gameId); return store.getGameRankingPrev(id); }, // 직전 순위 [{player_id, rank}] 또는 null
    getOverallPrev: async (ids) => { await init(gameId); return store.getOverallPrev(ids); },

    // 표시 도우미
    toast,
    format: fmtScore,
  };
})();
