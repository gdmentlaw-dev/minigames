'use strict';

const GAME_ID = 'memory-match';
const TRAY_SIZE = 7;
const MATCH_SIZE = 3;
const REFILL_INTERVAL = 5;
const SAVE_VERSION = 6;
const MATCH_DURATION = 400;
const BONUS_PER_SECOND = 10;
const RANK_LIMIT = 1000;
const STARTING_ITEMS = { shuffle: 1, undo: 1, return: 1 };
const PICTURES = [
  '선물 상자', '별', '편지', '블루베리 타르트',
  '리본', '버섯', '주전자', '고슴도치',
  '사과', '털모자', '도토리', '랜턴',
];
const ATLAS_COLUMNS = 4;
const ATLAS_ROWS = 3;
const intro = document.querySelector('#game-intro');
const gameMain = document.querySelector('main');
const board = document.querySelector('#board');
const stageDisplay = document.querySelector('#stage');
const countDisplay = document.querySelector('#count');
const scoreDisplay = document.querySelector('#score');
const clockDisplay = document.querySelector('#clock');
const message = document.querySelector('#status');
const startButton = document.querySelector('#start');
const gameoverListButton = document.querySelector('#gameover-stage-list');
const playScreen = document.querySelector('#play-screen');
const dock = document.querySelector('#dock');
const trayDisplay = document.querySelector('#tray');
const trayCount = document.querySelector('#tray-count');
const soundButton = document.querySelector('#sound');
const shuffleButton = document.querySelector('#shuffle');
const undoButton = document.querySelector('#undo');
const returnButton = document.querySelector('#return');
const pauseButton = document.querySelector('#pause');
const clearDialog = document.querySelector('#clear-dialog');
const clearSummary = document.querySelector('#clear-summary');
const pauseMenu = document.querySelector('#pause-menu');
const rewardMenu = document.querySelector('#reward-menu');
const rewardStage = document.querySelector('#reward-stage');
const rewardNextButton = document.querySelector('#reward-next');
const resumeButton = document.querySelector('#resume-game');
const pauseListButton = document.querySelector('#pause-stage-list');
const clearListButton = document.querySelector('#open-stage-list');
const clearStageLabel = document.querySelector('#clear-stage-label');
const clearTime = document.querySelector('#clear-time');
const clearBonusDisplay = document.querySelector('#clear-bonus');
const clearScore = document.querySelector('#clear-score');
const profileName = document.querySelector('#profile-name');
const profileScore = document.querySelector('#profile-score');
const profileRank = document.querySelector('#profile-rank');
const rankingButton = document.querySelector('#open-ranking');
const rankingDialog = document.querySelector('#ranking-dialog');
const rankingScroll = document.querySelector('#ranking-scroll');
const rankingRows = document.querySelector('#ranking-rows');
const rankingNote = document.querySelector('#ranking-note');
const nextStageButton = document.querySelector('#next-stage');
const stageList = document.querySelector('#stage-list');
const stageButtons = document.querySelector('#stage-buttons');
const stageListStatus = document.querySelector('#stage-list-status');

let stage = 1;
let score = 0;
let cards = [];
let tray = [];
let items;
let playing = false;
let progress = null;
let stageStart;
let playerId;
let playerName = '나';
let checkpointKey;
let soundEnabled = true;
let audioContext;
let stageStartedAt = 0;
let clearSeconds = 0;
let clearResult = null;
let latestScoreWrite = null;
let profileRequest = 0;
let rankingRequest = 0;
let pauseState = null;
let clockInterval;
const matchingCards = new Set();
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
trayDisplay.parentElement.style.setProperty('--match-duration', MATCH_DURATION + 'ms');

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [items[index], items[other]] = [items[other], items[index]];
  }
  return items;
}

function overlaps(first, second) {
  return Math.abs(first.x - second.x) < CARD_WIDTH && Math.abs(first.y - second.y) < CARD_HEIGHT;
}

function givePictures(positions) {
  const order = [];
  const visited = new Set();
  function visit(card) {
    if (visited.has(card.id)) return;
    visited.add(card.id);
    for (const id of card.blockers) visit(positions[id]);
    order.push(card);
  }
  shuffle([...positions]).forEach(visit);

  // A valid route exists, but finding a set often means uncovering cards in another layer.
  // Interleave up to three distinct sets at a time so this route fits the seven slots.
  const types = PICTURES.map((_, index) => index);
  const packetSize = MATCH_SIZE * MATCH_SIZE;
  let availableTypes = [];
  for (let start = 0; start < order.length; start += packetSize) {
    if (availableTypes.length === 0) availableTypes = shuffle([...types]);
    const count = Math.min(MATCH_SIZE, (order.length - start) / MATCH_SIZE);
    const packet = availableTypes.splice(0, count);
    for (let index = 0; index < count * MATCH_SIZE; index++) {
      order[start + index].type = packet[index % count];
    }
  }
}

function deal({ positions, width, height }) {
  for (const card of positions) {
    card.blockers = positions.filter(other => other.layer > card.layer && overlaps(card, other)).map(other => other.id);
  }
  givePictures(positions);
  cards = positions;
  board.style.setProperty('--board-width', width);
  board.style.setProperty('--board-height', height);
  board.style.setProperty('--card-width', CARD_WIDTH / width * 100 + '%');

  const buttons = document.createDocumentFragment();
  for (const card of cards) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'card';
    button.style.left = card.x / width * 100 + '%';
    button.style.top = card.y / height * 100 + '%';
    button.style.zIndex = card.layer;
    button.addEventListener('click', () => collectCard(card));
    button.addEventListener('contextmenu', event => {
      event.preventDefault();
      collectCard(card);
    });
    card.button = button;
    showPicture(button, card.type);
    buttons.appendChild(button);
  }
  board.replaceChildren(buttons);
  updateBoard();
}

function showPicture(element, picture) {
  const column = picture % ATLAS_COLUMNS;
  const row = Math.floor(picture / ATLAS_COLUMNS);
  const x = column * 100 / (ATLAS_COLUMNS - 1);
  const y = row * 100 / (ATLAS_ROWS - 1);
  element.style.setProperty('--picture-position', x + '% ' + y + '%');
  element.setAttribute('aria-label', PICTURES[picture]);
}

const storageSlots = Array.from({ length: TRAY_SIZE }, () => {
  const slot = document.createElement('li');
  slot.className = 'tray-slot';
  trayDisplay.appendChild(slot);
  return slot;
});

function renderTray() {
  const grouped = [...tray].sort((first, second) => first.type - second.type);
  const tiles = grouped.map(card => {
    if (!card.trayTile) {
      card.trayTile = document.createElement('span');
      card.trayTile.className = 'tray-tile';
      const face = document.createElement('span');
      face.className = 'tray-face';
      showPicture(face, card.type);
      card.trayTile.appendChild(face);
    }
    return card.trayTile;
  });
  if (storageSlots.every((slot, index) => slot.firstElementChild === (tiles[index] ?? null))) return;

  const previous = new Map();
  if (!reducedMotion.matches) {
    for (const tile of tiles) {
      if (tile.isConnected) previous.set(tile, tile.getBoundingClientRect().left);
      tile.getAnimations().forEach(animation => animation.cancel());
    }
  }
  storageSlots.forEach((slot, index) => {
    const tile = tiles[index];
    slot.classList.toggle('filled', Boolean(tile));
    if (slot.firstElementChild !== (tile ?? null)) {
      if (tile) slot.replaceChildren(tile);
      else slot.replaceChildren();
    }
    slot.setAttribute('aria-label', tile ? PICTURES[grouped[index].type] : '빈 칸');
  });
  for (const [tile, left] of previous) {
    const offset = left - tile.getBoundingClientRect().left;
    if (Math.abs(offset) > 0.5) {
      tile.animate([{ transform: 'translateX(' + offset + 'px)' }, { transform: 'translateX(0)' }],
        { duration: 175, easing: 'ease-out' });
    }
  }
}

function updateDock() {
  renderTray();
  trayCount.textContent = tray.length + ' / ' + TRAY_SIZE;
  shuffleButton.textContent = '판 섞기 · ' + items.shuffle;
  undoButton.textContent = '한 장 되돌리기 · ' + items.undo;
  returnButton.textContent = '보관함 비우기 · ' + items.return;
  const canPlay = stageIsActive() && matchingCards.size === 0;
  shuffleButton.disabled = !canPlay || items.shuffle === 0 || cards.length < 2;
  undoButton.disabled = !canPlay || items.undo === 0 || tray.length === 0;
  returnButton.disabled = !canPlay || items.return === 0 || tray.length === 0;
  pauseButton.hidden = !playing || clearResult !== null;
  pauseButton.disabled = pauseState !== null;
}

function stopClock() {
  clearInterval(clockInterval);
  clockInterval = undefined;
}

function bonusTarget(level) {
  return level <= 5 ? 120 : 150;
}

function elapsedSeconds(now = performance.now()) {
  return Math.max(0, Math.floor((now - stageStartedAt) / 1000));
}

function formatDuration(elapsed) {
  const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const seconds = String(elapsed % 60).padStart(2, '0');
  return minutes + ':' + seconds;
}

function updateClock(elapsed = elapsedSeconds()) {
  const label = formatDuration(elapsed);
  if (clockDisplay.textContent !== label) clockDisplay.textContent = label;
}

function startClock() {
  stopClock();
  stageStartedAt = performance.now();
  updateClock();
  clockInterval = setInterval(updateClock, 100);
}

function stageIsActive() {
  return playing && clearResult === null && pauseState === null;
}

function pauseGame() {
  if (!stageIsActive()) return;
  const now = performance.now();
  const clockRunning = clockInterval !== undefined;
  if (clockRunning) updateClock(elapsedSeconds(now));
  stopClock();
  const animations = dock.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running');
  for (const animation of animations) animation.pause();
  pauseState = { startedAt: now, clockRunning, animations, matches: [] };
  playScreen.classList.add('concealed');
  updateDock();
  showDialogPanel('pause');
  clearDialog.showModal();
  resumeButton.focus();
}

function resumeGame() {
  if (!pauseState) return;
  const paused = pauseState;
  pauseState = null;
  stageStartedAt += performance.now() - paused.startedAt;
  playScreen.classList.remove('concealed');
  if (paused.clockRunning) {
    updateClock();
    clockInterval = setInterval(updateClock, 100);
  }
  updateDock();
  clearDialog.close();
  pauseButton.focus();
  for (const animation of paused.animations) animation.play();
  for (const match of paused.matches) completeMatch(match);
}

function endPausedAttempt() {
  if (!pauseState) return;
  const endingScore = score + matchingCards.size / MATCH_SIZE * 10;
  for (const animation of pauseState.animations) animation.cancel();
  matchingCards.clear();
  pauseState = null;
  playing = false;
  playScreen.classList.remove('concealed');
  clearDialog.close();
  recordScore(endingScore, { toast: false });
}

function updateBoard() {
  const onBoard = new Set(cards.map(card => card.id));
  for (const card of cards) {
    const covered = card.blockers.some(id => onBoard.has(id));
    card.button.disabled = covered;
    card.button.classList.toggle('covered', covered);
  }
  countDisplay.textContent = cards.length + tray.length + '장';
  updateDock();
}

function playMatchSound() {
  if (!soundEnabled || !window.AudioContext) return;
  try {
    audioContext ??= new AudioContext();
    audioContext.resume().then(() => {
      if (!soundEnabled) return;
      const start = audioContext.currentTime;
      const note = audioContext.createOscillator();
      const volume = audioContext.createGain();
      note.type = 'sine';
      note.frequency.setValueAtTime(480, start);
      note.frequency.exponentialRampToValueAtTime(980, start + 0.065);
      volume.gain.setValueAtTime(0.001, start);
      volume.gain.exponentialRampToValueAtTime(0.12, start + 0.014);
      volume.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
      note.connect(volume);
      volume.connect(audioContext.destination);
      note.start(start);
      note.stop(start + 0.14);
    }).catch(() => {});
  } catch {
    // Audio can be unavailable even when the animation works.
  }
}

function animateMatch(matching) {
  playMatchSound();
  if (reducedMotion.matches) {
    completeMatch(matching);
    return;
  }
  const animations = matching.map(({ trayTile }, index) => {
    trayTile.classList.add('popping');
    const tilt = (index - 1) * 6;
    return trayTile.firstElementChild.animate([
      { transform: 'scale(1)', opacity: 1, easing: 'ease-out' },
      { transform: 'translateY(-3px) scale(1.2) rotate(' + tilt + 'deg)', opacity: 1, offset: 0.32, easing: 'ease-out' },
      { transform: 'translateY(-6px) scale(1.12) rotate(' + (tilt / 2) + 'deg)', opacity: 1, offset: 0.48, easing: 'ease-in' },
      { transform: 'translateY(-13px) scale(.26)', opacity: 0 },
    ], { duration: MATCH_DURATION, fill: 'forwards' });
  });

  const wrapper = trayDisplay.parentElement;
  const bounds = wrapper.getBoundingClientRect();
  const slots = matching.map(card => card.trayTile.parentElement.getBoundingClientRect());
  const burst = document.createElement('span');
  burst.className = 'match-burst';
  burst.setAttribute('aria-hidden', 'true');
  const first = slots[0];
  const last = slots.at(-1);
  const wave = document.createElement('span');
  wave.className = 'burst-wave';
  wave.style.left = (first.left + last.right) / 2 - bounds.left + 'px';
  wave.style.top = first.top + first.height / 2 - bounds.top + 'px';
  wave.style.width = last.right - first.left + 'px';
  burst.appendChild(wave);

  slots.forEach((slot, group) => {
    const origin = document.createElement('span');
    origin.className = 'burst-origin';
    const x = slot.left + slot.width / 2 - bounds.left;
    origin.style.left = x + 'px';
    origin.style.top = slot.top + slot.height / 2 - bounds.top + 'px';
    for (let index = 0; index < 8; index++) {
      const sparkle = document.createElement('i');
      const angle = index * Math.PI / 4 + group * Math.PI / 9;
      const distance = 31 + (group + index) % 3 * 12;
      const dx = Math.max(8 - x, Math.min(bounds.width - 8 - x, Math.cos(angle) * distance));
      sparkle.style.setProperty('--spark-x', dx + 'px');
      sparkle.style.setProperty('--spark-y', Math.sin(angle) * distance + 'px');
      origin.appendChild(sparkle);
    }
    burst.appendChild(origin);
  });
  wrapper.appendChild(burst);
  Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
    burst.remove();
    completeMatch(matching);
  });
}

function collectCard(card) {
  const now = performance.now();
  if (!stageIsActive() || tray.length >= TRAY_SIZE || card.button.disabled || !cards.includes(card)) return;
  const restoreFocus = document.activeElement === card.button;
  card.button.hidden = true;
  cards = cards.filter(other => other !== card);
  tray.push(card);

  const matching = tray.filter(other => other.type === card.type && !matchingCards.has(other));
  if (matching.length === MATCH_SIZE) {
    matching.forEach(match => matchingCards.add(match));
    if (cards.length === 0 && tray.every(other => matchingCards.has(other))) {
      clearSeconds = elapsedSeconds(now);
      stopClock();
      updateClock(clearSeconds);
    }
    updateBoard();
    animateMatch(matching);
  } else {
    message.textContent = PICTURES[card.type] + ' 보관 · 같은 그림 ' + matching.length + ' / 3장';
    updateBoard();
  }

  if (matchingCards.size === 0 && tray.length === TRAY_SIZE) {
    finishGame('보관함이 가득 찼어요.');
    return;
  }
  if (restoreFocus && playing) {
    const next = board.querySelector('.card:not(:disabled):not([hidden])');
    (next ?? pauseButton).focus({ preventScroll: true });
  }
}

function completeMatch(matching) {
  if (!matching.every(card => matchingCards.has(card))) return;
  if (pauseState) {
    pauseState.matches.push(matching);
    return;
  }
  for (const card of matching) {
    matchingCards.delete(card);
    card.button.remove();
  }
  tray = tray.filter(card => !matching.includes(card));
  score += 10;
  scoreDisplay.textContent = score + '점';
  message.textContent = PICTURES[matching[0].type] + ' 3장 완성! +10점';

  if (cards.length === 0 && tray.length === 0) {
    clearStage();
    return;
  }

  updateBoard();
}

function clearStage() {
  const bonus = Math.max(0, bonusTarget(stage) - clearSeconds) * BONUS_PER_SECOND;
  score += bonus;
  scoreDisplay.textContent = score + '점';
  const result = { stage, score, points: score - stageStart.score, bonus, seconds: clearSeconds };
  const refilled = stage < MAX_STAGE && stage % REFILL_INTERVAL === 0;
  clearResult = result;
  if (stage < MAX_STAGE) {
    const next = stage + 1;
    const nextItems = { ...items };
    if (refilled) {
      for (const item of Object.keys(nextItems)) nextItems[item]++;
    }
    result.nextStart = { score, items: nextItems };
    if (!progress.starts[next] || progress.starts[next].score < score) progress.starts[next] = result.nextStart;
    progress.stage = next;
    progress.unlocked = Math.max(progress.unlocked, next);
  } else {
    playing = false;
    progress.completed = true;
  }
  const record = { points: result.points, score: result.score, seconds: result.seconds };
  progress.records[stage] = bestClearRecord(record, progress.records[stage]);
  storeProgress();
  updateBoard();
  message.textContent = stage + '스테이지를 클리어했어요.';
  if (refilled) showReward(result);
  else showClearResult(result);
}

function showReward(result) {
  rewardStage.textContent = result.stage + '스테이지 클리어 보상';
  showDialogPanel('reward');
  clearDialog.showModal();
  rewardNextButton.focus();
}

function showClearResult(result) {
  showDialogPanel('clear');
  clearStageLabel.textContent = result.stage + '스테이지 클리어!';
  clearTime.textContent = formatDuration(result.seconds);
  clearBonusDisplay.textContent = '+' + result.bonus.toLocaleString('ko-KR') + '점';
  clearScore.textContent = result.score.toLocaleString('ko-KR') + '점';
  nextStageButton.hidden = !result.nextStart;
  if (!clearDialog.open) clearDialog.showModal();
  nextStageButton.hidden ? document.querySelector('#retry-stage').focus() : nextStageButton.focus();
  if (!result.nextStart) submitClearScore(result);
}

function formatRank(value) {
  return value == null ? '—' : Number(value).toLocaleString('ko-KR') + '위';
}

async function refreshPlayerSummary() {
  const request = ++profileRequest;
  profileName.textContent = playerName;
  let entry;
  try {
    await latestScoreWrite;
    entry = await MiniHub.getMyGameEntry(GAME_ID);
  } catch {
    // Keep the ranking fields unavailable if the request fails.
  }
  if (request === profileRequest) {
    profileScore.textContent = entry === undefined ? '—' : Number(entry?.score ?? 0).toLocaleString('ko-KR') + '점';
    profileRank.textContent = formatRank(entry?.rank);
  }
}

async function openRanking() {
  const request = ++rankingRequest;
  rankingRows.replaceChildren();
  rankingScroll.scrollTop = 0;
  rankingNote.textContent = '랭킹을 불러오는 중이에요…';
  rankingDialog.showModal();
  try {
    await latestScoreWrite;
    const ranking = await MiniHub.getGameRanking(GAME_ID, RANK_LIMIT);
    if (!Array.isArray(ranking)) throw new TypeError('Invalid ranking response');
    if (request === rankingRequest && rankingDialog.open) {
      renderRanking(ranking);
      rankingNote.textContent = ranking.length ? '' : '아직 등록된 점수가 없어요.';
    }
  } catch {
    if (request === rankingRequest && rankingDialog.open) rankingNote.textContent = '랭킹을 불러오지 못했어요.';
  }
}

function renderRanking(entries) {
  rankingRows.replaceChildren(...entries.map(entry => {
    const row = document.createElement('tr');
    const isCurrent = playerId && entry.player_id === playerId;
    if (isCurrent) row.className = 'current-record';
    for (const value of [
      formatRank(entry.rank),
      isCurrent ? entry.name + ' · 나' : entry.name,
      Number(entry.score).toLocaleString('ko-KR') + '점',
    ]) {
      const cell = row.insertCell();
      cell.textContent = value;
      cell.title = value;
    }
    return row;
  }));
}

function recordScore(points, options) {
  latestScoreWrite = MiniHub.submitScore(points, options).catch(() => null);
  return latestScoreWrite;
}

function submitClearScore(result) {
  result.submission ??= recordScore(result.score, { toast: false });
  return result.submission;
}

function showDialogPanel(view) {
  pauseMenu.hidden = view !== 'pause';
  rewardMenu.hidden = view !== 'reward';
  clearSummary.hidden = view !== 'clear';
  clearDialog.dataset.view = view;
  const heading = view === 'pause' ? 'pause-heading' : view === 'reward' ? 'reward-heading' : 'clear-stage-label';
  clearDialog.setAttribute('aria-labelledby', heading);
}

function renderStageList() {
  const focused = document.activeElement?.dataset.level;
  const entries = Array.from({ length: MAX_STAGE }, (_, index) => {
    const level = index + 1;
    const entry = document.createElement('li');
    const button = document.createElement('button');
    const completed = level < progress.unlocked || (level === MAX_STAGE && progress.completed);
    const record = progress.records[level];
    button.type = 'button';
    button.className = 'stage-row';
    button.dataset.level = level;
    button.disabled = level > progress.unlocked;
    const state = button.disabled ? '잠김' : completed ? '클리어' : '도전 가능';
    const points = record ? record.points.toLocaleString('ko-KR') + '점' : '—';
    const time = record ? formatDuration(record.seconds) : '—';
    const name = document.createElement('span');
    const nameText = document.createElement('strong');
    const stageState = document.createElement('small');
    nameText.textContent = level + '스테이지';
    stageState.textContent = state;
    name.append(nameText, stageState);
    button.appendChild(name);
    for (const text of [points, time]) {
      const cell = document.createElement('span');
      cell.textContent = text;
      button.appendChild(cell);
    }
    button.setAttribute('aria-label', level + '스테이지 ' + state +
      (record ? ', ' + points + ', ' + time : ''));
    if (completed) button.classList.add('completed');
    button.addEventListener('click', () => beginStage(level));
    entry.appendChild(button);
    return entry;
  });
  stageButtons.replaceChildren(...entries);
  if (focused) stageButtons.querySelector('[data-level="' + focused + '"]')?.focus({ preventScroll: true });
}

function showStageScreen() {
  if (pauseState) endPausedAttempt();
  if (clearResult) submitClearScore(clearResult);
  clearResult = null;
  playing = false;
  stopClock();
  if (clearDialog.open) clearDialog.close();
  pauseButton.hidden = true;
  playScreen.hidden = true;
  stageList.hidden = false;
  renderStageList();
  refreshPlayerSummary();
  window.scrollTo(0, 0);
  document.querySelector('#stage-list-heading').focus({ preventScroll: true });
}

function leaveClearForStage(level, starter, continuing = false) {
  const result = clearResult;
  if (!result || level > progress.unlocked) return;
  if (!continuing) submitClearScore(result);
  clearResult = null;
  clearDialog.close();
  beginStage(level, starter);
}

function startStage() {
  const layout = createStageLayout(stage);
  deal(layout);
  startClock();
  stageDisplay.textContent = stage;
  message.textContent = stage + '스테이지 시작! ' + formatDuration(bonusTarget(stage)) + ' 안에 클리어하면 남은 1초당 +10점이에요.';
  board.querySelector('.card:not([hidden]):not(:disabled)')?.focus({ preventScroll: true });
}

function shuffleRemaining() {
  if (shuffleButton.disabled || !stageIsActive()) return;
  items.shuffle--;
  const pictureCounts = new Map();
  for (const { type } of cards) pictureCounts.set(type, (pictureCounts.get(type) ?? 0) + 1);
  const groups = [];
  for (const [picture, count] of pictureCounts) {
    const remainder = count % MATCH_SIZE;
    for (let index = remainder; index < count; index += MATCH_SIZE) {
      groups.push([picture, picture, picture]);
    }
    if (remainder) groups.push(Array(remainder).fill(picture));
  }
  const accessible = shuffle(cards.filter(card => !card.button.disabled));
  const covered = shuffle(cards.filter(card => card.button.disabled));
  shuffle(groups);
  // When a complete set can be reached, place it among the exposed cards.
  const reachable = groups.findIndex(group => group.length <= accessible.length);
  if (reachable > 0) groups.unshift(groups.splice(reachable, 1)[0]);
  const pictures = groups.flat();
  const positions = accessible.concat(covered);
  positions.forEach((card, index) => {
    card.type = pictures[index];
    showPicture(card.button, card.type);
  });
  updateBoard();
  message.textContent = '판에 남은 카드의 그림을 모두 섞었어요.';
}

function returnCards(all) {
  const item = all ? 'return' : 'undo';
  if (!stageIsActive() || matchingCards.size > 0 || items[item] === 0 || tray.length === 0) return;
  items[item]--;
  const returned = all ? tray.splice(0) : tray.splice(-1);
  for (const card of returned) {
    card.button.hidden = false;
    card.trayTile = null;
    cards.push(card);
  }
  updateBoard();
  message.textContent = returned.length + '장을 원래 자리로 돌려보냈어요.';
}

function startGame() {
  if (playing || startButton.disabled) return;
  beginStage(progress?.stage ?? 1, stageStart);
}

function beginStage(level, starter) {
  if (!progress || level > progress.unlocked) return;
  stageStart = starter ?? progress.starts[level] ?? { score: baseScoreBefore(level), items: STARTING_ITEMS };
  if (progress.stage !== level || !progress.starts[level]) {
    progress.stage = level;
    progress.starts[level] ??= stageStart;
    storeProgress();
  }
  stage = level;
  score = stageStart.score;
  tray = [];
  items = { ...stageStart.items };
  scoreDisplay.textContent = score + '점';
  playing = true;
  stageList.hidden = true;
  playScreen.hidden = false;
  startButton.hidden = true;
  gameoverListButton.hidden = true;
  dock.hidden = false;
  board.hidden = false;
  window.scrollTo(0, 0);
  startStage();
}

async function finishGame(reason) {
  if (!playing || matchingCards.size > 0) return;
  playing = false;
  stopClock();
  board.hidden = true;
  updateDock();
  startButton.textContent = stage + '스테이지 다시 하기';
  startButton.hidden = false;
  startButton.disabled = true;

  const result = reason + ' ' + stage + '스테이지 · 최종 ' + score + '점.';
  message.textContent = result + ' 기록 저장 중…';
  try {
    const saved = await recordScore(score);
    message.textContent = saved ? result : result + ' 기록을 저장하지 못했어요.';
  } catch {
    message.textContent = result + ' 기록을 저장하지 못했어요.';
  } finally {
    startButton.disabled = false;
    gameoverListButton.hidden = false;
    startButton.focus();
  }
}

const baseScores = [0, 0];

function baseScoreBefore(level) {
  while (baseScores.length <= level) {
    const cleared = baseScores.length - 1;
    baseScores.push(baseScores[cleared] + createStageLayout(cleared).positions.length / MATCH_SIZE * 10);
  }
  return baseScores[level];
}

function readStageStart(level, entry) {
  const baseScore = baseScoreBefore(level);
  const cleared = level - 1;
  const bonusCap = (Math.min(cleared, 5) * bonusTarget(1) + Math.max(0, cleared - 5) * bonusTarget(6)) * BONUS_PER_SECOND;
  const score = entry?.score;
  const items = entry?.items;
  if (!Number.isInteger(score) || score < baseScore || score > baseScore + bonusCap ||
      !Object.keys(STARTING_ITEMS).every(item => Number.isSafeInteger(items?.[item]) && items[item] >= 0)) return null;
  return { score, items: { shuffle: items.shuffle, undo: items.undo, return: items.return } };
}

function bestClearRecord(first, second) {
  if (!first || !second) return first ?? second;
  if (first.points !== second.points) return first.points > second.points ? first : second;
  if (first.seconds !== second.seconds) return first.seconds < second.seconds ? first : second;
  if (first.score !== second.score) return first.score > second.score ? first : second;
  return first;
}

function readClearRecord(entry) {
  if (!entry || !['points', 'score', 'seconds'].every(key => Number.isSafeInteger(entry[key]) && entry[key] >= 0) ||
      entry.points > entry.score) return null;
  return { points: entry.points, score: entry.score, seconds: entry.seconds };
}

function readProgress(data) {
  if (!data || !Number.isInteger(data.stage) || data.stage < 1 || data.stage > MAX_STAGE) return null;
  const { stage } = data;
  if ([1, 2, 3, 4].includes(data.version)) {
    const score = data.version === 4 ? data.score : baseScoreBefore(stage);
    const entry = readStageStart(stage, { score, items: data.items });
    return entry && { version: SAVE_VERSION, stage, unlocked: stage, starts: { [stage]: entry }, records: {}, completed: false, updatedAt: 0 };
  }
  const { unlocked, updatedAt } = data;
  if ((data.version !== 5 && data.version !== SAVE_VERSION) || !Number.isInteger(unlocked) || unlocked < stage || unlocked > MAX_STAGE ||
      !Number.isSafeInteger(updatedAt) || updatedAt < 0) return null;
  const starts = {};
  const records = {};
  for (let level = 1; level <= unlocked; level++) {
    const entry = readStageStart(level, data.starts?.[level]);
    if (entry) starts[level] = entry;
    const record = readClearRecord(data.records?.[level]);
    if (record) records[level] = record;
  }
  return { version: SAVE_VERSION, stage, unlocked, starts, records, completed: unlocked === MAX_STAGE && data.completed === true, updatedAt };
}

function loadBrowserProgress() {
  if (!checkpointKey) return null;
  try {
    return readProgress(JSON.parse(localStorage.getItem(checkpointKey)));
  } catch {
    return null;
  }
}

function rememberStage() {
  if (!checkpointKey) return;
  try {
    localStorage.setItem(checkpointKey, JSON.stringify(progress));
  } catch {
    // Browser storage may be disabled.
  }
}

function syncProgress() {
  MiniHub.save(progress).catch(() => {});
}

function mergeProgress(local, remote) {
  if (!local || !remote) return local ?? remote;
  const latest = local.updatedAt !== remote.updatedAt
    ? (local.updatedAt > remote.updatedAt ? local : remote)
    : (local.unlocked >= remote.unlocked ? local : remote);
  const starts = { ...remote.starts };
  for (const [level, entry] of Object.entries(local.starts)) {
    if (!starts[level] || starts[level].score < entry.score) starts[level] = entry;
  }
  const records = { ...remote.records };
  for (const [level, entry] of Object.entries(local.records)) {
    records[level] = bestClearRecord(entry, records[level]);
  }
  return { ...latest, starts, records, unlocked: Math.max(local.unlocked, remote.unlocked), completed: local.completed || remote.completed };
}

function storeProgress() {
  progress.updatedAt = Math.max(Date.now(), progress.updatedAt + 1);
  progress = mergeProgress(progress, loadBrowserProgress());
  rememberStage();
  syncProgress();
}

function playIntro() {
  const fallback = setTimeout(dismiss, reducedMotion.matches ? 220 : 1600);
  function dismiss() {
    if (intro.hidden) return;
    clearTimeout(fallback);
    intro.hidden = true;
    gameMain.inert = false;
    if (typeof MiniHub !== 'undefined') MiniHub.init(GAME_ID);
  }
  if (reducedMotion.matches) return;
  intro.addEventListener('animationend', event => {
    if (event.target === intro && event.animationName === 'intro-exit') dismiss();
  });
  intro.classList.add('animate');
}

if (typeof MiniHub === 'undefined') {
  stageListStatus.textContent = '공용 랭킹 파일을 불러오지 못했어요. 최신 저장소를 Live Server로 열어 주세요.';
} else {
  MiniHub.onReady(async player => {
    playerId = player?.id;
    playerName = player?.name || '나';
    if (playerId) checkpointKey = GAME_ID + '_stage_' + playerId;
    let remote = null;
    try {
      remote = readProgress(await MiniHub.load());
    } catch {
      // A browser checkpoint can still be used when the server is unavailable.
    }
    const local = loadBrowserProgress();
    progress = mergeProgress(local, remote);
    startButton.disabled = false;
    if (progress) {
      rememberStage();
      if (JSON.stringify(progress) !== JSON.stringify(remote)) syncProgress();
    }
    progress ??= { version: SAVE_VERSION, stage: 1, unlocked: 1, starts: {}, records: {}, completed: false, updatedAt: 0 };
    stageListStatus.textContent = '스테이지를 선택해 시작하세요.';
    rankingButton.disabled = false;
    showStageScreen();
  });
  startButton.addEventListener('click', startGame);
  gameoverListButton.addEventListener('click', showStageScreen);
  rankingButton.addEventListener('click', openRanking);
  document.querySelector('#close-ranking').addEventListener('click', () => rankingDialog.close());
  soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    soundButton.textContent = soundEnabled ? '효과음 켜짐' : '효과음 꺼짐';
  });
  shuffleButton.addEventListener('click', shuffleRemaining);
  undoButton.addEventListener('click', () => returnCards(false));
  returnButton.addEventListener('click', () => returnCards(true));
  pauseButton.addEventListener('click', pauseGame);
  resumeButton.addEventListener('click', resumeGame);
  document.querySelector('#restart-stage').addEventListener('click', () => {
    endPausedAttempt();
    beginStage(stage, stageStart);
  });
  pauseListButton.addEventListener('click', showStageScreen);
  document.querySelector('#retry-stage').addEventListener('click', () => leaveClearForStage(stage, stageStart));
  nextStageButton.addEventListener('click', () => {
    if (clearResult?.nextStart) leaveClearForStage(stage + 1, clearResult.nextStart, true);
  });
  clearListButton.addEventListener('click', showStageScreen);
  rewardNextButton.addEventListener('click', () => {
    if (clearResult && clearDialog.dataset.view === 'reward') showClearResult(clearResult);
  });
  document.querySelector('#clear-home').addEventListener('click', async event => {
    event.preventDefault();
    const href = event.currentTarget.href;
    const result = clearResult;
    if (result) await submitClearScore(result);
    if (clearResult === result) location.href = href;
  });
  clearDialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (pauseState) resumeGame();
  });
}
playIntro();
