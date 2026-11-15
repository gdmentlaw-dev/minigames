// 메인페이지 — 데이터는 전부 shared/minihub-sdk.js 를 통해 읽는다.
(async () => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtPoints = (p) => (Math.round(Number(p) * 10) / 10).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  const medal = (r) => (["🥇", "🥈", "🥉"][r - 1] ? `<span class="medal">${["🥇", "🥈", "🥉"][r - 1]}</span>` : r);

  // ?dev=1 → 숨김(예제) 게임도 보기
  const params = new URLSearchParams(location.search);
  let dev = false;
  try {
    if (params.get("dev") === "1") sessionStorage.setItem("minihub_dev", "1");
    if (params.get("dev") === "0") sessionStorage.removeItem("minihub_dev");
    dev = sessionStorage.getItem("minihub_dev") === "1";
  } catch {}

  const title = MiniHub.siteTitle || "미니게임";
  document.title = title;
  $("logo").textContent = `🎮 ${title}`;

  const banners = $("banners");
  if (MiniHub.mode === "local")
    banners.insertAdjacentHTML("beforeend",
      `<div class="banner">로컬 테스트 모드 — 점수가 이 브라우저에만 저장됩니다 (shared/minihub-sdk.js의 CONFIG에 Supabase를 넣으면 온라인)</div>`);
  if (dev)
    banners.insertAdjacentHTML("beforeend",
      `<div class="banner dev">개발 모드 — 숨김 게임(예제)도 보입니다 · <a href="?dev=0">끄기</a></div>`);

  let player;
  try {
    player = await MiniHub.init();
  } catch (e) {
    document.querySelector("main").innerHTML = `
      <div class="card error"><h2>랭킹 서버에 연결하지 못했어요</h2>
      <p class="muted">인터넷 연결을 확인하고 새로고침해주세요.</p><pre>${esc(e.message || e)}</pre>
      <button class="btn" onclick="location.reload()">새로고침</button></div>`;
    return;
  }
  const isMe = (r) => !!player.id && r.player_id === player.id;

  function renderName() {
    $("name-chip").textContent = `👤 ${player.name}`;
    $("hello").textContent = `${player.name}님의 기록`;
  }
  renderName();

  const games = await MiniHub.listGames({ includeHidden: dev });
  const ids = games.map((g) => g.id);
  const byId = Object.fromEntries(games.map((g) => [g.id, g]));

  // ── 탭 ──
  let current = location.hash.slice(1);
  const validTab = (t) => t === "overall" || !!byId[t];
  if (!validTab(current)) current = "overall";
  $("tabs").innerHTML = [`<button data-id="overall">🏆 종합</button>`]
    .concat(games.map((g) => `<button data-id="${esc(g.id)}">${esc(g.title)}</button>`)).join("");
  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    location.hash = b.dataset.id;
  });
  window.addEventListener("hashchange", () => {
    const h = location.hash.slice(1);
    current = validTab(h) ? h : "overall";
    renderBoard();
  });

  // ── 내 기록 + 게임 카드 ──
  async function renderMine() {
    const [bests, me] = await Promise.all([MiniHub.getMyBests(), MiniHub.getMyOverall(ids)]);
    $("my-rank").textContent = me ? `${me.rank}위` : "-";
    $("my-total").textContent = me ? fmtPoints(me.total) : "0";
    $("my-played").textContent = `${me ? me.games_played : 0}/${games.length}`;
    $("games").innerHTML = games.length
      ? games.map((g) => `
        <a class="game" href="${esc(g.url)}">
          <img src="${esc(g.thumbnail)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">
          <div class="body">
            <h3>${esc(g.title)}</h3>
            <p class="desc">${esc(g.description)}</p>
            <div class="meta">
              <span class="muted">${esc(g.author)}</span>
              <span class="best">${g.id in bests ? "최고 " + esc(MiniHub.format(bests[g.id], g.scoreUnit)) : "도전 전"}</span>
            </div>
          </div>
        </a>`).join("")
      : `<p class="empty">아직 등록된 게임이 없어요.<br><small>games/index.json에 게임 ID를 추가하세요 (예제는 ?dev=1)</small></p>`;
  }

  // ── 랭킹 표 ──
  function overallTable(rows) {
    return `<table class="rank">
      <thead><tr><th>순위</th><th>닉네임</th><th class="num hide-sm">참여</th><th class="num">포인트</th></tr></thead>
      <tbody>${rows.map((r) => {
        const detail = Object.entries(r.per_game || {})
          .filter(([gid]) => byId[gid])
          .map(([gid, p]) => `${esc(byId[gid].title)} ${fmtPoints(p)}`).join(" · ");
        return `<tr class="${isMe(r) ? "me" : ""}">
          <td class="pos">${medal(r.rank)}</td>
          <td class="name">${esc(r.name)}<span class="sub">${detail}</span></td>
          <td class="num hide-sm">${r.games_played}/${games.length}</td>
          <td class="num"><b>${fmtPoints(r.total)}</b></td></tr>`;
      }).join("")}</tbody></table>`;
  }
  function gameTable(rows, g) {
    return `<table class="rank">
      <thead><tr><th>순위</th><th>닉네임</th><th class="num">기록</th><th class="num hide-sm">포인트</th></tr></thead>
      <tbody>${rows.map((r) => `<tr class="${isMe(r) ? "me" : ""}">
          <td class="pos">${medal(r.rank)}</td>
          <td class="name">${esc(r.name)}</td>
          <td class="num"><b>${esc(MiniHub.format(r.score, g.scoreUnit))}</b></td>
          <td class="num hide-sm">${fmtPoints(r.points)}</td></tr>`).join("")}</tbody></table>`;
  }

  let busy = false;
  async function renderBoard() {
    if (busy) return;
    busy = true;
    $("tabs").querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.id === current));
    try {
      if (current === "overall") {
        $("board-desc").textContent =
          `게임마다 순위를 0~100 포인트로 바꿔 합산 (1등 100, 안 한 게임 0) · 최대 ${games.length * 100}`;
        const [rows, me] = await Promise.all([MiniHub.getOverall(ids, 100), MiniHub.getMyOverall(ids)]);
        $("board").innerHTML = rows.length ? overallTable(rows) : `<p class="card empty">아직 기록이 없어요</p>`;
        $("mine").innerHTML = me && !rows.some(isMe) ? `<p class="muted">내 순위</p>${overallTable([me])}` : "";
      } else {
        const g = byId[current];
        $("board-desc").textContent =
          `${g.scoreOrder === "asc" ? "낮을수록" : "높을수록"} 좋은 기록 · 플레이어별 최고 기록 · 만든 사람 ${g.author}`;
        const [rows, me] = await Promise.all([MiniHub.getGameRanking(g.id, 100), MiniHub.getMyGameEntry(g.id)]);
        $("board").innerHTML = rows.length
          ? gameTable(rows, g)
          : `<p class="card empty">아직 기록이 없어요. <a href="${esc(g.url)}">첫 도전하기 →</a></p>`;
        $("mine").innerHTML = me && !rows.some(isMe) ? `<p class="muted">내 순위</p>${gameTable([me], g)}` : "";
      }
    } catch (e) {
      console.error(e);
      $("board").innerHTML = `<p class="card empty">랭킹을 불러오지 못했어요. 새로고침해주세요.</p>`;
    } finally {
      busy = false;
    }
  }

  async function refreshAll() {
    try { await renderMine(); } catch (e) { console.error(e); }
    await renderBoard();
  }

  $("refresh").addEventListener("click", refreshAll);
  $("name-chip").addEventListener("click", async () => {
    const before = `${player.id}|${player.name}`;
    player = await MiniHub.changeName(); // 닉네임 바꾸기 / 다른 닉네임으로 접속
    if (`${player.id}|${player.name}` !== before) {
      renderName();
      refreshAll();
    }
  });
  // 화면을 보고 있을 때만 30초마다 자동 새로고침, 다른 탭(게임)에서 돌아오면 즉시 새로고침
  setInterval(() => { if (!document.hidden) refreshAll(); }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshAll(); });

  refreshAll();
})();
