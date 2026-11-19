"use strict";

(() => {
  const GAME_ID = "balloon-pop";
  const $ = id => document.getElementById(id);
  const screens = ["start-screen", "countdown-screen", "pause-screen", "result-screen"];
  const nodes = new Map();
  const sounds = new Set();
  let round = null, frame = 0, lastFrame = 0, countdownTimer = 0, messageTimer = 0;
  let countdownValue = 3, countdownPaused = false, runId = 0, submitted = false;
  let soundOn = false, audio = null, dimensions = { width: 800, height: 460 };
  let displayedScore = -1, displayedCombo = -1, displayedTime = "", displayedLevel = -1;
  let celebrationTimer = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  try { soundOn = localStorage.getItem(`${GAME_ID}_sound`) === "on"; } catch {}

  function showScreen(id = null) {
    screens.forEach(name => { $(name).hidden = name !== id; });
  }

  function measure() {
    dimensions = { width: $("arena").clientWidth, height: $("arena").clientHeight };
    if (round) drawBalloons();
  }
  if (typeof ResizeObserver === "function") new ResizeObserver(measure).observe($("arena"));
  window.addEventListener("resize", measure);
  measure();

  function updateSoundButton() {
    $("sound-icon").setAttribute("href", soundOn ? "#i-sound" : "#i-mute");
    $("sound").setAttribute("aria-label", soundOn ? "소리 끄기" : "소리 켜기");
    $("sound").setAttribute("aria-pressed", String(soundOn));
  }

  function unlockAudio() {
    if (!soundOn) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    try {
      audio ||= new AudioContext();
      if (audio.state === "suspended") audio.resume().catch(() => {});
    } catch { audio = null; }
  }

  function tone(frequency, length = 0.07, type = "sine", volume = 0.055, delay = 0) {
    if (!soundOn || !audio || audio.state !== "running") return;
    try {
      const oscillator = audio.createOscillator(), gain = audio.createGain();
      const at = audio.currentTime + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, at);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(50, frequency * 0.45), at + length);
      gain.gain.setValueAtTime(volume, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + length);
      oscillator.connect(gain); gain.connect(audio.destination);
      sounds.add(oscillator);
      oscillator.start(at); oscillator.stop(at + length);
      oscillator.onended = () => { sounds.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
    } catch { /* 소리 장치가 없어도 게임은 계속한다. */ }
  }

  $("sound").addEventListener("click", () => {
    soundOn = !soundOn;
    try { localStorage.setItem(`${GAME_ID}_sound`, soundOn ? "on" : "off"); } catch {}
    unlockAudio(); updateSoundButton();
    if (soundOn) tone(650);
    else {
      for (const sound of sounds) { try { sound.stop(); } catch {} }
      sounds.clear();
    }
  });
  updateSoundButton();

  function renderLegend() {
    const entries = [
      ...BALLOON_RULES.colors.map(profile => ({ profile, type: "normal", symbol: "" })),
      { profile: BALLOON_RULES.gold, type: "gold", symbol: "★" },
      { profile: BALLOON_RULES.clock, type: "clock", symbol: "◷" },
      { profile: BALLOON_RULES.bomb, type: "bomb", symbol: "×" },
    ];
    const fragment = document.createDocumentFragment();
    for (const { profile, type, symbol } of entries) {
      const item = document.createElement("span"); item.className = "legend-item";
      const balloon = document.createElement("i"); balloon.className = `mini-balloon ${type}-mini`;
      balloon.style.setProperty("--guide-color", profile.light);
      balloon.style.setProperty("--guide-dark", profile.dark);
      balloon.setAttribute("aria-hidden", "true"); balloon.textContent = symbol;
      const copy = document.createElement("span"); copy.className = "legend-copy";
      const title = document.createElement("span"); title.textContent = `${profile.name} `;
      const value = document.createElement("b"); value.textContent = type === "bomb" ? "−3초" : `${profile.points}점`;
      title.appendChild(value);
      const speed = document.createElement("small");
      speed.textContent = `${profile.speedLabel}${type === "clock" ? " · +3초" : ""}`;
      copy.append(title, speed); item.append(balloon, copy); fragment.appendChild(item);
    }
    $("legend").replaceChildren(fragment);
  }
  renderLegend();

  function announce(text) {
    clearTimeout(messageTimer);
    $("live-message").textContent = text;
    messageTimer = setTimeout(() => { $("live-message").textContent = ""; }, 1450);
  }

  function position(balloon) {
    const small = dimensions.width <= 580;
    const width = small ? 62 : 76, height = small ? 77 : 94;
    const progress = balloon.age / balloon.lifetime;
    const sway = reducedMotion ? 0 : Math.sin(balloon.age / 650 + balloon.sway) * 14;
    return {
      x: Math.max(5, Math.min(dimensions.width - width - 5, balloon.x * dimensions.width - width / 2 + sway)),
      y: dimensions.height + 10 - progress * (dimensions.height + height + 30),
      width, height,
      rotation: reducedMotion ? 0 : Math.sin(balloon.age / 850 + balloon.sway) * 7,
    };
  }

  function createBalloon(balloon) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = `balloon ${balloon.type}`;
    const profile = balloon.profile;
    let label = `${profile.name} 풍선, 기본 ${profile.points}점, ${profile.speedLabel}`, symbol = "";
    if (balloon.type === "gold") symbol = '<svg class="balloon-symbol" aria-hidden="true"><use href="#i-star"/></svg>';
    if (balloon.type === "clock") { label += ", 3초 추가"; symbol = '<svg class="balloon-symbol" aria-hidden="true"><use href="#i-clock"/></svg>'; }
    if (balloon.type === "bomb") { label = "회색 폭탄, 누르면 3초 감소"; symbol = '<svg class="balloon-symbol" aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>'; }
    element.style.setProperty("--balloon", profile.light);
    element.style.setProperty("--balloon-dark", profile.dark);
    element.setAttribute("aria-label", label);
    element.innerHTML = `<span class="balloon-shape">${symbol}</span>`;
    if (balloon.type !== "bomb") {
      const badge = document.createElement("span"); badge.className = "balloon-points";
      badge.setAttribute("aria-hidden", "true"); badge.textContent = `+${profile.points}`;
      element.appendChild(badge);
    }
    element.addEventListener("pointerdown", event => {
      if (event.button !== 0) return;
      event.preventDefault();
      pop(balloon.id);
    });
    // 키보드·보조기기의 버튼 활성화도 지원한다. 포인터 클릭과 중복 집계하지 않는다.
    element.addEventListener("click", event => { if (event.detail === 0) pop(balloon.id); });
    $("balloons").appendChild(element);
    nodes.set(balloon.id, element);
    return element;
  }

  function drawBalloons() {
    for (const [id, node] of nodes) {
      if (!round.balloons.has(id)) { node.remove(); nodes.delete(id); }
    }
    for (const balloon of round.balloons.values()) {
      const node = nodes.get(balloon.id) || createBalloon(balloon);
      const p = position(balloon);
      node.style.transform = `translate(${p.x}px, ${p.y}px) rotate(${p.rotation}deg)`;
      node.style.width = `${p.width}px`; node.style.height = `${p.height}px`;
      const offscreen = p.y + p.height < 0 || p.y > dimensions.height;
      node.tabIndex = offscreen || round.phase !== "playing" ? -1 : 0;
    }
  }

  function updateHUD(force = false) {
    if (!round) return;
    if (force || displayedScore !== round.score) {
      $("score").textContent = round.score.toLocaleString("ko-KR");
      $("popped").textContent = `터뜨린 풍선 ${round.popped}개`;
      $("next-milestone").textContent = `다음 폭죽 ${(Math.floor(round.score / 100) * 100 + 100).toLocaleString("ko-KR")}점`;
      displayedScore = round.score;
    }
    if (force || displayedCombo !== round.combo) {
      $("multiplier").textContent = `×${round.multiplier}`;
      $("combo").textContent = `${round.combo} 콤보`;
      $("combo-hint").textContent = round.combo ? `${5 - round.combo % 5}개 더 터뜨리면 ×${round.multiplier + 1}!` : "5개 연속 성공마다 배수 UP!";
      displayedCombo = round.combo;
    }
    const seconds = (Math.ceil(round.remaining / 100) / 10).toFixed(1);
    if (force || displayedTime !== seconds) {
      $("time").textContent = seconds;
      $("time-fill").style.width = `${Math.min(100, round.remaining / 300)}%`;
      $("time-progress").setAttribute("aria-valuenow", String(Math.ceil(round.remaining / 1000)));
      $("time-progress").setAttribute("aria-valuemax", String(Math.max(30, Math.ceil(round.remaining / 1000))));
      $("time-stat").classList.toggle("urgent", round.remaining <= 7000);
      displayedTime = seconds;
    }
    if (force || displayedLevel !== round.level) {
      $("level").textContent = `LEVEL ${round.level}`;
      if (round.level > 1 && displayedLevel >= 1) announce(`LEVEL ${round.level} · 풍선이 더 빨라져요!`);
      displayedLevel = round.level;
    }
  }

  function burst(event) {
    const p = position(event.balloon);
    const x = p.x + p.width / 2, y = p.y + p.height / 2;
    const fragment = document.createDocumentFragment();
    const colors = event.balloon.type === "bomb" ? ["#b4a5dd", "#fca4ac"] : ["#ffc83d", "#f498ba", "#b09bf2", "#8dcaff", "#9ae9c8"];
    if (!reducedMotion) for (let i = 0; i < 12; i++) {
      const bit = document.createElement("i"); bit.className = "particle";
      const angle = i / 12 * Math.PI * 2, distance = 35 + Math.random() * 55;
      bit.style.setProperty("--x", `${x}px`); bit.style.setProperty("--y", `${y}px`);
      bit.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      bit.style.setProperty("--dy", `${Math.sin(angle) * distance + 20}px`);
      bit.style.backgroundColor = colors[i % colors.length];
      fragment.appendChild(bit);
      setTimeout(() => bit.remove(), 650);
    }
    const text = document.createElement("span"); text.className = "score-float";
    text.style.left = `${Math.max(42, Math.min(dimensions.width - 42, x))}px`;
    text.style.top = `${Math.max(42, y)}px`;
    text.style.color = event.balloon.type === "bomb" ? "#ff97ad" : event.balloon.type === "clock" ? "#9ae9c8" : "#ffe091";
    text.textContent = event.balloon.type === "bomb" ? "−3초" : `+${event.points}`;
    if (event.balloon.type === "clock") { const extra = document.createElement("small"); extra.textContent = "+3초"; text.appendChild(extra); }
    fragment.appendChild(text); $("effects").appendChild(fragment);
    setTimeout(() => text.remove(), 900);
  }

  function clearCelebration() {
    clearTimeout(celebrationTimer);
    $("celebrations").replaceChildren();
    $("score-card").classList.remove("celebrating");
  }

  function celebrateMilestones({ first, last, count }) {
    clearCelebration();
    const celebration = document.createElement("div"); celebration.className = "milestone-party";
    celebration.style.setProperty("--party-hue", String((last / 100 * 47) % 360));
    const glow = document.createElement("div"); glow.className = "party-glow";
    const rays = document.createElement("div"); rays.className = "party-rays";
    celebration.append(glow, rays);
    for (let i = 0; i < 3; i++) {
      const ring = document.createElement("i"); ring.className = "party-ring";
      ring.style.setProperty("--delay", `${i * 0.18}s`); celebration.appendChild(ring);
    }

    const caption = document.createElement("div"); caption.className = "milestone-banner";
    const cheer = document.createElement("span"); cheer.className = "milestone-cheer";
    cheer.textContent = count > 1 ? `${count.toLocaleString("ko-KR")}개 구간 연속 돌파!` : "팡팡! 축하해요!";
    const score = document.createElement("strong"); score.textContent = `${last.toLocaleString("ko-KR")}점 돌파!`;
    const reached = document.createElement("span"); reached.className = "milestone-reached";
    if (count === 1) reached.textContent = "✦ POP! POP! PARTY! ✦";
    else if (count <= 4) reached.textContent = Array.from({ length: count }, (_, i) => `${(first + i * 100).toLocaleString("ko-KR")}점`).join(" · ");
    else reached.textContent = `${first.toLocaleString("ko-KR")}~${last.toLocaleString("ko-KR")}점 · 모든 100점 구간 달성!`;
    caption.append(cheer, score, reached); celebration.appendChild(caption);

    if (!reducedMotion) {
      const colors = ["#ffd44d", "#ff7ab5", "#79ddff", "#c599ff", "#8dffd1", "#ffab76"];
      // 한 번에 여러 구간을 넘어도 효과 수를 제한하여 휴대폰에서 부드럽게 재생한다.
      const fireworkCount = Math.min(5, 2 + count);
      const pieces = dimensions.width <= 580 ? 18 : 26;
      for (let firework = 0; firework < fireworkCount; firework++) {
        const centerX = (0.14 + firework / Math.max(1, fireworkCount - 1) * 0.72) * dimensions.width;
        const centerY = (firework % 2 === 0 ? 0.31 : 0.64) * dimensions.height;
        for (let i = 0; i < pieces; i++) {
          const spark = document.createElement("i"); spark.className = "party-spark";
          const angle = i / pieces * Math.PI * 2;
          const distance = 45 + Math.random() * Math.min(dimensions.width * 0.22, 150);
          spark.style.left = `${centerX}px`; spark.style.top = `${centerY}px`;
          spark.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
          spark.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
          spark.style.setProperty("--delay", `${firework * 0.13}s`);
          spark.style.setProperty("--spark-color", colors[(i + firework) % colors.length]);
          celebration.appendChild(spark);
        }
      }
      const confettiCount = dimensions.width <= 580 ? 28 : 46;
      for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement("i"); confetti.className = "party-confetti";
        confetti.style.left = `${Math.random() * 100}%`;
        confetti.style.setProperty("--fall", `${dimensions.height + 60}px`);
        confetti.style.setProperty("--drift", `${Math.random() * 170 - 85}px`);
        confetti.style.setProperty("--delay", `${Math.random() * 0.3}s`);
        confetti.style.setProperty("--spin", `${Math.random() * 720 - 360}deg`);
        confetti.style.backgroundColor = colors[i % colors.length];
        celebration.appendChild(confetti);
      }
    }
    $("celebrations").appendChild(celebration);
    void $("score-card").offsetWidth;
    $("score-card").classList.add("celebrating");
    announce(count > 1 ? `${first}점부터 ${last}점까지, ${count}개 구간 돌파!` : `${last}점 돌파! 축하해요!`);
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((frequency, i) => tone(frequency, 0.16, "triangle", 0.045, i * 0.07));
    celebrationTimer = setTimeout(clearCelebration, 2100);
  }

  function onRoundEvent(event) {
    if (event.type === "end") { endRound(); return; }
    if (event.type === "miss") { announce("아쉬워요! 다시 콤보를 쌓아 봐요."); return; }
    if (event.type !== "pop") return;
    nodes.get(event.balloon.id)?.remove(); nodes.delete(event.balloon.id);
    burst(event);
    if (event.balloon.type === "bomb") {
      tone(110, 0.16, "triangle", 0.07);
      announce("앗, 폭탄! −3초");
      $("arena").classList.remove("boom");
      void $("arena").offsetWidth;
      $("arena").classList.add("boom");
    } else {
      tone(event.balloon.type === "clock" ? 1050 : 540 + (event.combo % 8) * 65);
      if (event.combo % 5 === 0) announce(`${event.combo} 콤보! 이제 점수 ×${round.multiplier}`);
      else if (event.balloon.type === "clock") announce("시간 풍선! +3초 더 팡팡!");
    }
    if (event.milestones) celebrateMilestones(event.milestones);
  }

  function step(now) {
    if (!round || round.phase !== "playing") return;
    const delta = Math.max(0, now - lastFrame);
    lastFrame = now;
    round.tick(delta);
    updateHUD();
    if (round.phase !== "playing") return;
    drawBalloons();
    frame = requestAnimationFrame(step);
  }

  function pop(id) {
    if (!round || round.phase !== "playing") return;
    // 다음 프레임 전에 시간이 다 됐다면 늦게 누른 풍선은 점수로 세지 않는다.
    const now = performance.now();
    round.tick(Math.max(0, now - lastFrame)); lastFrame = now;
    round.pop(id);
    updateHUD();
  }

  function beginPlay() {
    showScreen();
    round.start();
    $("pause").disabled = false;
    $("pause").focus({ preventScroll: true });
    lastFrame = performance.now();
    updateHUD(true); drawBalloons();
    frame = requestAnimationFrame(step);
  }

  function advanceCountdown() {
    if (document.hidden || countdownPaused) return;
    if (countdownValue <= 0) { beginPlay(); return; }
    $("countdown").textContent = countdownValue;
    tone(420 + (3 - countdownValue) * 100, 0.09);
    countdownValue--;
    countdownTimer = setTimeout(advanceCountdown, 750);
  }

  function startRound() {
    if (round && ["playing", "paused", "idle"].includes(round.phase)) return;
    unlockAudio();
    cancelAnimationFrame(frame); clearTimeout(countdownTimer); clearTimeout(messageTimer);
    runId++; submitted = false; countdownValue = 3; countdownPaused = false;
    nodes.clear(); $("balloons").replaceChildren(); $("effects").replaceChildren(); clearCelebration();
    $("live-message").textContent = "";
    $("arena").classList.remove("boom");
    round = new BalloonRound({ onEvent: onRoundEvent });
    displayedScore = -1; displayedCombo = -1; displayedTime = ""; displayedLevel = -1;
    updateHUD(true);
    $("pause").disabled = true;
    showScreen("countdown-screen");
    advanceCountdown();
  }

  function pauseRound() {
    if (!round || round.phase !== "playing") return;
    round.tick(Math.max(0, performance.now() - lastFrame));
    if (round.phase !== "playing") return;
    round.pause(); cancelAnimationFrame(frame);
    drawBalloons(); updateHUD();
    $("pause").disabled = true;
    showScreen("pause-screen");
    $("resume").focus({ preventScroll: true });
  }

  function resumeRound() {
    if (!round || round.phase !== "paused" || document.hidden) return;
    unlockAudio(); round.resume(); showScreen();
    $("pause").disabled = false;
    $("pause").focus({ preventScroll: true });
    lastFrame = performance.now();
    frame = requestAnimationFrame(step);
  }

  async function endRound() {
    if (submitted) return;
    submitted = true;
    cancelAnimationFrame(frame); clearTimeout(messageTimer); clearCelebration();
    const finishedRun = runId;
    const score = Math.max(0, Math.floor(round.score));
    updateHUD();
    nodes.clear(); $("balloons").replaceChildren();
    $("pause").disabled = true; $("live-message").textContent = "";
    $("final-score").textContent = score.toLocaleString("ko-KR");
    $("final-popped").textContent = `${round.popped}개`;
    $("final-combo").textContent = `${round.maxCombo}콤보`;
    $("final-duration").textContent = `${(round.elapsed / 1000).toFixed(1)}초`;
    $("result-title").textContent = round.popped > 0 ? "오늘도 팡팡 터뜨렸어요!" : "다음엔 풍선을 톡 눌러 봐요!";
    $("save-status").textContent = "기록을 저장하고 있어요…";
    showScreen("result-screen");
    $("retry").focus({ preventScroll: true });
    tone(780, 0.18, "triangle");
    let result = null;
    try {
      // 한 판 종료마다 이 한 곳에서만 정확히 1회 호출한다. 최고 기록 비교는 SDK가 한다.
      if (window.MiniHub) result = await MiniHub.submitScore(score);
    } catch { /* 저장 실패 안내는 결과 화면에 표시한다. */ }
    // 저장을 기다리는 사이 새 판이 시작됐다면 이전 결과로 화면을 덮지 않는다.
    if (finishedRun !== runId) return;
    if (!result) {
      $("save-status").textContent = "기록을 저장하지 못했어요. 접속과 인터넷 연결을 확인해 주세요.";
      return;
    }
    const ranking = result.rank == null ? "" : ` · ${result.rank}위`;
    $("save-status").textContent = result.improved ? `${result.previous == null ? "첫 기록 저장 완료!" : "최고 기록을 새로 세웠어요!"}${ranking}` : `기록 저장 완료 · 내 최고 ${Number(result.best).toLocaleString("ko-KR")}점${ranking}`;
    if (Number.isFinite(result.best)) $("best").textContent = `${result.best.toLocaleString("ko-KR")}점`;
  }

  $("start").addEventListener("click", startRound);
  $("retry").addEventListener("click", startRound);
  $("pause").addEventListener("click", pauseRound);
  $("resume").addEventListener("click", resumeRound);
  $("finish").addEventListener("click", () => { if (round?.phase === "paused") round.end(); });
  for (const id of ["home", "result-home"]) $(id).addEventListener("click", () => {
    if (window.MiniHub) MiniHub.exit(); else location.href = "../../index.html";
  });
  document.addEventListener("keydown", event => {
    if (event.code !== "Escape" || event.repeat) return;
    if (round?.phase === "playing") pauseRound();
    else if (round?.phase === "paused") resumeRound();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (round?.phase === "playing") pauseRound();
      if (round?.phase === "idle") { countdownPaused = true; clearTimeout(countdownTimer); }
    } else if (round?.phase === "idle" && countdownPaused) {
      countdownPaused = false;
      advanceCountdown();
    }
  });

  if (!window.MiniHub) {
    $("greeting").textContent = "랭킹 연결을 확인해 주세요. 게임은 즐길 수 있어요.";
  } else {
    MiniHub.init(GAME_ID).catch(() => {
      $("greeting").textContent = "랭킹에 연결하지 못했어요. 잠시 후 새로고침해 주세요.";
    });
    MiniHub.onReady(async player => {
      if (!player?.id || player.id === "offline") return;
      $("greeting").textContent = `${player.name}님, 오늘도 신나게 팡팡!`;
      try {
        const best = await MiniHub.getMyBest();
        if (Number.isFinite(best)) $("best").textContent = `${best.toLocaleString("ko-KR")}점`;
      } catch { /* 최고 기록을 못 읽어도 새 판은 시작할 수 있다. */ }
    });
  }
})();
