// 랭킹 페이지 (ranking.html) — 데이터는 전부 shared/minihub-sdk.js 를 통해 읽는다.
(async () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtP = (p) => (Math.round(Number(p) * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  const num = (n) => Number(n).toLocaleString("ko-KR");
  // 게임 이름 줄임말: 한글은 두 글자(러시), 숫자로 시작하면 세 글자(10초), 영문은 첫 단어 4글자(Meow)
  const short = (t) => {
    const s = String(t).trim();
    if (/^[A-Za-z]/.test(s)) return s.split(/\s+/)[0].slice(0, 4);
    const c = s.replace(/\s+/g, "");
    return /^[0-9]/.test(c) ? c.slice(0, 3) : [...c].slice(0, 2).join("");
  };
  const PLAY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  const TROPHY = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8f6fe0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>';

  // ?dev=1 → 숨김(예제) 게임도 보기 (메인페이지와 같은 규칙)
  const params = new URLSearchParams(location.search);
  let dev = false;
  try {
    if (params.get("dev") === "1") sessionStorage.setItem("minihub_dev", "1");
    if (params.get("dev") === "0") sessionStorage.removeItem("minihub_dev");
    dev = sessionStorage.getItem("minihub_dev") === "1";
  } catch {}

  const title = MiniHub.siteTitle || "미니게임";
  document.title = `랭킹 · ${title}`;
  $("brand").textContent = title;
  if (MiniHub.mode === "local")
    $("banners").insertAdjacentHTML("beforeend", `<div class="banner">로컬 테스트 모드 — 점수가 이 브라우저에만 저장됩니다</div>`);

  let player;
  try {
    player = await MiniHub.init();
  } catch (e) {
    $("board").innerHTML = `<p class="empty">랭킹 서버에 연결하지 못했어요. 인터넷 연결을 확인하고 새로고침해주세요.</p>`;
    return;
  }
  const isMe = (r) => !!player.id && r.player_id === player.id;
  const renderName = () => ($("name-chip").innerHTML = `${MiniHub.avatar(player, 26)}<span class="nmtxt">${esc(player.name)}</span>`);
  renderName();

  const games = await MiniHub.listGames({ includeHidden: dev });
  const ids = games.map((g) => g.id);
  const byId = Object.fromEntries(games.map((g) => [g.id, g]));
  const validTab = (t) => t === "overall" || !!byId[t];
  let current = validTab(location.hash.slice(1)) ? location.hash.slice(1) : "overall";
  let myBests = {}, myEntries = {}, myOverall = null;

  // ── 순위 변동: 서버의 "직전 순위(순위가 마지막으로 바뀌기 바로 전)"와 지금 순위를 비교 ──
  // 서버에 직전 순위 기능이 없거나 로컬 모드이면, 이 브라우저에 날짜별 순위를 기억해 두는 임시 방식을 쓴다.
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  // prev[id] = 그때 순위(숫자) 또는 { rank, is_new } (서버). 그때 없던 사람은 오늘 처음 온 경우에만 NEW (하루만 표시)
  const deltaOf = (prev, r) => {
    const e = prev[r.player_id];
    const obj = e !== null && typeof e === "object";
    const p = obj ? e.rank : e;
    if (p == null) {
      if (obj && e.is_new === false) return { cls: "flat", text: "—", cell: "—" };
      return { cls: "new", text: "NEW", cell: "NEW" };
    }
    const diff = Number(p) - r.rank;
    if (diff > 0) return { cls: "up", text: "▲" + diff, cell: "▲" + diff };
    if (diff < 0) return { cls: "down", text: "▼" + -diff, cell: "▼" + -diff };
    return { cls: "flat", text: "—", cell: "—" };
  };
  function serverDelta(prevRows) {
    if (!prevRows.length) return { basis: "오늘은 순위 변동이 없어요", of: () => ({ cls: "flat", text: "—", cell: "—" }) };
    const prev = Object.fromEntries(prevRows.map((x) => [x.player_id, x]));
    return { basis: "변동 · 최근 순위 변동 대비", of: (r) => deltaOf(prev, r) };
  }
  function snapshot(board, list) {
    const key = "minihub_rank_snap_" + board, today = ymd(new Date());
    let s = null;
    try { s = JSON.parse(localStorage.getItem(key)); } catch {}
    if (!s || !s.date) s = { date: today, ranks: {}, prevDate: null, prev: null };
    if (s.date !== today) { s.prev = s.ranks; s.prevDate = s.date; s.ranks = {}; s.date = today; }
    for (const r of list) s.ranks[r.player_id] = r.rank;
    try { localStorage.setItem(key, JSON.stringify(s)); } catch {}
    const y = new Date(); y.setDate(y.getDate() - 1);
    const [, m, d] = (s.prevDate || "").split("-");
    return {
      basis: !s.prev ? "변동은 내일부터 보여요" : s.prevDate === ymd(y) ? "변동 · 어제 대비" : `변동 · ${+m}/${+d} 대비`,
      of(r) {
        if (!s.prev) return { cls: "flat", text: "", cell: "" };
        return deltaOf(s.prev, r);
      },
    };
  }

  // ── 썸네일 (어두운 모드에는 thumbnail-dark.svg 처럼 "-dark"가 붙은 파일을 쓴다. 없으면 기본 이미지, 그것도 없으면 게임 이름 두 글자) ──
  const isDark = () => window.MiniHubTheme && MiniHubTheme.get() === "dark";
  const darkUrl = (u) => u.replace(/(\.[A-Za-z0-9]+)(\?.*)?$/, "-dark$1$2");
  const thumbSrc = (base) => (isDark() ? darkUrl(base) : base);
  const thumb = (g) => `<span class="th"><img src="${esc(thumbSrc(g.thumbnail))}" data-base="${esc(g.thumbnail)}" alt="" data-short="${esc(short(g.title))}" draggable="false"></span>`;
  function fixThumbs(root) {
    root.querySelectorAll(".th img").forEach((img) => {
      const fail = () => {
        if (img.dataset.base && img.getAttribute("src") !== img.dataset.base) { img.src = img.dataset.base; img.addEventListener("error", fail, { once: true }); return; }
        const th = img.parentNode; if (th) th.textContent = img.dataset.short;
      };
      if (img.complete && !img.naturalWidth) fail(); else img.addEventListener("error", fail, { once: true });
    });
  }
  if (window.MiniHubTheme) MiniHubTheme.onChange(() => {
    document.querySelectorAll(".th img[data-base]").forEach((img) => { img.src = thumbSrc(img.dataset.base); });
    fixThumbs(document);
  });

  // ── 게임 스위처 ──
  function renderTiles() {
    const meText = (id) => {
      if (id === "overall") return myOverall ? `내 순위 ${myOverall.rank}위` : "기록 없음";
      return myEntries[id] ? `내 순위 ${myEntries[id].rank}위` : "도전 전";
    };
    $("tiles").innerHTML =
      `<button class="tile${current === "overall" ? " on" : ""}" data-id="overall"><span class="th">${TROPHY}</span><span class="tl">종합</span><span class="tm">${esc(meText("overall"))}</span></button>` +
      games.map((g) => `<button class="tile${current === g.id ? " on" : ""}" data-id="${esc(g.id)}">${thumb(g)}<span class="tl">${esc(g.title)}</span><span class="tm">${esc(meText(g.id))}</span></button>`).join("");
    fixThumbs($("tiles"));
    const on = $("tiles").querySelector(".tile.on");
    const box = $("tiles");
    if (on && box.scrollWidth > box.clientWidth) {
      const l = on.offsetLeft - box.offsetLeft, r = l + on.offsetWidth;
      if (l < box.scrollLeft || r > box.scrollLeft + box.clientWidth) box.scrollLeft = l - 16;
    }
  }
  $("tiles").addEventListener("click", (e) => {
    const b = e.target.closest(".tile");
    if (b) location.hash = b.dataset.id;
  });
  // 마우스 휠 · 끌어서 가로 스크롤 (모바일 폭일 때)
  (function wireStrip(el) {
    el.addEventListener("wheel", (e) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    }, { passive: false });
    let down = false, moved = false, sx = 0, sl = 0;
    el.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || el.scrollWidth <= el.clientWidth) return;
      down = true; moved = false; sx = e.clientX; sl = el.scrollLeft;
    });
    window.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (Math.abs(dx) > 4) { moved = true; el.classList.add("drag"); }
      el.scrollLeft = sl - dx;
    });
    window.addEventListener("pointerup", () => { down = false; el.classList.remove("drag"); });
    el.addEventListener("click", (e) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
  })($("tiles"));

  // ── 랭킹 ──
  function view(r, g) {
    return g
      ? { value: num(r.score), unit: g.scoreUnit, sub: `포인트 ${fmtP(r.points)}` }
      : { value: fmtP(r.total), unit: "P", sub: `${r.games_played}/${games.length} 게임 참여` };
  }
  // 게임별 포인트 (이름 + 점수 + 막대). 1위 카드에는 늘 보이고, 2위부터와 하단 "내 순위"는 눌러서 펼친다
  const gmHtml = (r) => `<div class="gm" style="grid-template-columns:repeat(${Math.min(4, games.length) || 1},1fr)">${games.map((x) => {
    const p = Number((r.per_game || {})[x.id] || 0);
    return `<span class="g${p ? "" : " z"}"><span class="gl">${esc(short(x.title))}<b>${p ? fmtP(p) : "-"}</b></span><i style="--w:${Math.round(p)}%"></i></span>`;
  }).join("")}</div>`;

  function boardHtml(rows, g, dl) {
    if (!rows.length)
      return `<p class="empty">아직 기록이 없어요.${g ? ` <a href="${esc(g.url)}">첫 도전하기 →</a>` : ""}</p>`;
    const name = (r) => esc(r.name) + (isMe(r) ? " (나)" : "");
    const dSpan = (r) => { const d = dl.of(r); return d.text ? `<span class="d ${d.cls}">${d.text}</span>` : ""; };
    const c = rows[0];
    const cv = view(c, g);
    // 1위 카드: 얼굴 · 이름 · 점수, 종합이면 게임별 포인트 막대
    const champ = `<section class="champ">
      <div class="champ-top">
        ${MiniHub.avatar(c, 68)}
        <span class="ci"><span class="kicker">1등</span><span class="champ-name">${name(c)}</span>${dSpan(c)}</span>
        <span class="big">${cv.value}<small>${esc(cv.unit)}</small></span>
      </div>
      ${g ? `<span class="champ-sub">${cv.sub}</span>`
          : gmHtml(c)}
    </section>`;
    // 2위부터: 순위 · 얼굴 · 이름(+등락) · 점수
    const rest = rows.slice(1).map((r) => {
      const v = view(r, g);
      const open = !g; // 종합은 줄을 누르면 게임별 점수가 펼쳐진다
      return `<div class="li${isMe(r) ? " me" : ""}${open ? " exp" : ""}"${open ? ' role="button" tabindex="0" aria-expanded="false"' : ""}>
        <span class="rk">${r.rank}</span>${MiniHub.avatar(r, 40)}
        <span class="who"><span class="nm"><span class="n">${name(r)}</span>${dSpan(r)}</span>${g ? `<span class="dt">${v.sub}</span>` : `<span class="dt">${r.games_played}/${games.length} 게임 참여</span>`}</span>
        <span class="val">${v.value}<small>${esc(v.unit)}</small></span>
        ${open ? gmHtml(r) : ""}
      </div>`;
    }).join("");
    return `<div class="top3">${champ}</div>${rest ? `<div class="list">${rest}</div>` : ""}`;
  }

  // 종합 순위 줄을 누르면 게임별 점수 펼치기/접기
  const toggleRow = (li) => { const on = li.classList.toggle("open"); li.setAttribute("aria-expanded", on); };
  $("board").addEventListener("click", (e) => { const li = e.target.closest(".li.exp"); if (li) toggleRow(li); });
  $("board").addEventListener("keydown", (e) => {
    const li = e.target.closest(".li.exp");
    if (li && li === e.target && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); toggleRow(li); }
  });

  function gapText(me, rows, g) {
    if (me.rank === 1) return "1위를 지키고 있어요";
    const above = rows.filter((r) => r.rank < me.rank).pop();
    if (!above) return "";
    if (!g) return `${above.rank}위 ${above.name}까지 ${fmtP(above.total - me.total)}P`;
    const diff = Math.abs(above.score - me.score);
    if (!diff) return `${above.rank}위와 동점이에요`;
    return `${above.rank}위까지 ${g.scoreOrder === "asc" ? "−" : "+"}${num(diff)}${g.scoreUnit}`;
  }

  function renderBar(me, rows, g, dl) {
    const btn = g
      ? `<a class="btn-play" href="${esc(g.url)}">${PLAY}${me ? "플레이하기" : "첫 플레이"}</a>`
      : `<button class="btn-play" type="button" data-pick>${PLAY}게임 고르기</button>`;
    let body;
    if (me) {
      const v = view(me, g), d = dl.of(me);
      body = `<span class="tag">내 순위</span><b class="mr">#${me.rank}</b>
        <span class="mi"><span class="ml"><span class="mt">${g ? "최고 기록" : "종합"} · ${v.value}${esc(v.unit)}</span>${d.text ? `<span class="d ${d.cls}">${d.text}</span>` : ""}</span><small>${esc(gapText(me, rows, g))}</small></span>`;
    } else {
      body = `<span class="tag">내 순위</span><span class="mi"><span>아직 기록이 없어요</span><small>한 판만 해도 순위에 올라가요</small></span>`;
    }
    // 종합이고 내 기록이 있으면: 누르면 게임별 점수가 위로 펼쳐진다
    const open = !g && !!me;
    const wasOpen = !!$("mybar").querySelector(".mybar-in.open");
    $("mybar").innerHTML = `<div class="mybar-in${open ? " exp" + (wasOpen ? " open" : "") : ""}">${open ? gmHtml(me) : ""}<div class="mb-row">${body}${open ? '<span class="caret" aria-hidden="true">▴</span>' : ""}${btn}</div></div>`;
    $("mybar").hidden = !player.id;
  }

  let busy = false;
  async function renderBoard() {
    if (busy) return;
    busy = true;
    renderTiles();
    try {
      const g = current === "overall" ? null : byId[current];
      $("title").textContent = g ? g.title : "종합 랭킹";
      $("desc").textContent = g
        ? `${g.scoreOrder === "asc" ? "낮을수록" : "높을수록"} 좋은 기록 · 인당 최고 기록 · 만든 사람 ${g.author}`
        : `게임마다 순위를 0~100 포인트로 바꿔 합산 (1등 100, 안 한 게임 0) · 최대 ${games.length * 100}`;
      // 제목 오른쪽 플레이 버튼 (게임 → 바로 플레이, 종합 → 게임 고르기)
      $("head-play").innerHTML = g
        ? `<a class="btn-play sm" href="${esc(g.url)}">${PLAY}플레이하기</a>`
        : games.length ? `<button class="btn-play sm" type="button" data-pick>${PLAY}게임 고르기</button>` : "";
      const [rows, me] = g
        ? await Promise.all([MiniHub.getGameRanking(g.id, 100), MiniHub.getMyGameEntry(g.id)])
        : await Promise.all([MiniHub.getOverall(ids, 100), MiniHub.getMyOverall(ids)]);
      // 직전 순위 (오래된 SDK가 캐시에 남아 있으면 함수가 없을 수 있어 안전하게 부른다)
      const prevRows = await Promise.resolve()
        .then(() => (g ? MiniHub.getGameRankingPrev(g.id) : MiniHub.getOverallPrev(ids)))
        .catch(() => null);
      const dl = Array.isArray(prevRows) ? serverDelta(prevRows) : snapshot(current, me && !rows.some(isMe) ? rows.concat([me]) : rows);
      $("basis").textContent = rows.length ? dl.basis : "";
      $("board").innerHTML = boardHtml(rows, g, dl);
      renderBar(me, rows, g, dl);
    } catch (e) {
      console.error(e);
      $("board").innerHTML = `<p class="empty">랭킹을 불러오지 못했어요. 새로고침해주세요.</p>`;
    } finally {
      busy = false;
    }
  }

  async function renderMine() {
    const [bests, ov, entries] = await Promise.all([
      MiniHub.getMyBests(),
      MiniHub.getMyOverall(ids),
      Promise.all(ids.map((id) => MiniHub.getMyGameEntry(id).catch(() => null))),
    ]);
    myBests = bests || {};
    myOverall = ov;
    myEntries = Object.fromEntries(ids.map((id, i) => [id, entries[i]]));
  }

  // ── 게임 고르기 ──
  function openSheet() {
    const list = games.slice().sort((a, b) => (a.id in myBests) - (b.id in myBests));
    $("picks").innerHTML = list.map((g) => {
      const played = g.id in myBests;
      return `<a class="pick" href="${esc(g.url)}">${thumb(g)}
        <span><b>${esc(g.title)}</b><small class="${played ? "" : "new"}">${played
          ? `최고 ${esc(MiniHub.format(myBests[g.id], g.scoreUnit))}${myEntries[g.id] ? ` · ${myEntries[g.id].rank}위` : ""}`
          : "아직 안 해봤어요 · 포인트 +"}</small></span>
        <span class="btn-play sm">${PLAY}플레이</span></a>`;
    }).join("");
    fixThumbs($("picks"));
    $("sheet").hidden = false;
    $("sheet-x").focus();
  }
  const closeSheet = () => ($("sheet").hidden = true);
  $("mybar").addEventListener("click", (e) => {
    if (e.target.closest("[data-pick]")) return openSheet();
    if (e.target.closest(".btn-play")) return;
    const box = e.target.closest(".mybar-in.exp");
    if (box) box.classList.toggle("open");
  });
  $("head-play").addEventListener("click", (e) => { if (e.target.closest("[data-pick]")) openSheet(); });
  $("sheet").addEventListener("click", (e) => { if (e.target === $("sheet")) closeSheet(); });
  $("sheet-x").addEventListener("click", closeSheet);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });

  async function refreshAll() {
    try { await renderMine(); } catch (e) { console.error(e); }
    await renderBoard();
  }

  window.addEventListener("hashchange", () => {
    const h = location.hash.slice(1);
    current = validTab(h) ? h : "overall";
    window.scrollTo({ top: 0 });
    renderBoard();
  });
  $("name-chip").addEventListener("click", async () => {
    const before = `${player.id}|${player.name}|${player.avatar}`;
    player = await MiniHub.changeName();
    if (`${player.id}|${player.name}|${player.avatar}` !== before) { renderName(); refreshAll(); }
  });
  // 자동 새로고침 없음: 페이지를 열거나 새로고침할 때만 데이터를 받아온다.
  // (뒤로가기로 돌아와 캐시된 화면이 복원될 때도 새로 받아온다)
  window.addEventListener("pageshow", (e) => { if (e.persisted) refreshAll(); });

  refreshAll();
})();
