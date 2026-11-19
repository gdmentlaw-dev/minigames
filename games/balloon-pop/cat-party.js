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

function tuxedoCatArtwork(accent = "#e5b857", iconPose = false) {
  return `<g class="cat-rig tuxedo-cat" stroke="#282830" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
    <g class="cat-tail"><path d="M125 170c52 15 57-30 37-38-14-6-20 7-13 13" fill="none" stroke="#282830" stroke-width="15"/><path d="M158 132c-12-3-16 7-10 13" fill="none" stroke="#fffdf8" stroke-width="11"/></g>
    <g class="cat-leg-left"${iconPose ? ' transform="rotate(25 85 183)"' : ""}><path d="M85 181v27c-4 6-20 9-25 3-3-6 6-12 13-12v-20" fill="#282830"/><path d="M74 198c-7 0-17 8-14 13 5 6 19 3 25-2v-11Z" fill="#fffdf8"/></g>
    <g class="cat-leg-right"><path d="M113 181v27c4 6 20 9 25 3 3-6-6-12-13-12v-20" fill="#282830"/><path d="M124 198c7 0 17 8 14 13-5 6-19 3-25-2v-11Z" fill="#fffdf8"/></g>
    <g class="cat-arm-left"><path d="M76 132c-13-3-21-17-30-26-9-10-20-5-17 5 5 17 24 39 42 41" fill="#282830"/><ellipse cx="36" cy="109" rx="10" ry="12" fill="#fffdf8" transform="rotate(-25 36 109)"/><path d="m32 105 3 5m3-10 3 5" stroke="#9d9290" stroke-width="2" fill="none"/></g>
    <g class="cat-arm-right"><path d="M124 132c13-3 21-17 30-26 9-10 20-5 17 5-5 17-24 39-42 41" fill="#282830"/><ellipse cx="164" cy="109" rx="10" ry="12" fill="#fffdf8" transform="rotate(25 164 109)"/><path d="m168 105-3 5m-3-10-3 5" stroke="#9d9290" stroke-width="2" fill="none"/></g>
    <ellipse cx="100" cy="157" rx="34" ry="41" fill="#282830"/>
    <path d="m89 121 11 9 11-9 5 30q5 29-16 41-21-12-16-41Z" fill="#fffdf8" stroke="none"/>
    <path d="m100 130-15-7v15l15-5 15 5v-15Z" fill="${accent}" stroke-width="2"/><circle cx="100" cy="131" r="4" fill="${accent}" stroke-width="2"/>
    <g class="cat-head">
      <path d="m53 64 3-38 33 22m58 16-3-38-33 22" fill="#282830"/>
      <path d="m61 48 1-11 14 13m63-2-1-11-14 13" fill="#d5a1a6" stroke="none"/>
      <ellipse cx="100" cy="80" rx="49" ry="39" fill="#282830"/>
      <path d="M100 45C94 61 92 76 83 86Q76 103 100 111q24-8 17-25c-9-10-11-25-17-41Z" fill="#fffdf8" stroke="none"/>
      <path d="m72 77 9-5 8 5m22 0 8-5 9 5" fill="none" stroke="#f9e9bc"/>
      <ellipse cx="71" cy="90" rx="7" ry="4" fill="#dba3ad" stroke="none"/><ellipse cx="129" cy="90" rx="7" ry="4" fill="#dba3ad" stroke="none"/>
      <path d="m95 86 5 4 5-4Z" fill="#c18291" stroke="none"/>
      <path d="M90 95q5 8 10 0 5 8 10 0" fill="none" stroke-width="3"/>
      <path d="m60 85-16-3m16 11-15 3m95-11 16-3m-16 11 15 3" fill="none" stroke="#8c8084" stroke-width="2"/>
    </g>
  </g>`;
}

function catDanceMarkup(dance) {
  return `<div class="cat-travel travel-${dance.id}"><div class="cat-dance-stage dance-${dance.id}">
    <div class="dance-floor"></div>
    <span class="dance-note note-a">♪</span><span class="dance-note note-b">♫</span><span class="dance-note note-c">✦</span>
    <svg class="dancing-cat" viewBox="0 0 200 240" aria-hidden="true">${tuxedoCatArtwork(dance.color)}</svg>
    <span class="cat-dance-name">${dance.name}</span>
  </div></div>`;
}
