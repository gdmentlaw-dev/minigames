'use strict';

const GAME_ID = 'memory-match';
const TRAY_SIZE = 7;
const MATCH_SIZE = 3;
const REFILL_INTERVAL = 5;
const SAVE_VERSION = 3;
const MATCH_DURATION = 400;
const STAGE_SECONDS = 120;
const EXTRA_SECONDS = 30;
const PICTURES = [
  '선물 상자', '별', '편지', '블루베리 타르트',
  '리본', '버섯', '주전자', '고슴도치',
  '사과', '털모자', '도토리', '랜턴',
];
const ATLAS_COLUMNS = 4;
const ATLAS_ROWS = 3;
const board = document.querySelector('#board');
const stageDisplay = document.querySelector('#stage');
const countDisplay = document.querySelector('#count');
const scoreDisplay = document.querySelector('#score');
const clockDisplay = document.querySelector('#clock');
const message = document.querySelector('#status');
const startButton = document.querySelector('#start');
const dock = document.querySelector('#dock');
const trayDisplay = document.querySelector('#tray');
const trayCount = document.querySelector('#tray-count');
const soundButton = document.querySelector('#sound');
const shuffleButton = document.querySelector('#shuffle');
const undoButton = document.querySelector('#undo');
const returnButton = document.querySelector('#return');
const timeItem = document.querySelector('#time-item');
const finishButton = document.querySelector('#finish');
const timeoutDialog = document.querySelector('#timeout');
const extendButton = document.querySelector('#extend-time');
const timeoutEndButton = document.querySelector('#timeout-end');

let stage = 1;
let score = 0;
let cards = [];
let tray = [];
let items;
let playing = false;
let checkpoint = null;
let checkpointKey;
let soundEnabled = true;
let audioContext;
let deadline = 0;
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
  timeItem.textContent = '시간 +30초 · ' + items.time;
  timeItem.classList.toggle('spent', items.time === 0);
  const canPlay = playing && performance.now() < deadline && matchingCards.size === 0;
  shuffleButton.disabled = !canPlay || items.shuffle === 0 || cards.length < 2;
  undoButton.disabled = !canPlay || items.undo === 0 || tray.length === 0;
  returnButton.disabled = !canPlay || items.return === 0 || tray.length === 0;
  finishButton.disabled = !canPlay;
}

function stopClock() {
  clearInterval(clockInterval);
  clockInterval = undefined;
}

function updateClock() {
  const left = Math.max(0, Math.ceil((deadline - performance.now()) / 1000));
  const minutes = String(Math.floor(left / 60)).padStart(2, '0');
  const seconds = String(left % 60).padStart(2, '0');
  const label = minutes + ':' + seconds;
  if (clockDisplay.textContent !== label) {
    clockDisplay.textContent = label;
    clockDisplay.classList.toggle('urgent', left <= 15);
  }
  if (left > 0 || !playing) return;

  stopClock();
  if (matchingCards.size > 0 || timeoutDialog.open) return;
  if (items.time > 0) {
    updateDock();
    timeoutDialog.showModal();
  } else {
    finishGame('시간이 다 됐어요.');
  }
}

function startClock(seconds) {
  stopClock();
  deadline = performance.now() + seconds * 1000;
  updateClock();
  updateDock();
  clockInterval = setInterval(updateClock, 100);
}

function stageIsActive() {
  if (!playing) return false;
  if (performance.now() < deadline) return true;
  updateClock();
  return false;
}

function extendTime() {
  if (!playing || !timeoutDialog.open || items.time === 0) return;
  items.time--;
  timeoutDialog.close();
  startClock(EXTRA_SECONDS);
  message.textContent = '시간을 30초 연장했어요.';
  board.querySelector('.card:not([hidden]):not(:disabled)')?.focus({ preventScroll: true });
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
  if (!stageIsActive() || tray.length >= TRAY_SIZE || card.button.disabled || !cards.includes(card)) return;
  const restoreFocus = document.activeElement === card.button;
  card.button.hidden = true;
  cards = cards.filter(other => other !== card);
  tray.push(card);

  const matching = tray.filter(other => other.type === card.type && !matchingCards.has(other));
  if (matching.length === MATCH_SIZE) {
    matching.forEach(match => matchingCards.add(match));
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
    (next ?? finishButton).focus({ preventScroll: true });
  }
}

function completeMatch(matching) {
  for (const card of matching) {
    matchingCards.delete(card);
    card.button.remove();
  }
  tray = tray.filter(card => !matching.includes(card));
  score += 10;
  scoreDisplay.textContent = score + '점';
  message.textContent = PICTURES[matching[0].type] + ' 3장 완성! +10점';

  if (cards.length === 0 && tray.length === 0) {
    if (stage === MAX_STAGE) {
      updateBoard();
      finishGame(MAX_STAGE + '개 스테이지를 모두 클리어했어요!');
      return;
    }
    if (stage % REFILL_INTERVAL === 0) {
      items.shuffle++;
      items.undo++;
      items.return++;
      items.time = 1;
    }
    stage++;
    saveStage();
    startStage();
    return;
  }

  updateBoard();
  updateClock();
}

function startStage(restarting = false) {
  const layout = createStageLayout(stage);
  deal(layout);
  startClock(STAGE_SECONDS);
  stageDisplay.textContent = stage;
  const clearedStage = stage - 1;
  if (restarting && stage > 1) {
    message.textContent = stage + '스테이지를 처음부터 다시 시작했어요.';
  } else if (clearedStage === 0) {
    message.textContent = '카드를 오른쪽 클릭하거나 눌러 보관하세요. 같은 그림 3장이 모이면 사라져요.';
  } else {
    const refill = clearedStage % REFILL_INTERVAL === 0 ? ' 아이템이 보충됐어요.' : '';
    message.textContent = clearedStage + '스테이지 통과! 새 카드 ' + layout.positions.length + '장이 나왔어요.' + refill;
  }
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
  stage = checkpoint?.stage ?? 1;
  score = 0;
  for (let cleared = 1; cleared < stage; cleared++) {
    score += createStageLayout(cleared).positions.length / MATCH_SIZE * 10;
  }
  tray = [];
  items = checkpoint ? { ...checkpoint.items } : { shuffle: 1, undo: 1, return: 1, time: 1 };
  scoreDisplay.textContent = score + '점';
  playing = true;
  startButton.hidden = true;
  dock.hidden = false;
  finishButton.hidden = false;
  board.hidden = false;
  if (!checkpoint) saveStage();
  startStage(true);
}

async function finishGame(reason) {
  if (!playing || matchingCards.size > 0) return;
  playing = false;
  stopClock();
  if (timeoutDialog.open) timeoutDialog.close();
  board.hidden = true;
  finishButton.hidden = true;
  updateDock();
  startButton.textContent = stage + '스테이지 다시 하기';
  startButton.hidden = false;
  startButton.disabled = true;

  const result = reason + ' ' + stage + '스테이지 · 최종 ' + score + '점.';
  message.textContent = result + ' 기록 저장 중…';
  try {
    const saved = await MiniHub.submitScore(score);
    message.textContent = saved ? result : result + ' 기록을 저장하지 못했어요.';
  } catch {
    message.textContent = result + ' 기록을 저장하지 못했어요.';
  } finally {
    startButton.disabled = false;
    startButton.focus();
  }
}

function readCheckpoint(data) {
  if (!data || ![1, 2, SAVE_VERSION].includes(data.version) ||
      !Number.isInteger(data.stage) || data.stage < 1 || data.stage > MAX_STAGE) return null;
  const { stage, items } = data;
  if (!['shuffle', 'undo', 'return'].every(item => Number.isSafeInteger(items?.[item]) && items[item] >= 0)) return null;
  const time = items.time ?? 1;
  if (time !== 0 && time !== 1) return null;
  return { version: SAVE_VERSION, stage, items: { shuffle: items.shuffle, undo: items.undo, return: items.return, time } };
}

function loadBrowserCheckpoint() {
  if (!checkpointKey) return null;
  try {
    return readCheckpoint(JSON.parse(localStorage.getItem(checkpointKey)));
  } catch {
    return null;
  }
}

function rememberStage() {
  if (!checkpointKey) return;
  try {
    localStorage.setItem(checkpointKey, JSON.stringify(checkpoint));
  } catch {
    // Browser storage may be disabled.
  }
}

function syncStage() {
  MiniHub.save(checkpoint).catch(() => {});
}

function saveStage() {
  checkpoint = { version: SAVE_VERSION, stage, items: { ...items } };
  const local = loadBrowserCheckpoint();
  if (local && local.stage > stage) return;
  // Keep the reached stage even if the tab closes before the server write completes.
  rememberStage();
  syncStage();
}

if (typeof MiniHub === 'undefined') {
  message.textContent = '공용 랭킹 파일을 불러오지 못했어요. 최신 저장소를 Live Server로 열어 주세요.';
} else {
  MiniHub.init(GAME_ID);
  MiniHub.onReady(async player => {
    if (player?.id) checkpointKey = GAME_ID + '_stage_' + player.id;
    let remote = null;
    try {
      remote = readCheckpoint(await MiniHub.load());
    } catch {
      // A browser checkpoint can still be used when the server is unavailable.
    }
    const local = loadBrowserCheckpoint();
    const localIsAhead = local && (!remote || local.stage > remote.stage);
    checkpoint = localIsAhead ? local : remote;
    startButton.disabled = false;
    if (checkpoint) {
      rememberStage();
      if (localIsAhead) syncStage();
      startGame();
    }
  });
  startButton.addEventListener('click', startGame);
  soundButton.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    soundButton.textContent = soundEnabled ? '효과음 켜짐' : '효과음 꺼짐';
  });
  shuffleButton.addEventListener('click', shuffleRemaining);
  undoButton.addEventListener('click', () => returnCards(false));
  returnButton.addEventListener('click', () => returnCards(true));
  finishButton.addEventListener('click', () => {
    if (stageIsActive()) finishGame('게임을 포기했어요.');
  });
  extendButton.addEventListener('click', extendTime);
  timeoutEndButton.addEventListener('click', () => finishGame('시간이 다 됐어요.'));
  timeoutDialog.addEventListener('cancel', event => {
    event.preventDefault();
    finishGame('시간이 다 됐어요.');
  });
}
