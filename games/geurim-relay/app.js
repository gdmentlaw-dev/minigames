import { hubSessionToken } from "./identity.mjs";
import { cleanProgress, rememberRoom } from "./progress.mjs";

const GAME_ID = "geurim-relay";
const API_BASE = "https://geurim-relay.earthy-chick-9380.chatgpt.site/api";
const byId = (id) => document.getElementById(id);
const roomCodePattern = /^[A-HJ-NP-Z2-9]{7}$/u;
const colors = {
  red: "#e0463b", orange: "#f28c28", yellow: "#f2cb16", green: "#2b9b61",
  blue: "#286ee9", indigo: "#353a91", purple: "#8d48bc", black: "#20231e",
};
const canvas = byId("drawing");
const context = canvas.getContext("2d");
const roomParam = (new URLSearchParams(location.search).get("room") ?? "").trim().toUpperCase();
const code = roomCodePattern.test(roomParam) ? roomParam : "";
const roomRecord = (value) => progress.rooms.find((room) => room.code === value);
const tools = Array.from(document.querySelectorAll("[data-tool]"));
const savedDrawings = new Map();

let state;
let viewing = 0;
let mode = "join";
let loadingRooms = false;
let nextRooms = null;
let listedRooms = [];
let lobbyTimer;
let token = "";
let player;
let progress;
let ready = false;
let profile;
let lastSubmittedScore = -1;
let canDelete = false;
let brush = "black";
let strokes = [];
let points = 0;
let active;
let boardKey = "";
let draftKey = "";
let refreshing = false;
let editing = false;
let sending = false;
let drawingRequest = 0;
let countMessage = "";

MiniHub.onReady((current) => {
  byId("player-name").textContent = current.name + " 님으로 참여해요";
});

function getStored(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function putStored(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    return false;
  }
  return true;
}

function storedJSON(key, fallback) {
  try { return JSON.parse(getStored(key)) ?? fallback; } catch { return fallback; }
}

function progressKey() { return GAME_ID + "_" + player.id + "_progress"; }

async function saveProgress() {
  progress.updatedAt = Date.now();
  putStored(progressKey(), JSON.stringify(progress));
  const saved = await MiniHub.save(progress);
  if (!saved) status("room-status", "이 기기에는 저장했어요. 다른 기기에서 이어하려면 연결 후 다시 저장해 주세요.", true);
  return saved;
}

function updateChallenge() {
  const points = state?.myScore?.points ?? profile?.myScore?.points ?? 0;
  byId("challenge-score").textContent = points + "점";
  byId("my-total").textContent = "내 누적 " + points + "점 · 정답마다 5점";
  byId("delete-room").hidden = !canDelete;
}

async function recordGlobalScore() {
  const score = state?.myScore?.points ?? profile?.myScore?.points ?? 0;
  if (score <= 0 || score <= lastSubmittedScore) return;
  const result = await MiniHub.submitScore(score, { toast: false });
  if (result) lastSubmittedScore = score;
}

function renderRanking(result) {
  canDelete = result.canDelete ?? profile?.player?.isAdmin ?? false;
  if (result.myScore) {
    profile.myScore = result.myScore;
    updateChallenge();
  }
  const rankings = result.leaderboard ?? [];
  byId("no-rankings").hidden = rankings.length > 0;
  byId("leaderboard").replaceChildren(...rankings.map((entry) => {
    const row = node("li", undefined, "ranking-row");
    if (entry.rank <= 3) row.classList.add("place-" + entry.rank);
    const name = entry.name + (entry.id === player.id ? " (나)" : "");
    row.append(node("span", entry.rank + "위", "rank-badge"), node("strong", name), node("span", entry.points + "점", "rank-points"));
    return row;
  }));
}

function status(id, message = "", error = false) {
  const element = byId(id);
  element.textContent = message;
  element.classList.toggle("error", error);
  element.hidden = !message;
}

function node(tag, content, className) {
  const element = document.createElement(tag);
  if (content !== undefined) element.textContent = content;
  if (className) element.className = className;
  return element;
}

function roomURL(value) {
  const url = new URL("./", location.href);
  url.searchParams.set("room", value);
  return url;
}

async function api(path, body, useToken = true) {
  const headers = { "X-MiniHub-Token": await hubSessionToken() };
  if (useToken && token) headers.Authorization = "Bearer " + token;
  if (body) headers["Content-Type"] = "application/json";
  const response = await fetch(API_BASE + path, {
    method: body ? "POST" : "GET",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    credentials: "omit",
    signal: AbortSignal.timeout(20000),
  }).catch(() => { throw new Error("게임 서버에 연결하지 못했어요. 연결을 확인하고 다시 시도해 주세요."); });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error ?? "연결할 수 없어요. 잠시 뒤 다시 시도해 주세요.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function selectMode(value) {
  mode = value;
  const joining = mode === "join";
  byId("create-mode").setAttribute("aria-pressed", !joining);
  byId("join-mode").setAttribute("aria-pressed", joining);
  byId("room-browser").hidden = !joining;
  byId("invited-room").hidden = !joining || !code;
  byId("enter").hidden = joining && !code;
  byId("room-title-field").hidden = joining || !!profile?.owned?.title;
  byId("new-room-title").required = !joining && !profile?.owned?.title;
  byId("owned-room").hidden = joining || !profile?.owned;
  byId("owned-room").textContent = profile?.owned ? "이미 만든 방이 있어요. 이어서 참여해 주세요." : "";
  byId("enter").firstElementChild.textContent = joining ? "방 입장하기" : profile?.owned ? "내 방 이어하기" : "게임 시작";
  status("entry-status");
  if (joining && ready) void loadRooms();
}

function roomOption(room) {
  const item = node("li");
  const button = node("button", undefined, "room-option");
  button.type = "submit";
  button.name = "room";
  button.value = room.code;
  button.disabled = sending;
  const title = room.title || room.host + " 님의 방";
  const text = node("span", undefined, "room-option-text");
  text.append(node("strong", title), node("span", room.host + " · " + room.players + "명 참여 · " + room.round + "번째 문제", "room-option-meta"));
  button.append(text, node("span", room.published_at ? "맞히러 가기" : "출제 중", "room-option-state"));
  button.setAttribute("aria-label", title + " 입장, " + room.players + "명 참여, " + (room.published_at ? "풀이 중" : "출제 중"));
  item.append(button);
  if (canDelete) {
    const remove = node("button", "삭제", "tool danger room-delete");
    remove.type = "button";
    remove.setAttribute("aria-label", title + " 삭제");
    remove.addEventListener("click", () => void deleteRoom(room.code, title));
    item.append(remove);
  }
  return item;
}

function renderRecent() {
  const recentCodes = progress.rooms.map((room) => room.code);
  byId("recent").hidden = !recentCodes.length;
  const links = recentCodes.map((value, index) => {
    const room = listedRooms.find((entry) => entry.code === value);
    const link = node("a", room ? room.title || room.host + " 님의 방" : "참여한 방 " + (index + 1));
    link.href = roomURL(value).href;
    return link;
  });
  byId("recent").replaceChildren(node("strong", "최근 참여한 방"), ...links);
}

async function loadRooms(more = false, quiet = false) {
  if (loadingRooms || sending || byId("lobby").hidden || mode !== "join") return;
  loadingRooms = true;
  byId("refresh-rooms").disabled = true;
  byId("more-rooms").disabled = true;
  byId("room-list").setAttribute("aria-busy", "true");
  if (!quiet) status("rooms-status", "방을 불러오는 중…");
  try {
    const cursor = more && nextRooms ? "?before=" + encodeURIComponent(nextRooms) : "";
    const result = await api("/rooms" + cursor, undefined, false);
    renderRanking(result);
    const previous = more ? listedRooms : [];
    listedRooms = [...new Map([...previous, ...result.rooms].map((room) => [room.code, room])).values()];
    nextRooms = result.next;
    byId("room-list").replaceChildren(...listedRooms.map(roomOption));
    byId("more-rooms").hidden = !nextRooms;
    status("rooms-status", listedRooms.length ? "" : "아직 열린 방이 없어요. 새 방을 만들어 첫 그림을 남겨 보세요.");
    renderRecent();
  } catch (error) {
    status("rooms-status", error.message, true);
  } finally {
    loadingRooms = false;
    byId("refresh-rooms").disabled = false;
    byId("more-rooms").disabled = false;
    byId("room-list").setAttribute("aria-busy", "false");
  }
}

function showLobby() {
  byId("lobby").hidden = false;
  byId("room").hidden = true;
  byId("player-name").textContent = player.name + " 님으로 참여해요";
  selectMode("join");
  if (roomParam) {
    if (code) byId("join-title").textContent = "초대받은 방에 입장";
    else status("entry-status", "초대 링크를 확인하거나 목록에서 방을 골라 주세요.", true);
  }
  renderRecent();
  clearInterval(lobbyTimer);
  lobbyTimer = setInterval(() => {
    if (!document.hidden && listedRooms.length <= 20) void loadRooms(false, true);
  }, 30000);
}

byId("create-mode").addEventListener("click", () => selectMode("create"));
byId("join-mode").addEventListener("click", () => selectMode("join"));
byId("refresh-rooms").addEventListener("click", () => void loadRooms());
byId("more-rooms").addEventListener("click", () => void loadRooms(true));
byId("entry-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (sending || !ready) return;
  const joining = mode === "join";
  const entered = event.submitter?.name === "room" ? event.submitter.value : code;
  if (joining && !roomCodePattern.test(entered)) {
    status("entry-status", "입장할 방을 목록에서 골라 주세요.", true);
    return;
  }
  if (joining && roomRecord(entered)?.token) {
    location.assign(roomURL(entered));
    return;
  }

  sending = true;
  for (const id of ["enter", "create-mode", "join-mode"]) byId(id).disabled = true;
  for (const button of byId("room-list").querySelectorAll("button")) button.disabled = true;
  status("entry-status", "방에 들어가는 중…");
  try {
    const joined = await api(joining ? "/rooms/" + entered + "/join" : "/rooms", {
      title: byId("new-room-title").value,
      legacyRooms: progress.rooms,
    }, false);
    rememberRoom(progress, joined.code, joined.token);
    const saved = await saveProgress();
    if (saved || getStored(progressKey())) location.assign(roomURL(joined.code));
    else status("entry-status", "브라우저에서 사이트 저장 공간을 허용한 뒤 다시 입장해 주세요.", true);
  } catch (error) {
    status("entry-status", error.message, true);
  } finally {
    sending = false;
    for (const id of ["enter", "create-mode", "join-mode"]) byId(id).disabled = false;
    for (const button of byId("room-list").querySelectorAll("button")) button.disabled = false;
  }
});

function drawSegment(ctx, stroke, start, end) {
  const { points, tool, width } = stroke;
  ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
  ctx.strokeStyle = colors[tool] ?? "#000";
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (start === end) {
    ctx.arc(points[start], points[start + 1], width / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(points[start], points[start + 1]);
    for (let index = start + 2; index <= end; index += 2) ctx.lineTo(points[index], points[index + 1]);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

function drawAll(list) {
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (const stroke of list) drawSegment(context, stroke, 0, stroke.points.length - 2);
}

function saveDraft() {
  if (!draftKey) return;
  if (!putStored(draftKey, strokes.length ? JSON.stringify(strokes) : null)) {
    status("board-status", "브라우저에 임시 저장할 수 없어요. 그림을 올릴 때까지 이 화면을 열어 두세요.", true);
  }
}

function syncTools() {
  byId("undo").disabled = sending || !strokes.length;
  byId("clear").disabled = sending || !strokes.length;
  byId("publish").disabled = sending || !strokes.some((stroke) => stroke.tool !== "eraser");
  if (editing) byId("blank").hidden = strokes.length > 0;
}

function position(event) {
  const bounds = canvas.getBoundingClientRect();
  return [
    Math.round(Math.max(0, Math.min(canvas.width, (event.clientX - bounds.left) * canvas.width / bounds.width))),
    Math.round(Math.max(0, Math.min(canvas.height, (event.clientY - bounds.top) * canvas.height / bounds.height))),
  ];
}

canvas.addEventListener("pointerdown", (event) => {
  if (!editing || sending || active || event.button !== 0) return;
  if (strokes.length >= 500 || points >= 20_000) {
    status("board-status", "그림이 가득 찼어요. 마지막 획을 되돌리거나 그림을 올려 주세요.", true);
    return;
  }
  if (brush === "eraser" && !strokes.length) return;
  event.preventDefault();
  const stroke = { tool: brush, width: Number(byId("width").value), points: position(event) };
  active = { id: event.pointerId, stroke };
  canvas.setPointerCapture(event.pointerId);
  strokes.push(stroke);
  points++;
  drawSegment(context, stroke, 0, 0);
  syncTools();
});

canvas.addEventListener("pointermove", (event) => {
  if (active?.id !== event.pointerId) return;
  const stroke = active.stroke;
  const samples = event.getCoalescedEvents?.() ?? [];
  const start = stroke.points.length - 2;
  for (const sample of samples.length ? samples : [event]) {
    if (points >= 20_000) break;
    const [x, y] = position(sample);
    const last = stroke.points.length - 2;
    if (Math.hypot(x - stroke.points[last], y - stroke.points[last + 1]) < 2) continue;
    stroke.points.push(x, y);
    points++;
  }
  const end = stroke.points.length - 2;
  if (end > start) drawSegment(context, stroke, start, end);
});

function endStroke(event) {
  if (active?.id !== event.pointerId) return;
  active = null;
  saveDraft();
}

for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(event, endStroke);
window.addEventListener("pagehide", () => { if (active) saveDraft(); });

for (const button of tools) {
  button.addEventListener("click", () => {
    brush = button.dataset.tool;
    for (const other of tools) other.setAttribute("aria-pressed", other === button);
  });
}
byId("undo").addEventListener("click", () => {
  if (active || !strokes.length) return;
  points -= strokes.pop().points.length / 2;
  drawAll(strokes);
  saveDraft();
  syncTools();
});
byId("clear").addEventListener("click", () => {
  if (active || !confirm("그림을 모두 지울까요?")) return;
  strokes = [];
  points = 0;
  drawAll(strokes);
  saveDraft();
  syncTools();
});

function renderSidebar() {
  const playerList = state.players.map((player) => {
    const row = node("li", undefined, "player");
    const avatar = node("span", Array.from(player.name)[0], "avatar");
    avatar.setAttribute("aria-hidden", "true");
    row.append(avatar, node("span", player.name + (player.id === state.member.id ? " (나)" : ""), "player-name"),
      node("span", player.wins + "회 정답", "player-score"));
    return row;
  });
  byId("player-count").textContent = state.players.length + "명";
  byId("players").replaceChildren(...playerList);
  byId("no-history").hidden = state.history.length > 0;
  const historyList = state.history.map((round) => {
    const row = node("li");
    const button = node("button", undefined, "history-row");
    button.type = "button";
    button.setAttribute("aria-current", viewing === round.number);
    button.append(node("span", round.number + "회 · " + round.revealed), node("span", round.winner));
    button.addEventListener("click", () => {
      viewing = round.number;
      renderRoom(true);
      byId("round-title").focus();
    });
    row.append(button);
    return row;
  });
  byId("history").replaceChildren(...historyList);
}

async function renderPublished(round) {
  const request = ++drawingRequest;
  try {
    if (!savedDrawings.has(round.number)) {
      const drawing = await api("/rooms/" + code + "/rounds/" + round.number + "/drawing");
      if (savedDrawings.size >= 20) savedDrawings.delete(savedDrawings.keys().next().value);
      savedDrawings.set(round.number, drawing.strokes);
    }
    if (request !== drawingRequest) return;
    drawAll(savedDrawings.get(round.number));
    byId("blank").hidden = true;
  } catch (error) {
    if (request !== drawingRequest) return;
    boardKey = "";
    byId("blank-text").textContent = "그림을 불러오지 못했어요. 잠시 뒤 다시 불러옵니다.";
  }
}

function renderRoom(force = false) {
  byId("room-content").hidden = false;
  if (viewing && !state.history.some((round) => round.number === viewing)) viewing = 0;
  const round = viewing ? state.history.find((round) => round.number === viewing) : state.current;
  const selected = viewing ? state.history.find((round) => round.number === viewing) : state.current;
  const guesses = selected?.guesses ?? [];
  byId("no-guesses").hidden = guesses.length > 0;
  byId("guesses").replaceChildren(...guesses.map((guess) => {
    const row = node("li", undefined, "guess-row");
    row.append(node("span", guess.name, "guess-name"), node("strong", guess.answer));
    return row;
  }));
  byId("room-title").firstChild.textContent = (state.title || "우리 방") + " ";
  canDelete = state.canDelete;
  const sidebarKey = JSON.stringify([state.players, state.history, viewing]);
  if (force || sidebarKey !== countMessage) {
    countMessage = sidebarKey;
    renderSidebar();
  }
  const key = [round.number, round.published_at, round.winner_id].join("/");
  if (key === boardKey) return;
  boardKey = key;
  drawingRequest++;

  if (active) saveDraft();
  active = null;
  const isDrawer = round.drawer_id === state.member.id;
  const isPublished = !!round.published_at;
  editing = !viewing && isDrawer && !isPublished;
  draftKey = editing ? GAME_ID + "_" + player.id + "_draft_" + code + "_" + state.member.id + "_" + round.number : "";
  strokes = editing ? storedJSON(draftKey, []) : [];
  points = strokes.reduce((total, stroke) => total + stroke.points.length / 2, 0);

  byId("round-number").textContent = round.number + "번째 문제";
  byId("round-state").textContent = viewing ? "정답 공개" : isPublished ? "풀이 중" : "출제 중";
  byId("return-round").hidden = !viewing;
  byId("tools").hidden = !editing;
  byId("draw-actions").hidden = !editing;
  byId("guess-form").hidden = !!viewing || isDrawer || !isPublished;
  byId("paper").classList.toggle("editable", editing);
  byId("guess").value = "";
  byId("secret").hidden = !editing;
  byId("word").textContent = editing ? round.revealed : "";
  if (editing) {
    byId("dictionary").href = round.dictionary
      ? "https://ko.dict.naver.com/#/entry/koko/" + round.dictionary
      : "https://ko.dict.naver.com/#/search?query=" + encodeURIComponent(round.revealed);
  }
  status("board-status");

  let heading = "그림을 기다리는 중";
  let description = round.drawer + " 님이 그림을 올리면 이 방에서 풀 수 있어요.";
  let blank = "아직 그림이 올라오지 않았어요.";
  if (viewing) {
    heading = "정답은 " + round.revealed;
    description = round.drawer + " 님이 그렸고, " + round.winner + " 님이 가장 먼저 맞혔어요.";
  } else if (editing) {
    heading = "내가 그림을 그릴 차례";
    description = "아래 단어를 그림으로 표현해 주세요.";
    blank = "여기에 그림을 그려 보세요.";
  } else if (isPublished && isDrawer) {
    heading = "그림을 올렸어요";
    description = "가장 먼저 맞힌 친구가 다음 그림을 그려요.";
  } else if (isPublished) {
    heading = "이 그림은 뭘까요?";
    description = round.drawer + " 님의 그림 · 정답 " + round.letters + "글자";
  }

  byId("round-title").textContent = heading;
  byId("round-desc").textContent = description;
  byId("blank-text").textContent = isPublished ? "그림을 불러오는 중…" : blank;
  byId("blank").hidden = false;
  drawAll(strokes);
  if (editing) syncTools();
  if (isPublished) void renderPublished(round);
}

async function refresh() {
  if (refreshing || !token) return false;
  refreshing = true;
  try {
    const next = await api("/rooms/" + code);
    const advanced = state && next.current.number > state.current.number;
    state = next;
    renderRoom();
    updateChallenge();
    if (advanced) {
      const latest = next.history[0];
      status("room-status", latest.winner_id === next.member.id
        ? "정답! 다음 문제는 내가 내요."
        : latest.winner + " 님이 ‘" + latest.revealed + "’ 정답을 맞혔어요.");
    } else if (byId("room-status").classList.contains("error") || !byId("room-status").dataset.ready) {
      status("room-status");
    }
    byId("room-status").dataset.ready = "true";
    return true;
  } catch (error) {
    if (error.status === 401 || error.status === 404) {
      if (error.status === 404 && profile?.owned?.code === code) profile.owned = null;
      progress.rooms = progress.rooms.filter((room) => room.code !== code);
      await saveProgress();
      token = "";
      showLobby();
      status("entry-status", error.status === 404 ? "운영자가 삭제했거나 존재하지 않는 방이에요." : "이 방에 다시 입장해 주세요.", true);
    } else {
      status("room-status", "방을 불러오지 못했어요. 잠시 뒤 다시 연결합니다.", true);
    }
    return false;
  } finally {
    refreshing = false;
  }
}

byId("return-round").addEventListener("click", () => {
  viewing = 0;
  renderRoom(true);
  byId("round-title").focus();
});

byId("copy").addEventListener("click", async () => {
  const link = roomURL(code).href;
  try {
    await navigator.clipboard.writeText(link);
    byId("invite").hidden = true;
    status("room-status", "초대 링크를 복사했어요.");
  } catch {
    byId("invite").hidden = false;
    byId("invite-url").value = link;
    byId("invite-url").select();
    status("room-status", "아래 초대 링크를 복사해 주세요.");
  }
});

byId("publish").addEventListener("click", async () => {
  if (!editing || sending || active) return;
  const key = draftKey;
  if (!context.getImageData(0, 0, canvas.width, canvas.height).data.some((value, index) => index % 4 === 3 && value > 0)) {
    status("board-status", "그림을 그린 뒤 올려 주세요.", true);
    return;
  }
  sending = true;
  syncTools();
  status("board-status", "그림을 올리는 중…");
  try {
    await api("/rooms/" + code + "/rounds/" + state.current.number + "/drawing", { strokes });
    putStored(key, null);
    await refresh();
    status("room-status", "그림을 올렸어요. 친구에게 초대 링크를 보내 보세요.");
  } catch (error) {
    status("board-status", error.message, true);
  } finally {
    sending = false;
    syncTools();
    updateChallenge();
  }
});

byId("guess-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (sending || viewing) return;
  sending = true;
  byId("submit-guess").disabled = true;
  status("board-status", "정답 확인 중…");
  try {
    const response = await api("/rooms/" + code + "/rounds/" + state.current.number + "/guess", { answer: byId("guess").value });
    if (response.correct) {
      status("room-status", "정답! 다음 문제는 내가 내요.");
      await refresh();
      await saveProgress();
      await recordGlobalScore();
    } else {
      await refresh();
      status("board-status", "아쉬워요! 그림을 다시 보고 맞혀 보세요.", true);
      byId("guess").select();
    }
  } catch (error) {
    status("board-status", error.message, true);
    if (error.status === 409) await refresh();
  } finally {
    sending = false;
    byId("submit-guess").disabled = false;
    if (editing) syncTools();
    updateChallenge();
  }
});

function drawExample() {
  const ctx = byId("example").getContext("2d");
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = 4;
  ctx.strokeStyle = colors.black;
  ctx.fillStyle = "#fffefa";
  ctx.beginPath();
  ctx.moveTo(183, 102);
  ctx.bezierCurveTo(181, 73, 202, 47, 251, 29);
  ctx.bezierCurveTo(279, 56, 287, 79, 277, 103);
  ctx.quadraticCurveTo(235, 87, 183, 102);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e0463b";
  ctx.beginPath();
  ctx.moveTo(183, 102);
  ctx.quadraticCurveTo(237, 80, 277, 103);
  ctx.bezierCurveTo(266, 129, 206, 136, 183, 102);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = colors.green;
  ctx.beginPath();
  ctx.moveTo(248, 30);
  ctx.quadraticCurveTo(233, 12, 216, 18);
  ctx.quadraticCurveTo(226, 30, 248, 30);
  ctx.quadraticCurveTo(252, 15, 263, 11);
  ctx.stroke();
  ctx.strokeStyle = colors.blue;
  ctx.beginPath();
  ctx.moveTo(144, 48); ctx.lineTo(156, 58);
  ctx.moveTo(136, 71); ctx.lineTo(151, 70);
  ctx.moveTo(309, 101); ctx.lineTo(320, 94);
  ctx.moveTo(313, 113); ctx.lineTo(328, 115);
  ctx.stroke();
  ctx.fillStyle = colors.black;
  for (const [x, y] of [[216, 106], [237, 114], [253, 102]]) {
    ctx.beginPath();
    ctx.ellipse(x, y, 2.5, 4, -.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

drawExample();

byId("hub-exit").addEventListener("click", () => MiniHub.exit());
byId("change-name").addEventListener("click", async () => {
  await MiniHub.changeName();
  location.reload();
});

async function deleteRoom(roomCode, title) {
  if (sending || !canDelete || !confirm("‘" + title + "’ 방을 삭제할까요? 참가자의 누적 점수는 유지됩니다.")) return;
  sending = true;
  try {
    await api("/rooms/" + roomCode + "/delete", {}, false);
    if (!byId("room").hidden) location.assign(new URL("./", location.href));
  } catch (error) {
    status("entry-status", error.message, true);
  } finally {
    sending = false;
    if (!byId("lobby").hidden) {
      profile = await api("/me", undefined, false);
      selectMode(mode);
      await loadRooms();
    }
  }
}
byId("delete-room").addEventListener("click", () => void deleteRoom(code, state?.title || "현재 방"));

async function boot() {
  try {
    player = await MiniHub.init(GAME_ID);
    if (!player?.id || player.id === "offline") throw new Error("공용 사이트에 로그인한 뒤 다시 열어 주세요.");
    const local = cleanProgress(storedJSON(progressKey(), null), player.id);
    const remote = cleanProgress(await MiniHub.load(), player.id);
    progress = local.updatedAt > remote.updatedAt ? local : remote;
    profile = await api("/me", undefined, false);
    if (profile.realNameValid) {
      await api("/account/link", { rooms: progress.rooms }, false);
      profile = await api("/me", undefined, false);
    }
    canDelete = !!profile.player.isAdmin;
    ready = profile.realNameValid;
    byId("real-name-warning").hidden = ready;
    renderRanking(profile);
    updateChallenge();
    if (!ready) {
      showLobby();
      for (const id of ["enter", "create-mode"]) byId(id).disabled = true;
      return;
    }
    await recordGlobalScore();
    for (const id of ["enter", "create-mode", "join-mode"]) byId(id).disabled = false;
    token = code && roomRecord(code)?.token;
    if (code && token) {
      byId("lobby").hidden = true;
      byId("room").hidden = false;
      byId("room-code").textContent = code;
      status("room-status", "방을 불러오는 중…");
      await refresh();
      setInterval(() => { if (!document.hidden) void refresh(); }, 8000);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) void refresh(); });
    } else {
      showLobby();
    }
  } catch (error) {
    status("entry-status", error.message || "공용 계정에 연결하지 못했어요. 새로고침해 주세요.", true);
  }
}

void boot();
