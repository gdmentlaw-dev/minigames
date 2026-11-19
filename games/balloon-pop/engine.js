"use strict";

const PARTY_STEP = 500;
const BALLOON_SPEED_MULTIPLIER = 2.2;

// 화면의 색·안내와 실제 점수·속도가 항상 같은 규칙을 쓰도록 한 곳에 둔다.
const BALLOON_RULES = Object.freeze({
  colors: Object.freeze([
    Object.freeze({ name: "분홍", light: "#ff91b5", dark: "#db4e81", points: 10, speed: 0.78, speedLabel: "느림" }),
    Object.freeze({ name: "하늘", light: "#8dcaff", dark: "#4c90dd", points: 20, speed: 1, speedLabel: "보통" }),
    Object.freeze({ name: "보라", light: "#bb9afa", dark: "#8560d1", points: 30, speed: 1.25, speedLabel: "빠름" }),
    Object.freeze({ name: "주황", light: "#ffaf8b", dark: "#e67b5d", points: 40, speed: 1.55, speedLabel: "아주 빠름" }),
  ]),
  gold: Object.freeze({ name: "노랑 별", light: "#ffe394", dark: "#edb441", points: 60, speed: 1.85, speedLabel: "가장 빠름" }),
  clock: Object.freeze({ name: "민트 시간", light: "#9ae9c8", dark: "#4eb89b", points: 15, speed: 0.9, speedLabel: "조금 느림" }),
  bomb: Object.freeze({ name: "감점 폭탄", light: "#9ae9c8", dark: "#4eb89b", points: 0, penalty: 100, speed: 1.1, speedLabel: "수직 상승" }),
});

function getBalloonSize(points, small = false) {
  const baseWidth = small ? 62 : 76;
  const baseHeight = small ? 77 : 94;
  // 풍선에 적힌 기본 점수로 크기를 정한다. 10점은 원래 크기, 60점은 약 70%.
  // 콤보나 누적 점수로는 크기를 바꾸지 않고, 터치 너비는 최소 44px을 유지한다.
  const pointScale = 1 - Math.min(50, Math.max(0, points - 10)) * 0.006;
  const scale = Math.max(44 / baseWidth, pointScale);
  return { width: baseWidth * scale, height: baseHeight * scale, scale };
}

function getBalloonPosition(balloon, dimensions, reducedMotion = false) {
  const { width, height, scale } = getBalloonSize(balloon.profile.points, dimensions.width <= 580);
  const progress = balloon.age / balloon.lifetime;
  const available = Math.max(0, dimensions.width - width - 10);
  let x;
  if (balloon.sideways) {
    // 좌우 이동은 실제 게임 규칙이므로 동작 줄이기 설정에서도 유지한다.
    const travel = balloon.x + Math.sin(balloon.age / balloon.wavePeriod * Math.PI * 2 + balloon.sway) * balloon.waveWidth;
    const reflected = 1 - Math.abs(((travel % 2 + 2) % 2) - 1);
    x = 5 + reflected * available;
  } else {
    const sway = reducedMotion || balloon.type === "bomb" ? 0 : Math.sin(balloon.age / 650 + balloon.sway) * 9;
    x = Math.max(5, Math.min(dimensions.width - width - 5, balloon.x * dimensions.width - width / 2 + sway));
  }
  return {
    x, y: dimensions.height + 10 - progress * (dimensions.height + height + 30),
    width, height, scale,
    rotation: reducedMotion || balloon.type === "bomb" ? 0 : Math.sin(balloon.age / 850 + balloon.sway) * 7,
  };
}

// 화면과 분리한 한 판의 규칙. 점수 저장은 game.js에서 공용 SDK로만 한다.
class BalloonRound {
  constructor({ random = Math.random, onEvent = () => {} } = {}) {
    this.random = random;
    this.onEvent = onEvent;
    this.phase = "idle";
    this.remaining = 30000;
    this.elapsed = 0;
    this.score = 0;
    this.peakScore = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.popped = 0;
    this.balloons = new Map();
    this.spawned = 0;
    this.nextSpawn = 0;
    this.nextId = 1;
    this.sinceBomb = 0;
    this.sinceClock = 0;
  }

  get level() { return 1 + Math.floor(this.elapsed / 15000); }
  get multiplier() { return 1 + Math.floor(this.combo / 5); }
  get hazardTier() { return Math.floor(this.peakScore / PARTY_STEP); }
  get bombEvery() { return Math.max(3, 9 - this.hazardTier); }
  get bombSpeedBoost() { return 1 + this.hazardTier * 0.18; }

  start() {
    if (this.phase !== "idle") return;
    this.phase = "playing";
    for (let i = 0; i < 4; i++) {
      const balloon = this.spawn();
      balloon.age = balloon.lifetime * (0.12 + i * 0.14);
    }
    this.nextSpawn = 550;
  }

  spawn(age = 0) {
    if (this.balloons.size >= 9) return;
    this.spawned++;
    this.sinceBomb++;
    this.sinceClock++;
    let type = "normal";
    if (this.sinceClock >= 7) { type = "clock"; this.sinceClock = 0; }
    else if (this.sinceBomb >= this.bombEvery) { type = "bomb"; this.sinceBomb = 0; }
    else if (this.random() < 0.16) type = "gold";
    let x = 0.09 + this.random() * 0.82;
    for (let i = 0; i < 8; i++) {
      if (![...this.balloons.values()].some(b => Math.abs(b.x - x) < 0.17 && Math.abs(b.age - age) < 850)) break;
      x = 0.09 + this.random() * 0.82;
    }
    const color = Math.floor(this.random() * BALLOON_RULES.colors.length);
    const profile = type === "normal" ? BALLOON_RULES.colors[color] : BALLOON_RULES[type];
    const baseLifetime = (Math.max(2100, 5400 - this.level * 240) + this.random() * 600) / profile.speed / BALLOON_SPEED_MULTIPLIER;
    const speedBoost = type === "bomb" ? this.bombSpeedBoost : 1;
    const balloon = {
      id: this.nextId++, type, x, age,
      baseLifetime, lifetime: Math.max(650, baseLifetime / speedBoost),
      color, profile, sway: this.random() * Math.PI * 2,
      sideways: type !== "bomb" && profile.points >= 40,
      waveWidth: profile.points >= 40 ? 0.27 : 0,
      wavePeriod: 1850,
    };
    this.balloons.set(balloon.id, balloon);
    return balloon;
  }

  tick(delta) {
    if (this.phase !== "playing" || !Number.isFinite(delta) || delta <= 0) return;
    const step = Math.min(delta, this.remaining);
    this.remaining = Math.max(0, this.remaining - step);
    this.elapsed += step;
    for (const balloon of this.balloons.values()) {
      balloon.age += step;
      if (balloon.age >= balloon.lifetime) {
        this.balloons.delete(balloon.id);
        if (balloon.type !== "bomb") {
          const brokeCombo = this.combo > 0;
          this.combo = 0;
          if (brokeCombo) this.onEvent({ type: "miss" });
        }
      }
    }
    if (this.remaining <= 0) { this.end(); return; }
    this.nextSpawn -= step;
    const interval = Math.max(280, 810 - this.level * 65);
    while (this.nextSpawn <= 0) {
      this.spawn();
      this.nextSpawn += interval;
    }
  }

  pop(id) {
    if (this.phase !== "playing") return null;
    const balloon = this.balloons.get(id);
    if (!balloon) return null;
    // 먼저 제거하여 한 풍선을 빠르게 여러 번 눌러도 한 번만 센다.
    this.balloons.delete(id);
    const previousScore = this.score;
    const previousPeak = this.peakScore;
    let points = 0;
    if (balloon.type === "bomb") {
      this.combo = 0;
      points = -Math.min(this.score, balloon.profile.penalty);
      this.score += points;
      this.remaining = Math.max(0, this.remaining - 3000);
    } else {
      points = balloon.profile.points * this.multiplier;
      this.score += points;
      this.popped++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      if (balloon.type === "clock") this.remaining += 3000;
    }
    this.peakScore = Math.max(this.peakScore, this.score);
    const first = Math.floor(previousPeak / PARTY_STEP) + 1;
    const last = this.hazardTier;
    // 감점 후 같은 구간을 다시 넘어도 축하·난이도 상승은 중복하지 않는다.
    const milestones = last >= first ? { first: first * PARTY_STEP, last: last * PARTY_STEP, count: last - first + 1 } : null;
    if (milestones) {
      for (const active of this.balloons.values()) {
        if (active.type !== "bomb") continue;
        const progress = active.age / active.lifetime;
        active.lifetime = Math.max(650, active.baseLifetime / this.bombSpeedBoost);
        active.age = progress * active.lifetime;
      }
    }
    const event = { type: "pop", balloon, points, combo: this.combo, milestones, previousScore };
    this.onEvent(event);
    if (this.remaining <= 0) this.end();
    return event;
  }

  pause() { if (this.phase === "playing") this.phase = "paused"; }
  resume() { if (this.phase === "paused") this.phase = "playing"; }
  end() {
    if (this.phase !== "playing" && this.phase !== "paused") return;
    this.phase = "over";
    this.onEvent({ type: "end", score: this.score });
  }
}
