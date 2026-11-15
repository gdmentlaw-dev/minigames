// 허브 공통 기능: 게임 목록 불러오기, 닉네임, 상단바, 토스트, 표시 형식
(function () {
  const cfg = window.MINIHUB_CONFIG || {};
  const store = window.HubStore;
  const DEFAULT_LIMIT = 100000000;

  const params = new URLSearchParams(location.search);
  let dev = false;
  try {
    if (params.get("dev") === "1") sessionStorage.setItem("minihub_dev", "1");
    if (params.get("dev") === "0") sessionStorage.removeItem("minihub_dev");
    dev = sessionStorage.getItem("minihub_dev") === "1";
  } catch {}

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function fmtScore(score, unit) {
    if (score === null || score === undefined) return "-";
    return Number(score).toLocaleString("ko-KR") + (unit || "");
  }
  const fmtPoints = (p) => (Math.round(Number(p) * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });

  // game.json을 읽어서 기본값을 채운다. 문제가 있으면 null.
  async function loadGame(id) {
    if (!/^[a-z0-9-]{1,40}$/.test(id)) return null;
    try {
      const res = await fetch(`games/${id}/game.json`, { cache: "no-cache" });
      if (!res.ok) throw new Error(res.status);
      const g = await res.json();
      if (g.id !== id) console.warn(`[허브] games/${id}/game.json 의 id가 폴더 이름과 다릅니다:`, g.id);
      const limit = Math.floor(Number(g.scoreLimit ?? g.maxScore ?? DEFAULT_LIMIT));
      return {
        id,
        title: g.title || id,
        author: g.author || "",
        description: g.description || "",
        controls: g.controls || "",
        scoreOrder: g.scoreOrder === "asc" ? "asc" : "desc",
        scoreUnit: g.scoreUnit || "점",
        scoreLimit: limit > 0 && limit <= DEFAULT_LIMIT ? limit : DEFAULT_LIMIT,
        thumbnail: `games/${id}/${g.thumbnail || "thumbnail.png"}`,
        hidden: !!g.hidden,
      };
    } catch (e) {
      console.warn(`[허브] games/${id}/game.json 을 읽지 못해 건너뜁니다`, e);
      return null;
    }
  }

  let gamesCache = null;
  async function loadGames() {
    if (gamesCache) return gamesCache;
    let ids = [];
    try {
      ids = await (await fetch("games/index.json", { cache: "no-cache" })).json();
    } catch (e) {
      console.warn("[허브] games/index.json 을 읽지 못했습니다", e);
    }
    const games = (await Promise.all([...new Set(ids)].map(loadGame))).filter(Boolean);
    gamesCache = games.filter((g) => dev || !g.hidden);
    return gamesCache;
  }

  // ───── 토스트 ─────
  function toast(html, ms = 4000) {
    let box = document.getElementById("toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "toasts";
      document.body.appendChild(box);
    }
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = html;
    box.appendChild(el);
    setTimeout(() => el.classList.add("out"), ms);
    setTimeout(() => el.remove(), ms + 400);
  }

  // ───── 닉네임 창 ─────
  let myName = null;
  function askName(current) {
    return new Promise((resolve) => {
      const wrap = document.createElement("div");
      wrap.className = "modal-bg";
      wrap.innerHTML = `
        <form class="modal" autocomplete="off">
          <h2>${current ? "닉네임 변경" : "반가워요! 👋"}</h2>
          <p class="muted">랭킹에 표시될 닉네임을 정해주세요 (2~10자)</p>
          <input name="nick" maxlength="10" placeholder="닉네임" value="${esc(current || "")}" required>
          <p class="err" hidden></p>
          <div class="row">
            ${current ? '<button type="button" class="btn ghost" data-cancel>취소</button>' : ""}
            <button class="btn">확인</button>
          </div>
        </form>`;
      document.body.appendChild(wrap);
      const form = wrap.querySelector("form");
      const input = form.nick;
      const err = form.querySelector(".err");
      input.focus();
      input.select();
      wrap.querySelector("[data-cancel]")?.addEventListener("click", () => { wrap.remove(); resolve(current); });
      form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = input.value.trim().replace(/\s+/g, " ");
        if (name.length < 2 || name.length > 10) {
          err.textContent = "2~10자로 입력해주세요";
          err.hidden = false;
          return;
        }
        form.querySelectorAll("button").forEach((b) => (b.disabled = true));
        try {
          await store.setName(name);
          wrap.remove();
          resolve(name);
        } catch (ex) {
          console.error(ex);
          err.textContent = "저장하지 못했어요. 잠시 후 다시 시도해주세요";
          err.hidden = false;
          form.querySelectorAll("button").forEach((b) => (b.disabled = false));
        }
      });
    });
  }

  async function ensureName() {
    if (!myName) myName = await store.getName();
    if (!myName) myName = await askName(null);
    renderNameChip();
    return myName;
  }

  async function changeName() {
    const n = await askName(myName);
    if (n && n !== myName) {
      myName = n;
      renderNameChip();
      toast("닉네임을 바꿨어요. 랭킹에도 바로 반영돼요");
      document.dispatchEvent(new CustomEvent("hub:namechange"));
    }
  }

  function renderNameChip() {
    const chip = document.getElementById("name-chip");
    if (chip) chip.textContent = myName ? `👤 ${myName}` : "닉네임 설정";
  }

  // ───── 상단바 ─────
  function renderHeader(active) {
    const h = document.getElementById("topbar");
    if (!h) return;
    const title = esc(cfg.siteTitle || "미니게임");
    h.innerHTML = `
      <a class="logo" href="index.html">🎮 ${title}</a>
      <nav>
        <a href="index.html" class="${active === "home" ? "on" : ""}">게임</a>
        <a href="ranking.html" class="${active === "ranking" ? "on" : ""}">랭킹</a>
        <button id="name-chip" class="chip" type="button" title="닉네임 변경">…</button>
      </nav>`;
    document.getElementById("name-chip").addEventListener("click", changeName);
    if (store.mode === "local") {
      const b = document.createElement("div");
      b.className = "banner";
      b.textContent = "로컬 테스트 모드 — 점수가 이 브라우저에만 저장됩니다 (hub/config.js에 Supabase를 연결하면 온라인)";
      h.after(b);
    }
    if (dev) {
      const b = document.createElement("div");
      b.className = "banner dev";
      b.innerHTML = '개발 모드 — 숨김 게임(예제)도 보입니다 · <a href="?dev=0">끄기</a>';
      h.after(b);
    }
  }

  // 모든 페이지 공통 시작: 상단바 → 로그인 → 닉네임
  async function boot(active) {
    renderHeader(active);
    try {
      await store.init();
    } catch (e) {
      console.error(e);
      document.querySelector("main").innerHTML = `
        <div class="card error">
          <h2>서버에 연결하지 못했어요</h2>
          <p class="muted">인터넷 연결을 확인하고 새로고침해주세요.</p>
          <pre>${esc(e.message || e)}</pre>
          <button class="btn" onclick="location.reload()">새로고침</button>
        </div>`;
      throw e;
    }
    await ensureName();
  }

  window.Hub = { store, boot, loadGames, loadGame, ensureName, toast, esc, fmtScore, fmtPoints, dev, params,
    get name() { return myName; } };
})();
