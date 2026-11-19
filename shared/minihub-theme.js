/* MiniHub 화면 모드(밝게/어둡게) — 메인페이지와 모든 게임이 같은 선택을 공유한다.
 *
 * 사용법: 각 페이지의 <head> 맨 위에 넣는다 (화면이 깜빡이지 않게 CSS보다 먼저).
 *   <script src="../../shared/minihub-theme.js"></script>
 *
 * 하는 일
 *  - <html data-theme="light|dark"> 를 항상 붙여 준다. 게임 CSS는 이것만 보면 된다.
 *      :root[data-theme="dark"] { ... }
 *  - 저장된 선택이 있으면 그것, 없으면 기기(OS) 설정을 따른다.
 *  - 선택은 localStorage "minihub_theme" 에 저장 → 같은 사이트의 모든 페이지가 공유한다.
 *  - 다른 탭에서 바꿔도, 기기 설정이 바뀌어도 바로 따라간다.
 *
 * 게임에서 쓸 수 있는 것
 *   MiniHubTheme.get()            → "light" | "dark" (지금 적용 중인 모드)
 *   MiniHubTheme.set("dark")      → 모드 저장·적용 ("light" / "dark")
 *   MiniHubTheme.toggle()         → 반대로 바꾸고 새 모드를 돌려줌
 *   MiniHubTheme.onChange(fn)     → 모드가 바뀔 때 fn("light"|"dark") 호출 (캔버스를 다시 그릴 때 등)
 */
(function () {
  if (window.MiniHubTheme) return;
  var KEY = "minihub_theme";
  var root = document.documentElement;
  var mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  var listeners = [];

  function saved() {
    try {
      var v = localStorage.getItem(KEY);
      return v === "light" || v === "dark" ? v : null;
    } catch (e) { return null; }
  }
  function resolve() { return saved() || (mq && mq.matches ? "dark" : "light"); }

  var current = null;
  function apply() {
    var t = resolve();
    root.dataset.theme = t;
    root.style.colorScheme = t;
    if (t === current) return;
    current = t;
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](t); } catch (e) {}
    }
    try { window.dispatchEvent(new CustomEvent("minihub-theme", { detail: t })); } catch (e) {}
  }

  window.MiniHubTheme = {
    get: function () { return current || resolve(); },
    set: function (t) {
      if (t !== "light" && t !== "dark") return;
      try { localStorage.setItem(KEY, t); } catch (e) {}
      apply();
    },
    toggle: function () {
      var next = this.get() === "dark" ? "light" : "dark";
      this.set(next);
      return next;
    },
    onChange: function (fn) { if (typeof fn === "function") listeners.push(fn); }
  };

  window.addEventListener("storage", function (e) { if (e.key === KEY || e.key === null) apply(); });
  if (mq) {
    if (mq.addEventListener) mq.addEventListener("change", apply);
    else if (mq.addListener) mq.addListener(apply);
  }
  apply();
})();
