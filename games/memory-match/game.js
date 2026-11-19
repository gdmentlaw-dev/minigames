'use strict';

const GAME_ID = 'memory-match';
const TRAY_SIZE = 7;
const MATCH_SIZE = 3;
const REFILL_INTERVAL = 5;
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
const message = document.querySelector('#status');
const startButton = document.querySelector('#start');
const dock = document.querySelector('#dock');
const trayDisplay = document.querySelector('#tray');
const trayCount = document.querySelector('#tray-count');
const shuffleButton = document.querySelector('#shuffle');
const undoButton = document.querySelector('#undo');
const returnButton = document.querySelector('#return');
const finishButton = document.querySelector('#finish');

let stage = 1;
let score = 0;
let cards = [];
let tray = [];
let items;
let playing = false;

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

function deal({ positions, width, height }) {
  const sets = Array.from({ length: positions.length / MATCH_SIZE }, (_, index) => index % PICTURES.length);
  shuffle(sets);
  // Deal triples in a valid removal order, randomizing the order within each layer.
  const removalOrder = shuffle([...positions]).sort((first, second) => second.layer - first.layer);
  removalOrder.forEach((card, index) => { card.type = sets[Math.floor(index / MATCH_SIZE)]; });
  cards = positions;
  board.style.setProperty('--board-width', width);
  board.style.setProperty('--board-height', height);
  board.style.setProperty('--card-width', CARD_WIDTH / width * 100 + '%');

  const buttons = document.createDocumentFragment();
  for (const card of cards) {
    card.blockers = cards.filter(other => other.layer > card.layer && overlaps(card, other)).map(other => other.id);
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

function updateDock() {
  const grouped = [...tray].sort((first, second) => first.type - second.type);
  storageSlots.forEach((slot, index) => {
    const card = grouped[index];
    slot.classList.toggle('filled', Boolean(card));
    if (card) showPicture(slot, card.type);
    else slot.setAttribute('aria-label', '빈 칸');
  });
  trayCount.textContent = tray.length + ' / ' + TRAY_SIZE;
  shuffleButton.textContent = '판 섞기 · ' + items.shuffle;
  undoButton.textContent = '한 장 되돌리기 · ' + items.undo;
  returnButton.textContent = '보관함 비우기 · ' + items.return;
  shuffleButton.disabled = !playing || items.shuffle === 0 || cards.length < 2;
  undoButton.disabled = !playing || items.undo === 0 || tray.length === 0;
  returnButton.disabled = !playing || items.return === 0 || tray.length === 0;
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

function collectCard(card) {
  if (!playing || card.button.disabled || !cards.includes(card)) return;
  const restoreFocus = document.activeElement === card.button;
  card.button.hidden = true;
  cards = cards.filter(other => other !== card);
  tray.push(card);

  const matching = tray.filter(other => other.type === card.type);
  if (matching.length === MATCH_SIZE) {
    for (const match of matching) match.button.remove();
    tray = tray.filter(other => other.type !== card.type);
    score += 10;
    scoreDisplay.textContent = score + '점';
    message.textContent = PICTURES[card.type] + ' 3장 완성! +10점';
  } else {
    message.textContent = PICTURES[card.type] + ' 보관 · 같은 그림 ' + matching.length + ' / 3장';
  }

  if (cards.length === 0 && tray.length === 0) {
    if (stage % REFILL_INTERVAL === 0) {
      items.shuffle++;
      items.undo++;
      items.return++;
    }
    stage++;
    startStage();
    return;
  }

  updateBoard();
  if (tray.length === TRAY_SIZE) {
    finishGame('보관함이 가득 찼어요.');
    return;
  }
  if (restoreFocus) {
    const next = board.querySelector('.card:not(:disabled):not([hidden])');
    (next ?? finishButton).focus({ preventScroll: true });
  }
}

function startStage() {
  const layout = createStageLayout(stage);
  deal(layout);
  stageDisplay.textContent = stage;
  const clearedStage = stage - 1;
  if (clearedStage === 0) {
    message.textContent = '카드를 오른쪽 클릭하거나 눌러 보관하세요. 같은 그림 3장이 모이면 사라져요.';
  } else {
    const refill = clearedStage % REFILL_INTERVAL === 0 ? ' 아이템을 각각 1개씩 받았어요.' : '';
    message.textContent = clearedStage + '스테이지 통과! 새 카드 ' + layout.positions.length + '장이 나왔어요.' + refill;
  }
  board.querySelector('.card:not(:disabled)').focus({ preventScroll: true });
}

function shuffleRemaining() {
  if (shuffleButton.disabled) return;
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
  if (!playing || items[item] === 0 || tray.length === 0) return;
  items[item]--;
  const returned = all ? tray.splice(0) : tray.splice(-1);
  for (const card of returned) {
    card.button.hidden = false;
    cards.push(card);
  }
  updateBoard();
  message.textContent = returned.length + '장을 원래 자리로 돌려보냈어요.';
}

function startGame() {
  if (playing || startButton.disabled) return;
  stage = 1;
  score = 0;
  tray = [];
  items = { shuffle: 1, undo: 1, return: 1 };
  scoreDisplay.textContent = '0점';
  playing = true;
  startButton.hidden = true;
  dock.hidden = false;
  finishButton.hidden = false;
  board.hidden = false;
  startStage();
}

async function finishGame(reason) {
  if (!playing) return;
  playing = false;
  board.hidden = true;
  finishButton.hidden = true;
  updateDock();
  startButton.textContent = '다시 하기';
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

if (typeof MiniHub === 'undefined') {
  message.textContent = '공용 랭킹 파일을 불러오지 못했어요. 최신 저장소를 Live Server로 열어 주세요.';
} else {
  MiniHub.init(GAME_ID);
  MiniHub.onReady(() => { startButton.disabled = false; });
  startButton.addEventListener('click', startGame);
  shuffleButton.addEventListener('click', shuffleRemaining);
  undoButton.addEventListener('click', () => returnCards(false));
  returnButton.addEventListener('click', () => returnCards(true));
  finishButton.addEventListener('click', () => finishGame('게임을 포기했어요.'));
}
