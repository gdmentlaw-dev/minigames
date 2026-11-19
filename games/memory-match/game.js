'use strict';

const GAME_ID = 'memory-match';
const STAGE_DURATION = 30_000;
const FRUITS = [
  ['🍎', '사과'], ['🍋', '레몬'], ['🍇', '포도'], ['🍓', '딸기'],
  ['🍒', '체리'], ['🍐', '배'], ['🍉', '수박'], ['🥝', '키위'],
  ['🍑', '복숭아'], ['🍍', '파인애플'], ['🥭', '망고'], ['🍌', '바나나'],
];
const LEVELS = [
  { rows: 3, columns: 3 },
  { rows: 3, columns: 4 },
  { rows: 4, columns: 4 },
  { rows: 4, columns: 5 },
  { rows: 4, columns: 6 },
];

const board = document.querySelector('#board');
const stageDisplay = document.querySelector('#stage');
const timeDisplay = document.querySelector('#time');
const scoreDisplay = document.querySelector('#score');
const message = document.querySelector('#status');
const startButton = document.querySelector('#start');

let stage = 1;
let score = 0;
let remainingPairs = 0;
let firstCard = null;
let flipTimer = null;
let stageTimer;
let deadline;
let playing = false;

function showCard(card, revealed) {
  card.classList.toggle('revealed', revealed);
  card.textContent = revealed ? card.dataset.symbol : '?';
  const description = revealed ? card.dataset.name : '뒤집힌 카드';
  card.setAttribute('aria-label', `${card.dataset.position}번, ${description}`);
}

function updateClock() {
  const remaining = deadline - performance.now();
  timeDisplay.textContent = `${Math.max(0, Math.ceil(remaining / 1000))}초`;
  if (remaining <= 0) finishGame();
  return playing;
}

function selectCard(card) {
  if (!playing || !updateClock() || flipTimer !== null || card === firstCard || card.disabled) return;
  showCard(card, true);
  if (firstCard === null) {
    firstCard = card;
    message.textContent = `${card.dataset.name} 카드를 열었습니다. 두 번째 카드를 고르세요.`;
    return;
  }

  const previous = firstCard;
  firstCard = null;
  if (previous.dataset.name === card.dataset.name) {
    for (const match of [previous, card]) {
      match.classList.add('matched');
      match.disabled = true;
    }
    score += 10;
    scoreDisplay.textContent = `${score}점`;
    remainingPairs--;
    if (remainingPairs === 0) {
      stage++;
      startStage();
      return;
    }
    message.textContent = `${card.dataset.name} 짝을 맞혔어요. 남은 짝 ${remainingPairs}개.`;
    board.querySelector('.card:not(:disabled)').focus();
    return;
  }

  message.textContent = '서로 다른 카드예요.';
  const revealTime = Math.max(250, 850 - (stage - 1) * 80);
  flipTimer = setTimeout(() => {
    showCard(previous, false);
    showCard(card, false);
    flipTimer = null;
  }, revealTime);
}

function startStage() {
  clearInterval(stageTimer);
  const { rows, columns } = LEVELS[Math.min(stage, LEVELS.length) - 1];
  remainingPairs = Math.floor(rows * columns / 2);
  firstCard = null;

  const fruits = FRUITS.slice(0, remainingPairs);
  const deck = [...fruits, ...fruits];
  for (let index = deck.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  if (deck.length < rows * columns) deck.splice(4, 0, null);

  board.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  board.style.setProperty('--board-width', `${columns * 90}px`);
  board.replaceChildren(...deck.map((fruit, index) => {
    if (fruit === null) {
      const empty = document.createElement('span');
      empty.className = 'empty';
      empty.setAttribute('aria-hidden', 'true');
      return empty;
    }
    const [symbol, name] = fruit;
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'card';
    card.dataset.position = index + 1;
    card.dataset.symbol = symbol;
    card.dataset.name = name;
    showCard(card, false);
    card.addEventListener('click', () => selectCard(card));
    return card;
  }));

  stageDisplay.textContent = stage;
  message.textContent = stage === 1
    ? '카드 두 장을 골라 같은 과일을 찾으세요.'
    : `스테이지 ${stage - 1} 통과! 새 카드에서 ${remainingPairs}쌍을 찾으세요.`;
  deadline = performance.now() + STAGE_DURATION;
  updateClock();
  stageTimer = setInterval(updateClock, 100);
  board.querySelector('.card').focus();
}

function startGame() {
  stage = 1;
  score = 0;
  scoreDisplay.textContent = '0점';
  playing = true;
  startButton.hidden = true;
  board.hidden = false;
  startStage();
}

async function finishGame() {
  if (!playing) return;
  playing = false;
  clearInterval(stageTimer);
  clearTimeout(flipTimer);
  flipTimer = null;
  board.hidden = true;
  startButton.textContent = '다시 하기';
  startButton.hidden = false;
  startButton.disabled = true;
  const result = `시간 종료! 스테이지 ${stage} · 최종 ${score}점.`;
  message.textContent = `${result} 기록 저장 중…`;
  try {
    const saved = await MiniHub.submitScore(score);
    message.textContent = saved ? result : `${result} 기록을 저장하지 못했어요.`;
  } catch {
    message.textContent = `${result} 기록을 저장하지 못했어요.`;
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
}
