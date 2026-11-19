(function () {
  "use strict";

  const SALES_DURATION = 90;
  const SEAT_COUNT = 4;
  const CURRENCY_NAME = window.MeowBakeryConfig.CURRENCY_NAME;
  const MENU_PRICES = Object.freeze({
    butterCookie: 3,
    chocolateCookie: 4,
    madeleine: 5,
    sourdough: 5,
    strawberryCake: 8
  });
  const RECIPES = [
    { id: "butterCookie", name: "진저브레드 쿠키", price: MENU_PRICES.butterCookie },
    { id: "chocolateCookie", name: "초코칩 쿠키", price: MENU_PRICES.chocolateCookie },
    { id: "madeleine", name: "에그타르트", price: MENU_PRICES.madeleine },
    { id: "strawberryCake", name: "딸기 케이크", price: MENU_PRICES.strawberryCake },
    { id: "sourdough", name: "식빵", price: MENU_PRICES.sourdough }
  ];
  const CAT_TYPES = ["cheese", "mackerel", "tuxedo", "white", "gray", "calico", "black", "siamese"];

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
      departures: Array(SEAT_COUNT).fill(null),
      nextCustomerId: 1,
      sales: Object.fromEntries(RECIPES.map(recipe => [recipe.id, { perfect: 0, normal: 0, revenue: 0 }])),
      missed: 0,
      satisfied: 0,
      revenue: 0,
      feedback: "",
      started: true,
      finished: false,
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

    function chooseCatType() {
      const occupied = new Set(sale.seats.filter(Boolean).map(customer => customer.type));
      sale.departures.filter(Boolean).forEach(departure => occupied.add(departure.type));
      const available = CAT_TYPES.filter(type => !occupied.has(type));
      return available[Math.floor(Math.random() * available.length)];
    }

    function createCustomer(seat) {
      const shuffled = RECIPES.map(recipe => recipe.id).sort(() => Math.random() - .5);
      const orderCount = Math.random() < .5 ? 1 : 2;
      return {
        id: sale.nextCustomerId++,
        seat,
        type: chooseCatType(),
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
      sale.departures[seat] = null;
    }

    function leaveSeat(customer, reason, revenue = 0) {
      if (sale.seats[customer.seat] !== customer) return;
      sale.seats[customer.seat] = null;
      sale.respawnTimers[customer.seat] = 5 + Math.random() * 5;
      sale.departures[customer.seat] = {
        type: customer.type,
        expression: reason === "missed" ? "angry" : "happy",
        revenue,
        remaining: .85
      };
      if (reason === "missed") {
        sale.missed += 1;
        sale.feedback = `${customer.seat + 1}번 손님이 화나서 떠났어요.`;
      } else {
        sale.satisfied += 1;
        sale.feedback = `${customer.seat + 1}번 손님이 만족하고 떠났어요.`;
      }
    }

    function customerExpression(customer) {
      return customer.patience / customer.patienceMax <= .3 ? "worried" : "normal";
    }

    function catImagePath(type, expression) {
      return `assets/cats/cat_${type}_${expression}.png`;
    }

    function foodImagePath(id) {
      return window.MeowStages.foodImagePath(id);
    }

    function hasAnyStock() {
      return RECIPES.some(recipe => stockTotal(bakedGoods, recipe.id) > 0);
    }

    function renderEmptyStockNotice() {
      return `
        <div class="store-empty-stock">
          <p>빵이 없어요. 재료를 받아 굽고 오세요</p>
          <div>
            <button type="button" class="store-stage-link" data-go-stage="stage1">재료 받기</button>
            <button type="button" class="store-stage-link" data-go-stage="stage3">굽기</button>
          </div>
        </div>`;
    }

    function renderStockButtons(isActive) {
      const stock = RECIPES.map(recipe => {
        const amount = readStock(bakedGoods, recipe.id);
        const total = amount.perfect + amount.normal;
        return `
          <div class="store-bread-stock-item ${total > 0 ? "" : "is-disabled"}"
            role="group" aria-label="${recipe.name}, 보유 ${total}개">
            <img class="store-bread-art" src="${foodImagePath(recipe.id)}" width="32" height="32" alt="" aria-hidden="true" decoding="async">
            <span class="store-bread-name">${recipe.name}</span>
            <strong>${total}</strong>
            <small>가격 ${recipe.price} ${CURRENCY_NAME} · 완벽 ${amount.perfect} · 보통 ${amount.normal}</small>
          </div>`;
      }).join("");
      return `
        <section class="store-stock">
          <div class="store-stock-heading"><h3>구운 빵 재고</h3><span>주문 전달용 재고</span></div>
          ${hasAnyStock() ? `<div class="store-bread-grid">${stock}</div>` : renderEmptyStockNotice()}
          ${isActive ? `<p class="store-stock-hint">손님 고양이나 주문서를 눌러 주문을 한꺼번에 전달해요.</p>` : ""}
        </section>`;
    }

    function renderSeat(customer, seat, isActive) {
      if (!customer) {
        const departure = sale && sale.departures[seat];
        if (departure) {
          const message = departure.expression === "angry" ? "화나서 떠났어요" : "기뻐하며 떠났어요";
          const moneyPop = departure.revenue > 0
            ? `<strong class="store-money-pop" aria-hidden="true" style="animation-delay:-${Math.max(0, .85 - departure.remaining).toFixed(2)}s">+${departure.revenue} ${CURRENCY_NAME}</strong>`
            : "";
          return `
            <div class="store-empty-seat has-departure" aria-label="${seat + 1}번 손님 ${message}">
              <img class="store-cat-art" src="${catImagePath(departure.type, departure.expression)}" alt="" aria-hidden="true">
              <span>${message}</span>
              ${moneyPop}
            </div>`;
        }
        const wait = sale && sale.respawnTimers[seat] !== null
          ? `${Math.ceil(sale.respawnTimers[seat])}초 후 새 손님`
          : isActive ? "손님을 기다리는 중" : "영업 전";
        return `<div class="store-empty-seat" aria-label="${seat + 1}번 손님 자리, ${wait}">${wait}</div>`;
      }
      const urgent = customer.patience / customer.patienceMax <= .3;
      const expression = customerExpression(customer);
      const description = orderDescription(customer);
      return `
        <button type="button" class="store-customer-seat ${urgent ? "is-urgent" : ""}"
          data-customer-id="${customer.id}"
          aria-label="${seat + 1}번 손님 주문 전달. 주문: ${description}. 인내심 ${Math.ceil(customer.patience)}초">
          <span class="store-seat-number">${seat + 1}번 손님</span>
          <span class="store-seat-bubble">
            <span class="store-bubble-items">
              ${customer.order.filter(item => item.remaining > 0).map(item => `
                <span class="store-order-item">
                  <img class="store-order-art" src="${foodImagePath(item.id)}" width="64" height="64" alt="" aria-hidden="true" decoding="async">
                  <b>×${item.remaining}</b>
                </span>`).join("")}
            </span>
            <span class="store-seat-gauge"><i style="width:${customer.patience / customer.patienceMax * 100}%"></i></span>
            <span class="store-seat-time">${Math.ceil(customer.patience)}초</span>
          </span>
          <img class="store-cat-art" src="${catImagePath(customer.type, expression)}" alt="" aria-hidden="true">
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
      const expression = customerExpression(customer);
      return `
        <button type="button" class="order-slip-row ${urgency ? "is-urgent" : ""}"
          data-customer-id="${customer.id}" aria-label="${customer.seat + 1}번 손님 주문 전달">
          <img class="order-slip-cat" src="${catImagePath(customer.type, expression)}" alt="" aria-hidden="true">
          <span class="order-slip-content">
            <span class="order-slip-seat">${customer.seat + 1}번 손님</span>
            <span class="order-slip-items">
              ${customer.order.filter(item => item.remaining > 0).map(item => `
                <span class="order-slip-item">
                  <img class="order-slip-bread" src="${foodImagePath(item.id)}" width="64" height="64" alt="" aria-hidden="true" decoding="async">
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
          <span>매출 <strong id="sales-revenue">${sale.revenue}</strong> ${CURRENCY_NAME}</span>
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
      root.querySelector("#sales-restart").addEventListener("click", startSale);
      bindCustomerButtons();
      bindNavigationButtons();
    }

    function renderResult() {
      const sold = RECIPES.map(recipe => {
        const item = sale.sales[recipe.id];
        if (!item || item.perfect + item.normal === 0) return "";
        return `<li><img class="sales-result-art" src="${foodImagePath(recipe.id)}" width="32" height="32" alt="" aria-hidden="true" decoding="async"><span>${recipe.name}<small>완벽 ${item.perfect} · 보통 ${item.normal}</small></span><strong>${item.perfect + item.normal}개 · ${item.revenue} ${CURRENCY_NAME}</strong></li>`;
      }).join("");
      root.innerHTML = `
        <div class="sales-result">
          <p class="eyebrow">영업 종료</p>
          <h2>오늘의 매출</h2>
          <p class="sales-result-revenue"><strong>${sale.revenue}</strong><span>${CURRENCY_NAME}</span></p>
          <div class="sales-result-stats">
            <span>놓친 손님 <strong>${sale.missed}명</strong></span>
            <span>판매한 빵 <strong>${Object.values(sale.sales).reduce((sum, item) => sum + item.perfect + item.normal, 0)}개</strong></span>
          </div>
          <section class="sales-result-list">
            <h3>판매한 빵</h3>
            <ul>${sold || "<li class=\"sales-empty\">판매한 빵이 없어요.</li>"}</ul>
          </section>
          <button type="button" class="button button-primary" id="sales-again">다시 영업하기</button>
        </div>`;
      root.querySelector("#sales-again").addEventListener("click", startSale);
    }

    function bindCustomerButtons() {
      root.querySelectorAll("[data-customer-id]").forEach(button => {
        button.addEventListener("click", () => {
          const id = Number(button.dataset.customerId);
          deliverOrder(id);
        });
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

    function deliverOrder(customerId) {
      if (!running || !sale || sale.finished) return;
      const customer = sale.seats.find(item => item && item.id === customerId);
      if (!customer) return;

      const shortages = customer.order
        .map(item => ({
          recipe: recipeFor(item.id),
          count: Math.max(0, item.remaining - stockTotal(bakedGoods, item.id))
        }))
        .filter(item => item.count > 0);
      if (shortages.length > 0) {
        sale.feedback = `재고 부족: ${shortages.map(item => `${item.recipe.name} ${item.count}개`).join(", ")} 부족`;
        renderActive();
        return;
      }

      const nextStock = { ...bakedGoods };
      let orderRevenue = 0;
      customer.order.forEach(item => {
        const recipe = recipeFor(item.id);
        const stock = readStock(nextStock, item.id);
        const perfectCount = Math.min(stock.perfect, item.remaining);
        const normalCount = item.remaining - perfectCount;
        const perfectRevenue = perfectCount * Math.ceil(recipe.price * 1.5);
        const normalRevenue = normalCount * recipe.price;
        nextStock[item.id] = {
          perfect: stock.perfect - perfectCount,
          normal: stock.normal - normalCount
        };
        const soldItem = sale.sales[item.id];
        soldItem.perfect += perfectCount;
        soldItem.normal += normalCount;
        soldItem.revenue += perfectRevenue + normalRevenue;
        orderRevenue += perfectRevenue + normalRevenue;
      });

      bakedGoods = nextStock;
      callbacks.onBakedGoodsChange({ ...nextStock });
      sale.revenue += orderRevenue;
      if (callbacks.onRevenueEarned) callbacks.onRevenueEarned(orderRevenue);
      leaveSeat(customer, "satisfied", orderRevenue);
      sale.feedback = `${customer.seat + 1}번 손님 주문 완료! +${orderRevenue} ${CURRENCY_NAME}`;
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
      sale.departures.forEach((departure, seat) => {
        if (!departure) return;
        departure.remaining = Math.max(0, departure.remaining - delta);
        if (departure.remaining <= 0) {
          sale.departures[seat] = null;
          shouldRender = true;
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
      if (callbacks.onSaleFinished) callbacks.onSaleFinished();
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

    function reset() {
      running = false;
      cancelAnimationFrame(animationId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      sale = null;
      root = null;
      callbacks = null;
      bakedGoods = {};
    }

    return { start, reset };
  }

  window.MeowStages = window.MeowStages || {};
  window.MeowStages.store = createStage();
})();
