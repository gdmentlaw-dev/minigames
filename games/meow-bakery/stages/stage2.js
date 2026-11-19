(function () {
  "use strict";

  const CURRENCY_NAME = window.MeowBakeryConfig.CURRENCY_NAME;
  const INGREDIENT_BUNDLE_SIZE = 5;
  const INGREDIENT_BUNDLE_PRICES = Object.freeze({
    milk: 2,
    egg: 1,
    butter: 2,
    sugar: 1,
    salt: 4,
    cocoa: 2,
    strawberry: 2,
    chocolate: 1,
    cream: 2
  });
  const INGREDIENT_LABELS = Object.freeze({
    milk: "우유 · Milk",
    egg: "달걀 · Egg",
    butter: "버터 · Butter",
    sugar: "설탕 · Sugar",
    salt: "소금 · Salt",
    cocoa: "초코파우더 · Choco",
    strawberry: "딸기 · Strawberry",
    chocolate: "초코칩 · Chips",
    cream: "생크림 · Cream"
  });
  const INGREDIENT_ORDER = Object.freeze([
    "milk", "egg", "butter", "sugar", "salt", "cocoa", "strawberry", "chocolate", "cream"
  ]);

  function createStage() {
    let root = null;
    let inventory = {};
    let wallet = 0;
    let callbacks = null;

    function render() {
      if (!root) return;
      const ingredients = INGREDIENT_ORDER.map(id => `
        <li class="ingredient-row">
          <i class="ingredient-swatch" aria-hidden="true"></i>
          <span class="ingredient-name">${INGREDIENT_LABELS[id]}</span>
          <strong>${inventory[id] || 0}</strong>
        </li>`).join("");
      const shopItems = INGREDIENT_ORDER.map(id => {
        const price = INGREDIENT_BUNDLE_PRICES[id];
        return `
          <li class="ingredient-row ingredient-shop-row">
            <i class="ingredient-swatch" aria-hidden="true"></i>
            <span class="ingredient-name">${INGREDIENT_LABELS[id]}</span>
            <span class="ingredient-shop-price">${INGREDIENT_BUNDLE_SIZE}개 · ${price} ${CURRENCY_NAME}</span>
            <button type="button" class="ingredient-buy-button" data-ingredient="${id}"
              aria-label="${INGREDIENT_LABELS[id]} ${INGREDIENT_BUNDLE_SIZE}개를 ${price} ${CURRENCY_NAME}에 구매"
              ${wallet < price ? "disabled" : ""}>${INGREDIENT_BUNDLE_SIZE}개 사기</button>
          </li>`;
      }).join("");

      root.innerHTML = `
        <div class="shop-heading">
          <div><p class="eyebrow">2단계</p><h2>재료 사기</h2></div>
          <p class="shop-wallet">지갑 잔액 <strong>${wallet.toLocaleString("ko-KR")}</strong> <span>${CURRENCY_NAME}</span></p>
        </div>
        <div class="ingredient-shop-layout">
          <aside class="pantry stage2-pantry" aria-labelledby="shop-pantry-title">
            <div class="pantry-heading">
              <span class="pantry-icon" aria-hidden="true"></span>
              <div><p class="eyebrow">공용 재료</p><h3 id="shop-pantry-title">재료 바구니</h3></div>
            </div>
            <ul class="ingredient-list stage2-ingredient-list">${ingredients}</ul>
            <p class="pantry-total">보유 재료 <strong>${INGREDIENT_ORDER.reduce((sum, id) => sum + (inventory[id] || 0), 0)}</strong></p>
          </aside>
          <aside class="ingredient-shop" aria-labelledby="ingredient-shop-title">
            <h3 id="ingredient-shop-title">재료 묶음 가격</h3>
            <ul class="ingredient-shop-list">${shopItems}</ul>
          </aside>
        </div>`;

      root.querySelectorAll(".ingredient-buy-button").forEach(button => {
        button.addEventListener("click", () => buyIngredient(button.dataset.ingredient));
      });
    }

    function buyIngredient(id) {
      const price = INGREDIENT_BUNDLE_PRICES[id];
      if (!Number.isInteger(price) || wallet < price) return;
      wallet -= price;
      inventory = {
        ...inventory,
        [id]: (inventory[id] || 0) + INGREDIENT_BUNDLE_SIZE
      };
      callbacks.onShopPurchase({ inventory: { ...inventory }, wallet });
      render();
    }

    function start(options) {
      root = options.root;
      inventory = { ...options.inventory };
      wallet = Number.isSafeInteger(options.wallet) && options.wallet >= 0 ? options.wallet : 0;
      callbacks = options;
      render();

      return {
        stop() {
          root = null;
          callbacks = null;
        }
      };
    }

    return { start };
  }

  window.MeowStages = window.MeowStages || {};
  window.MeowStages.ingredientShop = Object.freeze({
    bundleSize: INGREDIENT_BUNDLE_SIZE,
    prices: INGREDIENT_BUNDLE_PRICES,
    labels: INGREDIENT_LABELS,
    order: INGREDIENT_ORDER,
    cheapestPrice: Math.min(...Object.values(INGREDIENT_BUNDLE_PRICES))
  });
  window.MeowStages.stage2 = createStage();
})();
