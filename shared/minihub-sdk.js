// minihub-sdk.js v1 — 게임 ↔ 허브 연결 SDK
// ⚠ 수정 금지. 변경이 필요하면 허브 담당자가 버전을 올려서 공지한다.
// 사용법은 docs/SPEC.md 5장 참고.
(function () {
  if (window.MiniHub) return;

  var inHub = window.parent !== window;
  var gameId = null;
  var player = { id: "guest", name: "Guest" };
  var readyCbs = [];
  var ready = false;

  function fireReady() {
    if (ready) return;
    ready = true;
    var cbs = readyCbs;
    readyCbs = [];
    cbs.forEach(function (cb) {
      try { cb(player); } catch (e) { console.error(e); }
    });
  }

  function send(msg) {
    if (inHub) window.parent.postMessage(msg, "*");
  }

  window.addEventListener("message", function (e) {
    if (e.source !== window.parent) return;
    var d = e.data;
    if (!d || d.type !== "MINIHUB_INIT") return;
    if (d.player && d.player.id) {
      player = { id: String(d.player.id), name: String(d.player.name || "Guest") };
    }
    fireReady();
  });

  window.MiniHub = {
    version: 1,
    inHub: inHub,

    init: function (id) {
      gameId = String(id);
      if (inHub) {
        send({ type: "MINIHUB_READY", gameId: gameId, version: 1 });
        setTimeout(fireReady, 3000); // 허브 응답이 늦으면 Guest로 진행
      } else {
        setTimeout(fireReady, 0);
      }
    },

    onReady: function (cb) {
      if (ready) cb(player);
      else readyCbs.push(cb);
    },

    getPlayer: function () {
      return player;
    },

    submitScore: function (score) {
      if (!gameId) return console.warn("[MiniHub] init(gameId)을 먼저 호출하세요");
      var s = Math.floor(Number(score));
      if (!isFinite(s) || s < 0) return console.warn("[MiniHub] 잘못된 점수:", score);
      if (inHub) send({ type: "MINIHUB_SCORE", gameId: gameId, score: s });
      else console.log("[MiniHub] (단독 실행) " + gameId + " score = " + s);
    },

    exit: function () {
      if (inHub) send({ type: "MINIHUB_EXIT", gameId: gameId });
      else console.log("[MiniHub] (단독 실행) exit");
    },
  };
})();
