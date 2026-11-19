(function () {
  "use strict";

  const SALES_DURATION = 90;
  const SEAT_COUNT = 4;
  const RECIPES = [
    { id: "butterCookie", name: "버터쿠키", price: 3 },
    { id: "chocolateCookie", name: "초코칩 쿠키", price: 4 },
    { id: "madeleine", name: "마들렌", price: 4 },
    { id: "strawberryCake", name: "딸기 케이크", price: 8 },
    { id: "sourdough", name: "사워도우", price: 5 }
  ];
  const CAT_COLORS = [
    { fur: "#e5aa6b", shade: "#c78050", inner: "#f7d8b8", shirt: "#e8896f" },
    { fur: "#91a5a1", shade: "#667f7d", inner: "#d7e3da", shirt: "#7f9ec6" },
    { fur: "#d995a8", shade: "#aa657a", inner: "#f3d9d9", shirt: "#a685bd" }
  ];

  function readStock(stock, id) {
    const item = stock[id];
    if (typeof item === "number") return { perfect: 0, normal: item };
    return { perfect: item && item.perfect || 0, normal: item && item.normal || 0 };
  }

  function stockTotal(stock, id) {
    const item = readStock(stock, id);
    return item.perfect + item.normal;
  }

  function createSaleRecord() {
    return {
      secondsLeft: SALES_DURATION,
      seats: Array(SEAT_COUNT).fill(null),
      respawnTimers: Array(SEAT_COUNT).fill(null),
      selectedCustomerId: null,
      nextCustomerId: 1,
      sales: Object.fromEntries(RECIPES.map(recipe => [recipe.id, { perfect: 0, normal: 0, revenue: 0 }])),
      missed: 0,
      satisfied: 0,
      revenue: 0,
      feedback: "",
      started: true,
      finished: false,
      scoreSubmitted: false,
      scoreStatus: "",
      uiAccumulator: 0
    };
  }

  function createStage() {
    let root = null;
    let bakedGoods = {};
    let callbacks = null;
    let sale = null;
    let running = false;
    let animationId = 0;
    let lastTimestamp = 0;

    function recipeFor(id) {
      return RECIPES.find(recipe => recipe.id === id);
    }

    function orderDescription(customer) {
      return customer.order
        .filter(item => item.remaining > 0)
        .map(item => `${recipeFor(item.id).name} ${item.remaining}개`)
        .join(", ");
    }

    function createCustomer(seat) {
      const shuffled = RECIPES.map(recipe => recipe.id).sort(() => Math.random() - .5);
      const orderCount = Math.random() < .5 ? 1 : 2;
      return {
        id: sale.nextCustomerId++,
        seat,
        color: Math.floor(Math.random() * CAT_COLORS.length),
        patienceMax: 38 + Math.floor(Math.random() * 17),
        patience: 0,
        order: shuffled.slice(0, orderCount).map(id => {
          const quantity = 1 + Math.floor(Math.random() * 3);
          return { id, quantity, remaining: quantity };
        })
      };
    }

    function fillSeat(seat) {
      sale.seats[seat] = createCustomer(seat);
      sale.seats[seat].patience = sale.seats[seat].patienceMax;
      sale.respawnTimers[seat] = null;
    }

    function leaveSeat(customer, reason) {
      if (sale.seats[customer.seat] !== customer) return;
      sale.seats[customer.seat] = null;
      sale.respawnTimers[customer.seat] = 5 + Math.random() * 5;
      if (sale.selectedCustomerId === customer.id) sale.selectedCustomerId = null;
      if (reason === "missed") {
        sale.missed += 1;
        sale.feedback = `${customer.seat + 1}번 손님이 화나서 떠났어요.`;
      } else {
        sale.satisfied += 1;
        sale.feedback = `${customer.seat + 1}번 손님이 만족하고 떠났어요.`;
      }
    }

    function drawCat(context, colorIndex) {
      const colors = CAT_COLORS[colorIndex] || CAT_COLORS[0];
      const block = (x, y, width, height, color) => {
        context.fillStyle = color;
        context.fillRect(x, y, width, height);
      };

      context.clearRect(0, 0, context.canvas.width, context.canvas.height);
      context.imageSmoothingEnabled = false;
      block(25, 59, 50, 29, colors.shirt);
      block(19, 17, 26, 29, "#63483c");
      block(55, 17, 26, 29, "#63483c");
      block(24, 21, 17, 19, colors.fur);
      block(59, 21, 17, 19, colors.fur);
      block(28, 25, 9, 11, colors.inner);
      block(63, 25, 9, 11, colors.inner);
      block(17, 31, 66, 48, "#63483c");
      block(21, 35, 58, 40, colors.fur);
      block(28, 47, 5, 7, "#49352f");
      block(65, 47, 5, 7, "#49352f");
      block(45, 57, 8, 5, "#c56c70");
      block(40, 63, 18, 3, colors.shade);
      block(7, 55, 14, 2, "#63483c");
      block(79, 55, 14, 2, "#63483c");
      block(37, 70, 28, 5, colors.shade);
    }

    function drawBread(context, id, x, y, scale) {
      const draw = window.MeowStages && window.MeowStages.drawBread;
      if (draw) {
        draw(context, id, x, y, scale);
      } else {
        context.fillStyle = "#d99b58";
        context.fillRect(x, y, 34 * scale, 24 * scale);
      }
    }

    function hasAnyStock() {
      return RECIPES.some(recipe => stockTotal(bakedGoods, recipe.id) > 0);
    }

    function customerNeeds(customer, id) {
      return customer.order.some(item => item.id === id && item.remaining > 0);
    }

    function eligibleCustomers(id) {
      if (!sale) return [];
      if (sale.selectedCustomerId !== null) {
        const selected = sale.seats.find(customer => customer && customer.id === sale.selectedCustomerId);
        return selected && customerNeeds(selected, id) ? [selected] : [];
      }
      return sale.seats
        .filter(customer => customer && customerNeeds(customer, id))
        .sort((left, right) => left.patience - right.patience);
    }

    function renderEmptyStockNotice() {
      return `
        <div class="store-empty-stock">
          <p>빵이 없어요. 재료를 받아 굽고 오세요</p>
          <div>
            <button type="button" class="store-stage-link" data-go-stage="stage1">재료 받기</button>
            <button type="button" class="store-stage-link" data-go-stage="stage2">굽기</button>
          </div>
        </div>`;
    }

    function renderStockButtons(isActive) {
      const stock = RECIPES.map(recipe => {
        const amount = readStock(bakedGoods, recipe.id);
        const total = amount.perfect + amount.normal;
        const canServe = isActive && total > 0 && eligibleCustomers(recipe.id).length > 0;
        return `
          <button type="button" class="store-bread-button ${canServe ? "" : "is-disabled"}"
            data-bread="${recipe.id}" aria-label="${recipe.name} 건네기, 재고 ${total}"
            ${canServe ? "" : "disabled"}>
            <canvas class="store-bread-art" width="44" height="36" data-bread="${recipe.id}" aria-hidden="true"></canvas>
            <span class="store-bread-name">${recipe.name}</span>
            <strong>${total}</strong>
            <small>완벽 ${amount.perfect} · 보통 ${amount.normal}</small>
          </button>`;
      }).join("");
      return `
        <section class="store-stock">
          <div class="store-stock-heading"><h3>구운 빵 재고</h3><span>빵을 눌러 1개씩 전달</span></div>
          ${hasAnyStock() ? `<div class="store-bread-grid">${stock}</div>` : renderEmptyStockNotice()}
          ${isActive ? `<p class="store-stock-hint">손님 선택 시 해당 손님에게, 미선택 시 가장 급한 손님에게 전달해요.${sale.selectedCustomerId !== null ? " 선택한 손님을 다시 누르면 해제돼요." : ""}</p>` : ""}
        </section>`;
    }

    function renderSeat(customer, seat, isActive) {
      if (!customer) {
        const wait = sale && sale.respawnTimers[seat] !== null
          ? `${Math.ceil(sale.respawnTimers[seat])}초 후 새 손님`
          : isActive ? "손님을 기다리는 중" : "영업 전";
        return `<div class="store-empty-seat" aria-label="${seat + 1}번 손님 자리, ${wait}">${wait}</div>`;
      }
      const selected = sale.selectedCustomerId === customer.id;
      const urgent = customer.patience / customer.patienceMax <= .3;
      const description = orderDescription(customer);
      return `
        <button type="button" class="store-customer-seat ${selected ? "is-selected" : ""} ${urgent ? "is-urgent" : ""}"
          data-customer-id="${customer.id}"
          aria-label="${seat + 1}번 손님 선택. 주문: ${description}. 인내심 ${Math.ceil(customer.patience)}초">
          <span class="store-seat-number">${seat + 1}번 손님</span>
          <span class="store-seat-bubble">
            <span class="store-bubble-items">
              ${customer.order.filter(item => item.remaining > 0).map(item => `
                <span class="store-order-item">
                  <canvas class="store-order-art" width="80" height="64" data-bread="${item.id}" aria-hidden="true"></canvas>
                  <b>×${item.remaining}</b>
                </span>`).join("")}
            </span>
            <span class="store-seat-gauge"><i style="width:${customer.patience / customer.patienceMax * 100}%"></i></span>
            <span class="store-seat-time">${Math.ceil(customer.patience)}초</span>
          </span>
          <canvas class="store-cat-art" width="100" height="90" data-cat="${customer.color}" aria-hidden="true"></canvas>
        </button>`;
    }

    function renderStoreScene(isActive) {
      return `
        <section class="store-scene" aria-label="가게 카운터와 손님">
          <div class="store-window" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          <div class="store-seat-grid">
            ${Array.from({ length: SEAT_COUNT }, (_, seat) => renderSeat(sale ? sale.seats[seat] : null, seat, isActive)).join("")}
          </div>
          <div class="store-counter-front" aria-hidden="true"><i></i><i></i><i></i></div>
          ${isActive ? "" : '<p class="store-scene-note">영업을 시작하면 손님이 찾아와요</p>'}
        </section>`;
    }

    function renderOrderRow(customer) {
      const urgency = customer.patience / customer.patienceMax <= .3;
      const selected = sale.selectedCustomerId === customer.id;
      return `
        <button type="button" class="order-slip-row ${urgency ? "is-urgent" : ""} ${selected ? "is-selected" : ""}"
          data-customer-id="${customer.id}">
          <canvas class="order-slip-cat" width="100" height="90" data-cat="${customer.color}" aria-hidden="true"></canvas>
          <span class="order-slip-content">
            <span class="order-slip-seat">${customer.seat + 1}번 손님</span>
            <span class="order-slip-items">
              ${customer.order.filter(item => item.remaining > 0).map(item => `
                <span class="order-slip-item">
                  <canvas class="order-slip-bread" width="80" height="64" data-bread="${item.id}" aria-hidden="true"></canvas>
                  <span>${recipeFor(item.id).name} ×${item.remaining}</span>
                </span>`).join("")}
            </span>
            <span class="order-slip-gauge"><i style="width:${customer.patience / customer.patienceMax * 100}%"></i></span>
            <span class="order-slip-time">${Math.ceil(customer.patience)}초 남음</span>
          </span>
        </button>`;
    }

    function renderOrderSlip(isActive) {
      const customers = sale
        ? sale.seats.filter(Boolean).sort((left, right) => left.patience - right.patience)
        : [];
      const rows = customers.map(renderOrderRow).join("");
      return `
        <aside class="store-order-slip" aria-labelledby="order-slip-title">
          <div class="store-order-slip-heading">
            <div><p class="eyebrow">오늘의 주문</p><h3 id="order-slip-title">주문서</h3></div>
            ${isActive ? `<strong>${customers.length}명</strong>` : ""}
          </div>
          <div class="order-slip-list">
            ${rows || `<p class="order-slip-empty">${isActive ? "잠시 후 손님이 도착해요." : "영업 시작 후 주문이 여기에 표시돼요."}</p>`}
          </div>
        </aside>`;
    }

    function renderIntro() {
      root.innerHTML = `
        <div class="store-heading">
          <div><p class="eyebrow">MEOW BAKERY</p><h2>매장</h2></div>
          <p>손님을 맞이하고 주문에 맞는 빵을 건네주세요.</p>
          <button type="button" class="button button-primary store-start-button" id="sales-start">영업 시작</button>
        </div>
        <div class="store-layout">
          <div class="store-main">
            ${renderStoreScene(false)}
            ${renderStockButtons(false)}
          </div>
          ${renderOrderSlip(false)}
        </div>`;
      drawArtwork();
      root.querySelector("#sales-start").addEventListener("click", startSale);
      bindNavigationButtons();
    }

    function renderActive() {
      const totalSold = Object.values(sale.sales).reduce((sum, item) => sum + item.perfect + item.normal, 0);
      root.innerHTML = `
        <div class="store-heading is-active">
          <div><p class="eyebrow">MEOW BAKERY</p><h2>매장</h2></div>
          <div class="sales-clock"><span>영업 종료까지</span><strong id="sales-timer">${Math.ceil(sale.secondsLeft)}</strong><span>초</span></div>
          <button type="button" class="sales-restart" id="sales-restart">다시 시작</button>
        </div>
        <div class="sales-status-strip">
          <span>매출 <strong id="sales-revenue">${sale.revenue}</strong></span>
          <span>놓친 손님 <strong id="sales-missed">${sale.missed}</strong></span>
          <span>판매 성공 <strong id="sales-count">${totalSold}</strong></span>
        </div>
        <div class="store-layout">
          <div class="store-main">
            ${renderStoreScene(true)}
            ${renderStockButtons(true)}
            <p class="store-feedback" aria-live="polite">${sale.feedback}</p>
          </div>
          ${renderOrderSlip(true)}
        </div>`;
      drawArtwork();
      root.querySelector("#sales-restart").addEventListener("click", startSale);
      bindCustomerButtons();
      bindBreadButtons();
      bindNavigationButtons();
    }

    function renderResult() {
      const sold = RECIPES.map(recipe => {
        const item = sale.sales[recipe.id];
        if (!item || item.perfect + item.normal === 0) return "";
        return `<li><span>${recipe.name}<small>완벽 ${item.perfect} · 보통 ${item.normal}</small></span><strong>${item.perfect + item.normal}개 · ${item.revenue}</strong></li>`;
      }).join("");
      root.innerHTML = `
        <div class="sales-result">
          <p class="eyebrow">영업 종료</p>
          <h2>오늘의 매출</h2>
          <p class="sales-result-revenue"><strong>${sale.revenue}</strong><span>원</span></p>
          <div class="sales-result-stats">
            <span>놓친 손님 <strong>${sale.missed}명</strong></span>
            <span>총 판매 수 <strong>${Object.values(sale.sales).reduce((sum, item) => sum + item.perfect + item.normal, 0)}개</strong></span>
          </div>
          <section class="sales-result-list">
            <h3>판매한 빵</h3>
            <ul>${sold || "<li class=\"sales-empty\">판매한 빵이 없어요.</li>"}</ul>
          </section>
          <p class="sales-score-status" id="sales-score-status" aria-live="polite">${sale.scoreStatus || "기록을 저장하고 있어요."}</p>
          <button type="button" class="button button-primary" id="sales-again">다시 영업하기</button>
        </div>`;
      root.querySelector("#sales-again").addEventListener("click", startSale);
    }

    function drawArtwork() {
      root.querySelectorAll(".store-cat-art, .order-slip-cat").forEach(canvas => {
        drawCat(canvas.getContext("2d"), Number(canvas.dataset.cat));
      });
      root.querySelectorAll(".store-order-art, .order-slip-bread, .store-bread-art").forEach(canvas => {
        const context = canvas.getContext("2d");
        context.imageSmoothingEnabled = false;
        const enlarged = canvas.classList.contains("store-order-art") || canvas.classList.contains("order-slip-bread");
        drawBread(context, canvas.dataset.bread, enlarged ? 0 : 4, enlarged ? 0 : 2, enlarged ? 2 : 1);
      });
    }

    function bindCustomerButtons() {
      root.querySelectorAll("[data-customer-id]").forEach(button => {
        button.addEventListener("click", () => {
          const id = Number(button.dataset.customerId);
          sale.selectedCustomerId = sale.selectedCustomerId === id ? null : id;
          renderActive();
        });
      });
    }

    function bindBreadButtons() {
      root.querySelectorAll(".store-bread-button:not(:disabled)").forEach(button => {
        button.addEventListener("click", () => deliverBread(button.dataset.bread));
      });
    }

    function bindNavigationButtons() {
      root.querySelectorAll("[data-go-stage]").forEach(button => {
        button.addEventListener("click", () => callbacks.navigate(button.dataset.goStage));
      });
    }

    function updateLiveStatus() {
      if (!root || !sale) return;
      const timer = root.querySelector("#sales-timer");
      if (timer) timer.textContent = String(Math.ceil(sale.secondsLeft));
    }

    function startSale() {
      running = false;
      cancelAnimationFrame(animationId);
      sale = createSaleRecord();
      const seats = Array.from({ length: SEAT_COUNT }, (_, index) => index)
        .sort(() => Math.random() - .5);
      const initialCount = 3 + Math.floor(Math.random() * 2);
      seats.slice(initialCount).forEach(seat => {
        sale.respawnTimers[seat] = 3 + Math.random() * 4;
      });
      seats.slice(0, initialCount).forEach(fillSeat);
      running = true;
      lastTimestamp = 0;
      renderActive();
      animationId = requestAnimationFrame(loop);
    }

    function consumeBread(id) {
      const stock = readStock(bakedGoods, id);
      const quality = stock.perfect > 0 ? "perfect" : "normal";
      if (stock[quality] <= 0) return null;
      const next = { ...bakedGoods, [id]: { ...stock, [quality]: stock[quality] - 1 } };
      bakedGoods = next;
      callbacks.onBakedGoodsChange({ ...next });
      return quality;
    }

    function deliverBread(id) {
      if (!running || !sale || sale.finished || stockTotal(bakedGoods, id) <= 0) return;
      const customer = eligibleCustomers(id)[0];
      if (!customer) return;
      const quality = consumeBread(id);
      if (!quality) return;

      const orderItem = customer.order.find(item => item.id === id && item.remaining > 0);
      if (!orderItem) return;
      const recipe = recipeFor(id);
      const price = quality === "perfect" ? Math.ceil(recipe.price * 1.5) : recipe.price;
      const soldItem = sale.sales[id];
      soldItem[quality] += 1;
      soldItem.revenue += price;
      sale.revenue += price;
      orderItem.remaining -= 1;
      sale.feedback = `${customer.seat + 1}번 손님에게 ${recipe.name} 1개를 건넸어요.`;

      if (customer.order.every(item => item.remaining === 0)) {
        leaveSeat(customer, "satisfied");
      }
      renderActive();
    }

    function update(delta) {
      if (!running || !sale || sale.finished) return;
      sale.secondsLeft = Math.max(0, sale.secondsLeft - delta);
      let shouldRender = false;

      sale.seats.forEach((customer, seat) => {
        if (customer) {
          customer.patience = Math.max(0, customer.patience - delta);
          if (customer.patience <= 0) {
            leaveSeat(customer, "missed");
            shouldRender = true;
          }
        } else if (sale.respawnTimers[seat] !== null) {
          sale.respawnTimers[seat] = Math.max(0, sale.respawnTimers[seat] - delta);
          if (sale.respawnTimers[seat] <= 0) {
            fillSeat(seat);
            shouldRender = true;
          }
        }
      });

      sale.uiAccumulator += delta;
      if (sale.uiAccumulator >= .25) {
        sale.uiAccumulator = 0;
        shouldRender = true;
      }
      if (shouldRender) renderActive();
      updateLiveStatus();
      if (sale.secondsLeft <= 0) finishSale();
    }

    function loop(timestamp) {
      if (!running || document.hidden) return;
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = Math.min((timestamp - lastTimestamp) / 1000, .1);
      lastTimestamp = timestamp;
      update(delta);
      if (running && sale && !sale.finished) animationId = requestAnimationFrame(loop);
    }

    function finishSale() {
      if (!sale || sale.finished) return;
      sale.finished = true;
      sale.secondsLeft = 0;
      running = false;
      cancelAnimationFrame(animationId);
      renderResult();
      if (!sale.scoreSubmitted) {
        sale.scoreSubmitted = true;
        const completedSale = sale;
        Promise.resolve()
          .then(() => callbacks.submitScore(completedSale.revenue))
          .then(result => {
            completedSale.scoreStatus = result ? "매출 기록을 저장했어요." : "매출 기록을 저장하지 못했어요.";
            const status = sale === completedSale && root && root.querySelector("#sales-score-status");
            if (status) status.textContent = completedSale.scoreStatus;
          })
          .catch(error => {
            console.error("Meow Bakery 판매 점수를 저장하지 못했습니다.", error);
            completedSale.scoreStatus = "매출 기록을 저장하지 못했어요.";
            const status = sale === completedSale && root && root.querySelector("#sales-score-status");
            if (status) status.textContent = completedSale.scoreStatus;
          });
      }
    }

    function onVisibilityChange() {
      if (!sale || !sale.started || sale.finished) return;
      lastTimestamp = 0;
      if (document.hidden) {
        cancelAnimationFrame(animationId);
      } else if (running) {
        animationId = requestAnimationFrame(loop);
      }
    }

    function start(options) {
      root = options.root;
      bakedGoods = Object.fromEntries(RECIPES.map(recipe => [
        recipe.id,
        readStock(options.bakedGoods, recipe.id)
      ]));
      callbacks = options;
      running = Boolean(sale && sale.started && !sale.finished);
      lastTimestamp = 0;
      document.addEventListener("visibilitychange", onVisibilityChange);
      if (!sale || sale.finished) {
        render();
      } else {
        renderActive();
      }
      if (running && !document.hidden) animationId = requestAnimationFrame(loop);

      return {
        stop() {
          running = false;
          cancelAnimationFrame(animationId);
          document.removeEventListener("visibilitychange", onVisibilityChange);
          root = null;
        }
      };
    }

    function render() {
      if (!root) return;
      if (!sale) {
        renderIntro();
      } else if (sale.finished) {
        renderResult();
      } else {
        renderActive();
      }
    }

    return { start };
  }

  window.MeowStages = window.MeowStages || {};
  window.MeowStages.stage3 = createStage();
})();
