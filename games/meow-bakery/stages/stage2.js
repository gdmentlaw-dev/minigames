(function () {
  "use strict";

  const RECIPES = [
    { id: "butterCookie", name: "버터쿠키", needs: { butter: 2, sugar: 1, egg: 1 } },
    { id: "chocolateCookie", name: "초코칩 쿠키", needs: { butter: 2, sugar: 2, egg: 1, chocolate: 3 } },
    { id: "madeleine", name: "마들렌", needs: { butter: 2, egg: 2, sugar: 2, milk: 1 } },
    { id: "strawberryCake", name: "딸기 케이크", needs: { strawberry: 3, cream: 2, egg: 2, sugar: 2, milk: 1 } },
    { id: "sourdough", name: "사워도우", needs: { salt: 2, milk: 1, sugar: 1 } }
  ];

  const INGREDIENT_LABELS = {
    milk: "우유 · Milk", egg: "달걀 · Egg", butter: "버터 · Butter",
    sugar: "설탕 · Sugar", salt: "소금 · Salt", cocoa: "초코파우더 · Choco",
    strawberry: "딸기 · Strawberry", chocolate: "초코칩 · Chips", cream: "생크림 · Cream"
  };
  const INGREDIENT_ORDER = ["milk", "egg", "butter", "sugar", "salt", "cocoa", "strawberry", "chocolate", "cream"];

  const BREAD_LABELS = {
    butterCookie: "버터쿠키", chocolateCookie: "초코칩 쿠키", madeleine: "마들렌",
    strawberryCake: "딸기 케이크", sourdough: "사워도우"
  };

  function readStock(bakedGoods, recipeId) {
    const stock = bakedGoods[recipeId];
    if (typeof stock === "number") return { perfect: 0, normal: stock };
    return { perfect: stock && stock.perfect || 0, normal: stock && stock.normal || 0 };
  }

  function createStage() {
    let root = null;
    let inventory = {};
    let bakedGoods = {};
    let callbacks = null;
    let running = false;
    let baking = false;
    let animationId = 0;
    let markerPosition = 0;
    let markerDirection = 1;
    let lastTime = 0;
    let selectedRecipe = null;
    let resultText = "";

    function canBake(recipe) {
      return Object.entries(recipe.needs).every(([id, amount]) => (inventory[id] || 0) >= amount);
    }

    function consumeRecipe(recipe) {
      const next = { ...inventory };
      Object.entries(recipe.needs).forEach(([id, amount]) => {
        next[id] = (next[id] || 0) - amount;
      });
      inventory = next;
      callbacks.onInventoryChange(inventory);
    }

    function rect(context, x, y, width, height, color) {
      context.fillStyle = color;
      context.fillRect(Math.round(x), Math.round(y), width, height);
    }

    function circle(context, x, y, radius, fill, stroke) {
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.fillStyle = fill;
      context.fill();
      if (stroke) {
        context.strokeStyle = stroke;
        context.lineWidth = 2;
        context.stroke();
      }
    }

    function drawDigitalDigit(context, x, y, digit) {
      const segments = {
        0: ["a", "b", "c", "d", "e", "f"],
        1: ["b", "c"],
        8: ["a", "b", "c", "d", "e", "f", "g"]
      }[digit] || [];
      const positions = {
        a: [2, 0, 8, 2], b: [10, 2, 2, 7], c: [10, 11, 2, 7],
        d: [2, 18, 8, 2], e: [0, 11, 2, 7], f: [0, 2, 2, 7], g: [2, 9, 8, 2]
      };
      segments.forEach(segment => {
        const [dx, dy, w, h] = positions[segment];
        rect(context, x + dx, y + dy, w, h, "#9ce5c0");
      });
    }

    function drawOven(context, width, height, isBaking, time) {
      rect(context, 14, 12, width - 28, height - 22, "#181c1e");
      rect(context, 20, 8, width - 40, height - 24, "#373d40");
      rect(context, 28, 16, width - 56, height - 40, "#454c4f");
      rect(context, 36, 22, width - 72, 60, "#292f32");
      rect(context, 43, 28, width - 86, 47, "#22282b");

      rect(context, 54, 35, 67, 31, "#10191a");
      rect(context, 58, 39, 59, 23, "#162a27");
      drawDigitalDigit(context, 64, 41, 1);
      drawDigitalDigit(context, 82, 41, 8);
      drawDigitalDigit(context, 100, 41, 0);
      rect(context, 126, 46, 3, 10, "#9ce5c0");

      [178, 246, 314, 382].forEach((x, index) => {
        circle(context, x + 2, 57, 14, "#1a1e20", "#111516");
        const metal = context.createRadialGradient(x - 4, 51, 2, x, 57, 12);
        metal.addColorStop(0, "#e5e5dc");
        metal.addColorStop(.38, "#a9afb0");
        metal.addColorStop(1, "#52595b");
        circle(context, x, 55, 10, metal, "#252a2c");
        const angle = [-Math.PI / 3, 0, Math.PI / 3, Math.PI][index];
        context.beginPath();
        context.moveTo(x, 55);
        context.lineTo(x + Math.cos(angle) * 6, 55 + Math.sin(angle) * 6);
        context.strokeStyle = "#293033";
        context.lineWidth = 2;
        context.stroke();
        circle(context, x, 55, 2, "#333a3c");
      });

      rect(context, 42, 87, width - 84, 131, "#1d2224");
      rect(context, 48, 93, width - 96, 119, "#707779");
      rect(context, 56, 100, width - 112, 103, "#11191c");
      const glow = context.createRadialGradient(width / 2, 152, 8, width / 2, 152, 185);
      const flicker = isBaking ? .38 + (Math.sin(time / 85) + 1) * .1 : .12;
      glow.addColorStop(0, `rgba(255, 151, 66, ${flicker})`);
      glow.addColorStop(.55, `rgba(215, 91, 38, ${flicker * .52})`);
      glow.addColorStop(1, "rgba(197, 67, 33, 0)");
      context.fillStyle = glow;
      context.fillRect(56, 100, width - 112, 103);
      rect(context, 60, 106, 3, 90, "rgba(255,255,255,.15)");
      rect(context, width - 63, 106, 3, 90, "rgba(255,255,255,.1)");
      rect(context, 83, 190, width - 166, 3, "#747b7c");

      if (isBaking && selectedRecipe) {
        const shimmer = Math.sin(time / 70) > 0 ? "#f1b85d" : "#d98a45";
        drawBread(context, selectedRecipe.id, 223, 125, 2);
        rect(context, 211, 183, 98, 3, shimmer);
      }

      const handle = context.createLinearGradient(0, 220, 0, 234);
      handle.addColorStop(0, "#eff0e9");
      handle.addColorStop(.35, "#92999a");
      handle.addColorStop(.72, "#555d60");
      handle.addColorStop(1, "#262b2d");
      rect(context, 143, 217, 234, 5, "#1b2022");
      rect(context, 133, 214, 254, 5, handle);
      rect(context, 147, 219, 226, 3, "#d0d2cc");
      rect(context, 102, 222, width - 204, 2, "#24292b");

      rect(context, 84, 250, width - 168, 19, "#202527");
      rect(context, 89, 254, width - 178, 11, "#803b34");
      rect(context, 89 + (width - 178) * .16, 254, (width - 178) * .16, 11, "#ce7b42");
      rect(context, 89 + (width - 178) * .32, 254, (width - 178) * .36, 11, "#74ad70");
      rect(context, 89 + (width - 178) * .43, 254, (width - 178) * .14, 11, "#a8d88d");
      rect(context, 89 + (width - 178) * .68, 254, (width - 178) * .16, 11, "#ce7b42");
    }

    function drawBread(context, recipeId, x, y, scale) {
      const px = scale;
      const block = (left, top, width, height, color) => {
        rect(context, x + left * px, y + top * px, width * px, height * px, color);
      };
      if (recipeId === "butterCookie" || recipeId === "chocolateCookie") {
        if (recipeId === "butterCookie") {
          block(7, 11, 26, 17, "#9b643d");
          block(10, 8, 20, 21, "#eab95f");
          block(13, 10, 14, 16, "#f5d485");
          block(13, 8, 14, 3, "#ffebaa");
          block(11, 26, 18, 3, "#d7974d");
        } else {
          block(9, 8, 22, 3, "#9b643d");
          block(6, 11, 28, 12, "#9b643d");
          block(9, 23, 22, 5, "#9b643d");
          block(11, 8, 18, 18, "#c77b3f");
          block(8, 11, 24, 12, "#d9904c");
          block(13, 10, 10, 3, "#efb269");
          block(11, 13, 4, 4, "#51342b");
          block(23, 12, 4, 4, "#51342b");
          block(18, 20, 4, 4, "#51342b");
          block(27, 18, 3, 3, "#51342b");
        }
      } else if (recipeId === "madeleine") {
        block(12, 9, 16, 3, "#9b643d");
        block(8, 12, 24, 10, "#9b643d");
        block(12, 22, 16, 6, "#9b643d");
        block(11, 8, 18, 3, "#f0bf61");
        block(9, 11, 22, 10, "#f5cf78");
        block(13, 21, 14, 5, "#e9ae51");
        for (let index = 0; index < 4; index += 1) {
          block(12 + index * 5, 12, 2, 9, "#d99b4e");
        }
        block(14, 9, 12, 2, "#ffe49a");
      } else if (recipeId === "strawberryCake") {
        block(6, 16, 28, 14, "#9b643d");
        block(9, 18, 22, 8, "#e9b875");
        block(6, 13, 28, 5, "#fff4dc");
        block(9, 10, 22, 4, "#fffaf0");
        block(12, 6, 6, 6, "#df4f60");
        block(21, 5, 7, 7, "#e64e5c");
        block(13, 4, 4, 3, "#78a85a");
        block(23, 3, 4, 3, "#78a85a");
        block(18, 18, 4, 8, "#fff4dc");
      } else {
        block(8, 15, 24, 13, "#70432f");
        block(11, 10, 18, 18, "#70432f");
        block(14, 8, 12, 4, "#70432f");
        block(10, 15, 20, 10, "#a9683e");
        block(13, 11, 16, 13, "#c58a4d");
        block(16, 10, 10, 3, "#e0aa66");
        block(17, 15, 3, 8, "#77452f");
        block(20, 15, 4, 3, "#77452f");
        block(23, 18, 3, 5, "#77452f");
      }
    }

    function render() {
      const cards = RECIPES.map(recipe => {
        const available = canBake(recipe);
        const needs = Object.entries(recipe.needs).map(([id, amount]) => {
          const owned = inventory[id] || 0;
          return `<li class="${owned >= amount ? "has-enough" : "needs-more"}"><span>${INGREDIENT_LABELS[id]}</span><strong>보유 ${owned} / 필요 ${amount}</strong></li>`;
        }).join("");
        return `
          <article class="baking-recipe ${available ? "" : "is-unavailable"}">
            <div class="recipe-art" data-recipe="${recipe.id}" aria-hidden="true"></div>
            <h3>${recipe.name}</h3>
            <ul>${needs}</ul>
            <button type="button" class="bake-button" data-recipe="${recipe.id}" ${available && !baking ? "" : "disabled"}>굽기</button>
            ${available ? "" : '<p class="recipe-shortage">재료가 부족해요 · 1단계에서 받아 오세요</p>'}
          </article>`;
      }).join("");

      const ingredients = INGREDIENT_ORDER.map(id => `
        <li class="ingredient-row">
          <i class="ingredient-swatch" aria-hidden="true"></i>
          <span class="ingredient-name">${INGREDIENT_LABELS[id]}</span>
          <strong>${inventory[id] || 0}</strong>
        </li>
      `).join("");
      const stock = RECIPES.map(recipe => {
        const quantity = readStock(bakedGoods, recipe.id);
        const total = quantity.perfect + quantity.normal;
        return `
          <li>
            <span>${BREAD_LABELS[recipe.id]}<small>완벽 ${quantity.perfect} · 보통 ${quantity.normal}</small></span>
            <strong>${total}</strong>
          </li>`;
      }).join("");

      root.innerHTML = `
        <div class="stage2-heading">
          <div><p class="eyebrow">2단계</p><h2>굽기</h2></div>
          <p class="oven-tip">초록 구간에서 멈춤을 누르세요</p>
        </div>
        <div class="baking-layout">
          <div class="oven-panel">
            <canvas id="oven-canvas" width="520" height="300" aria-label="빌트인 오븐과 굽기 미니게임"></canvas>
            <button type="button" id="oven-stop" class="oven-stop" ${baking ? "" : "disabled"}>멈춤</button>
            <p class="oven-result" aria-live="polite">${resultText}</p>
          </div>
          <div class="stage2-side-panels">
            <aside class="pantry stage2-pantry" aria-labelledby="stage2-pantry-title">
              <div class="pantry-heading">
                <span class="pantry-icon" aria-hidden="true"></span>
                <div><p class="eyebrow">오늘의 준비</p><h3 id="stage2-pantry-title">재료 바구니</h3></div>
              </div>
              <ul class="ingredient-list stage2-ingredient-list">${ingredients}</ul>
              <p class="pantry-total">모은 재료 <strong>${INGREDIENT_ORDER.reduce((sum, id) => sum + (inventory[id] || 0), 0)}</strong></p>
            </aside>
            <aside class="bread-stock">
              <h3>구운 빵 재고</h3>
              <ul>${stock}</ul>
            </aside>
          </div>
        </div>
        <div class="recipe-grid">${cards}</div>`;

      root.querySelectorAll(".bake-button").forEach(button => {
        button.addEventListener("click", () => beginBake(RECIPES.find(recipe => recipe.id === button.dataset.recipe)));
      });

      root.querySelectorAll(".recipe-art").forEach(art => {
        const canvas = document.createElement("canvas");
        canvas.width = 40;
        canvas.height = 32;
        drawBread(canvas.getContext("2d"), art.dataset.recipe, 0, 0, 1);
        art.append(canvas);
      });

      const ovenCanvas = root.querySelector("#oven-canvas");
      const ovenContext = ovenCanvas.getContext("2d");
      ovenContext.imageSmoothingEnabled = false;
      drawOven(ovenContext, 520, 300, baking, performance.now());

      if (baking) drawMarker(ovenContext);

      const stopButton = root.querySelector("#oven-stop");
      stopButton.addEventListener("pointerdown", event => {
        event.preventDefault();
        stopOven();
      });
      stopButton.addEventListener("keydown", event => {
        if (event.code === "Space" || event.code === "Enter") {
          event.preventDefault();
          stopOven();
        }
      });
      ovenCanvas.addEventListener("pointerdown", event => {
        event.preventDefault();
        if (baking) stopOven();
      });
    }

    function drawMarker(context) {
      const width = 520;
      const barY = 254;
      const markerX = 89 + markerPosition * (width - 178);
      rect(context, markerX - 4, barY - 5, 8, 22, "#4a352f");
      rect(context, markerX - 1, barY - 2, 3, 16, "#fff7e7");
    }

    function beginBake(recipe) {
      if (!recipe || baking || !canBake(recipe)) return;
      consumeRecipe(recipe);
      selectedRecipe = recipe;
      baking = true;
      markerPosition = 0;
      markerDirection = 1;
      lastTime = performance.now();
      resultText = "";
      render();
      animationId = requestAnimationFrame(ovenLoop);
    }

    function ovenLoop(time) {
      if (!running || !baking) return;
      const delta = Math.min((time - lastTime) / 1000, 0.05);
      lastTime = time;
      markerPosition += markerDirection * delta * 0.72;
      if (markerPosition >= 1) {
        markerPosition = 1;
        markerDirection = -1;
      } else if (markerPosition <= 0) {
        markerPosition = 0;
        markerDirection = 1;
      }
      const ovenCanvas = root.querySelector("#oven-canvas");
      if (ovenCanvas) {
        const context = ovenCanvas.getContext("2d");
        drawOven(context, 520, 300, true, time);
        drawMarker(context);
      }
      animationId = requestAnimationFrame(ovenLoop);
    }

    function stopOven() {
      if (!baking || !selectedRecipe) return;
      baking = false;
      cancelAnimationFrame(animationId);
      const greenCenter = 0.5;
      const distance = Math.abs(markerPosition - greenCenter);
      let outcome = "탄 빵";
      if (distance <= 0.18) outcome = "완벽";
      else if (distance <= 0.34) outcome = "보통";

      if (outcome !== "탄 빵") {
        const next = { ...bakedGoods };
        const quality = outcome === "완벽" ? "perfect" : "normal";
        const quantity = readStock(bakedGoods, selectedRecipe.id);
        next[selectedRecipe.id] = { ...quantity, [quality]: quantity[quality] + 1 };
        bakedGoods = next;
        callbacks.onBakedGoodsChange(bakedGoods);
      }
      resultText = outcome === "탄 빵" ? "탄 빵: 재고에 들어가지 않았어요." : `${selectedRecipe.name} - ${outcome}! 재고에 추가됐어요.`;
      selectedRecipe = null;
      render();
    }

    function start(options) {
      root = options.root;
      callbacks = options;
      inventory = { ...options.inventory };
      bakedGoods = Object.fromEntries(RECIPES.map(recipe => [
        recipe.id,
        readStock(options.bakedGoods, recipe.id)
      ]));
      running = true;
      resultText = "";
      render();

      return {
        stop() {
          if (!running) return;
          running = false;
          if (baking && selectedRecipe) {
            const refunded = { ...inventory };
            Object.entries(selectedRecipe.needs).forEach(([id, amount]) => {
              refunded[id] = (refunded[id] || 0) + amount;
            });
            inventory = refunded;
            callbacks.onInventoryChange(inventory);
          }
          baking = false;
          selectedRecipe = null;
          cancelAnimationFrame(animationId);
          root = null;
        }
      };
    }

    return { start, drawBread };
  }

  window.MeowStages = window.MeowStages || {};
  const stage2 = createStage();
  window.MeowStages.drawBread = stage2.drawBread;
  window.MeowStages.stage2 = stage2;
})();
