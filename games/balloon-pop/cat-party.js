"use strict";

const CAT_DANCES = Object.freeze([
  { id: "disco", name: "버터 디스코", color: "#e27b55", pitch: 1 },
  { id: "spin", name: "빙글빙글 스핀", color: "#9b76c6", pitch: 1.12 },
  { id: "hop", name: "폴짝폴짝 댄스", color: "#6aa580", pitch: 1.25 },
  { id: "moonwalk", name: "사뿐사뿐 문워크", color: "#5c9bb8", pitch: 0.94 },
  { id: "breakdance", name: "고양이 브레이크댄스", color: "#df849e", pitch: 1.06 },
  { id: "wiggle", name: "흔들흔들 꼬리춤", color: "#d59b3c", pitch: 1.18 },
]);

class CatDanceDeck {
  constructor(random = Math.random) { this.random = random; this.bag = []; this.previous = null; }
  next() {
    if (!this.bag.length) {
      this.bag = [...CAT_DANCES];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
      const last = this.bag.length - 1;
      if (this.bag[last].id === this.previous) [this.bag[0], this.bag[last]] = [this.bag[last], this.bag[0]];
    }
    const dance = this.bag.pop(); this.previous = dance.id; return dance;
  }
}

function catDanceMarkup(dance) {
  return `<div class="cat-dance-stage dance-${dance.id}">
    <div class="dance-floor"></div>
    <span class="dance-note note-a">♪</span><span class="dance-note note-b">♫</span><span class="dance-note note-c">✦</span>
    <svg class="dancing-cat" viewBox="0 0 200 240" aria-hidden="true">
      <g class="cat-rig" stroke="#6c4932" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
        <path class="cat-tail" d="M125 170c52 15 57-30 37-38-14-6-20 7-13 13" fill="none" stroke="#e4b665" stroke-width="15"/>
        <g class="cat-leg-left"><path d="M85 183v27c-4 5-20 7-25 1-3-6 6-12 13-12v-19" fill="#f6d792"/></g>
        <g class="cat-leg-right"><path d="M113 183v27c4 5 20 7 25 1 3-6-6-12-13-12v-19" fill="#f6d792"/></g>
        <g class="cat-arm-left"><path d="M76 132c-13-3-21-17-30-26-9-10-20-5-17 5 5 17 24 39 42 41" fill="#ffe4a0"/><path d="m35 106 3 5m2-10 3 5" fill="none"/></g>
        <g class="cat-arm-right"><path d="M124 132c13-3 21-17 30-26 9-10 20-5 17 5-5 17-24 39-42 41" fill="#ffe4a0"/><path d="m165 106-3 5m-2-10-3 5" fill="none"/></g>
        <ellipse cx="100" cy="157" rx="34" ry="41" fill="#ffe4a0"/>
        <path d="M69 144q31 17 62 0v23q-31 17-62 0Z" fill="${dance.color}" stroke="none"/>
        <path d="m100 145 4 8 9 1-6 6 1 9-8-4-8 4 1-9-6-6 9-1Z" fill="#fff4c9" stroke="none"/>
        <g class="cat-head">
          <path d="m53 64 3-38 33 22m58 16-3-38-33 22" fill="#ffe4a0"/>
          <path d="m61 48 1-11 14 13m63-2-1-11-14 13" fill="#e7a19b" stroke="none"/>
          <ellipse cx="100" cy="80" rx="49" ry="39" fill="#ffe4a0"/>
          <path d="m84 44 3 11m13-14v13m16-10-3 11" stroke="#d9a24f"/>
          <ellipse cx="70" cy="88" rx="9" ry="6" fill="#eaa797" stroke="none"/><ellipse cx="130" cy="88" rx="9" ry="6" fill="#eaa797" stroke="none"/>
          <path d="m72 77 9-5 8 5m22 0 8-5 9 5" fill="none"/>
          <path d="m95 86 5 4 5-4Z" fill="#a96a65" stroke="none"/>
          <path d="M90 94q5 8 10 0 5 8 10 0" fill="none" stroke-width="3"/>
          <path d="m60 85-16-3m16 11-15 3m95-11 16-3m-16 11 15 3" fill="none" stroke-width="2"/>
        </g>
      </g>
    </svg>
    <span class="cat-dance-name">${dance.name}</span>
  </div>`;
}
