(function () {
  "use strict";

  const WIDTH = 640;
  const HEIGHT = 420;
  const DURATION = 60;
  const ITEM_SIZE = 60;
  const INGREDIENT_IDS = ["milk", "egg", "butter", "sugar", "salt", "cocoa", "strawberry", "chocolate", "cream"];
  const ITEM_TYPES = [...INGREDIENT_IDS, "trouble"];
  const INGREDIENT_NAMES = {
    milk: "우유 · Milk", egg: "달걀 · Egg", butter: "버터 · Butter",
    sugar: "설탕 · Sugar", salt: "소금 · Salt", cocoa: "초코파우더 · Choco",
    strawberry: "딸기 · Strawberry", chocolate: "초코칩 · Chips", cream: "생크림 · Cream"
  };

  const PIXEL_FONT = {
    A:["11111","10001","10001","11111","10001","10001","10001"],
    B:["11110","10001","10001","11110","10001","10001","11110"],
    C:["01111","10000","10000","10000","10000","10000","01111"],
    E:["11111","10000","10000","11110","10000","10000","11111"],
    H:["10001","10001","10001","11111","10001","10001","10001"],
    I:["11111","00100","00100","00100","00100","00100","11111"],
    K:["10001","10010","10100","11000","10100","10010","10001"],
    L:["10000","10000","10000","10000","10000","10000","11111"],
    M:["10001","11011","10101","10101","10001","10001","10001"],
    O:["01110","10001","10001","10001","10001","10001","01110"],
    R:["11110","10001","10001","11110","10100","10010","10001"],
    S:["01111","10000","10000","01110","00001","00001","11110"],
    T:["11111","00100","00100","00100","00100","00100","00100"],
    U:["10001","10001","10001","10001","10001","10001","01110"],
    Y:["10001","10001","01010","00100","00100","00100","00100"]
  };

  function pixelText(context, text, x, y, scale, color) {
    context.fillStyle = color;
    let cursor = x;
    Array.from(text).forEach(character => {
      const glyph = PIXEL_FONT[character];
      if (!glyph) {
        cursor += scale * 6;
        return;
      }
      glyph.forEach((row, rowIndex) => {
        Array.from(row).forEach((pixel, columnIndex) => {
          if (pixel === "1") context.fillRect(cursor + columnIndex * scale, y + rowIndex * scale, scale, scale);
        });
      });
      cursor += scale * 6;
    });
  }

  function pixelTextCentered(context, text, centerX, centerY, scale, color) {
    const textWidth = text.length * 5 * scale + (text.length - 1) * scale;
    const textHeight = 7 * scale;
    pixelText(context, text, centerX - textWidth / 2, centerY - textHeight / 2, scale, color);
  }

  function drawCarton(context, x, y, bodyColor, labelColor, label, cream, withLabel) {
    context.fillStyle = "#684536";
    context.fillRect(x + 12, y, 36, 5);
    context.fillRect(x + 8, y + 5, 44, 5);
    context.beginPath();
    context.moveTo(x + 8, y + 10);
    context.lineTo(x + 30, y - 6);
    context.lineTo(x + 52, y + 10);
    context.closePath();
    context.fill();
    context.fillStyle = bodyColor;
    context.fillRect(x + 10, y + 10, 40, 44);
    context.fillRect(x + 15, y + 5, 30, 12);
    context.fillStyle = labelColor;
    context.fillRect(x + 14, y + 24, 32, 17);
    if (withLabel) pixelTextCentered(context, label, x + 30, y + 32.5, 0.8, "#55483f");
    context.fillStyle = cream ? "#fff7e7" : "#e7f7f4";
    context.fillRect(x + 18, y + 12, 24, 7);
  }

  function drawJar(context, x, y, powderColor, label, withLabel) {
    context.fillStyle = "#684536";
    context.fillRect(x + 15, y + 3, 30, 5);
    context.fillRect(x + 12, y + 8, 36, 6);
    context.fillStyle = "#dff5ef";
    context.fillRect(x + 12, y + 14, 36, 38);
    context.fillStyle = "#ffffff";
    context.fillRect(x + 15, y + 17, 30, 32);
    context.fillStyle = "#9bc9c8";
    context.fillRect(x + 15, y + 14, 30, 4);
    context.fillRect(x + 12, y + 20, 4, 28);
    context.fillRect(x + 44, y + 20, 4, 28);
    context.fillStyle = powderColor;
    context.fillRect(x + 16, y + 31, 28, 17);
    context.fillStyle = "#fff7df";
    context.fillRect(x + 17, y + 24, 26, 7);
    context.fillStyle = "#fff6dd";
    context.fillRect(x + 17, y + 25, 26, 14);
    if (withLabel) pixelTextCentered(context, label, x + 30, y + 32, 0.75, "#55483f");
  }

  function drawItem(context, id, x, y, withLabel) {
    context.save();
    context.translate(Math.round(x), Math.round(y));
    context.imageSmoothingEnabled = false;
    if (id === "milk") {
      drawCarton(context, 0, 6, "#69a66e", "#dff2c9", "MILK", false, withLabel);
    } else if (id === "cream") {
      drawCarton(context, 0, 6, "#69a6c9", "#edf7ff", "CREAM", true, withLabel);
    } else if (id === "egg") {
      context.fillStyle = "#684536";
      context.beginPath();
      context.ellipse(30, 31, 18, 25, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#f4df84";
      context.beginPath();
      context.ellipse(30, 29, 15, 22, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#fff0a6";
      context.fillRect(20, 17, 5, 10);
      context.fillStyle = "#d9c36a";
      context.fillRect(18, 48, 24, 4);
    } else if (id === "butter") {
      context.save();
      context.translate(3, 8);
      context.rotate(-0.12);
      context.fillStyle = "#684536";
      context.fillRect(5, 5, 50, 38);
      context.fillStyle = "#f7cf56";
      context.fillRect(8, 8, 44, 32);
      context.fillStyle = "#ffe98a";
      context.fillRect(8, 8, 44, 8);
      if (withLabel) pixelText(context, "BUTTER", 11, 23, 1, "#68523a");
      context.restore();
    } else if (id === "sugar") {
      drawJar(context, 0, 5, "#f7f2d9", "SUGAR", withLabel);
    } else if (id === "salt") {
      drawJar(context, 0, 5, "#eef1e8", "SALT", withLabel);
    } else if (id === "cocoa") {
      drawJar(context, 0, 5, "#7a4a38", "CHOCO", withLabel);
      context.fillStyle = "#5d382d";
      context.fillRect(12, 8, 36, 5);
    } else if (id === "strawberry") {
      context.fillStyle = "#684536";
      context.beginPath();
      context.moveTo(12, 24);
      context.lineTo(48, 24);
      context.lineTo(43, 48);
      context.lineTo(30, 58);
      context.lineTo(17, 48);
      context.closePath();
      context.fill();
      context.fillStyle = "#df4d58";
      context.beginPath();
      context.moveTo(15, 27);
      context.lineTo(45, 27);
      context.lineTo(40, 46);
      context.lineTo(30, 54);
      context.lineTo(20, 46);
      context.closePath();
      context.fill();
      context.fillStyle = "#77a84f";
      context.fillRect(22, 18, 6, 12);
      context.fillRect(32, 18, 6, 12);
      context.fillRect(27, 13, 6, 14);
      context.fillStyle = "#fff1b5";
      context.fillRect(22, 32, 3, 3);
      context.fillRect(35, 34, 3, 3);
      context.fillRect(28, 40, 3, 3);
      context.fillRect(38, 43, 3, 3);
    } else if (id === "chocolate") {
      context.fillStyle = "#684536";
      context.fillRect(8, 24, 44, 22);
      context.fillStyle = "#5b382d";
      context.fillRect(12, 20, 36, 30);
      context.fillStyle = "#7a4a38";
      context.fillRect(15, 16, 30, 30);
      context.fillRect(9, 27, 42, 15);
      context.fillRect(20, 43, 24, 8);
      context.fillStyle = "#402a24";
      context.fillRect(16, 24, 5, 5);
      context.fillRect(28, 18, 5, 5);
      context.fillRect(39, 30, 5, 5);
      context.fillRect(25, 38, 5, 5);
    } else if (id === "trouble") {
      context.fillStyle = "#5a3828";
      context.fillRect(12, 48, 36, 8);
      context.fillRect(18, 40, 24, 10);
      context.fillRect(24, 32, 12, 10);
      context.fillStyle = "#3f291f";
      context.beginPath();
      context.arc(32, 39, 10, 0, Math.PI * 1.75);
      context.strokeStyle = "#3f291f";
      context.lineWidth = 4;
      context.stroke();
      context.fillStyle = "#81563f";
      context.fillRect(20, 43, 5, 5);
      context.fillRect(30, 34, 5, 5);
      context.fillRect(38, 48, 4, 4);
      context.fillStyle = "#a27a62";
      context.fillRect(18, 18, 3, 8);
      context.fillRect(27, 10, 3, 7);
      context.fillRect(39, 17, 3, 9);
    }
    context.restore();
  }

  function installIngredientIcons() {
    const style = document.createElement("style");
    style.textContent = [
      "#ingredient-list .ingredient-row, #result-list .ingredient-row { grid-template-columns: 35px minmax(0, 1fr) auto; gap: 5px; min-height: 39px; }",
      "#ingredient-list .ingredient-swatch, #result-list .ingredient-swatch { display: block; width: 34px; height: 34px; border: 0; background: var(--ingredient-icon) center / contain no-repeat !important; image-rendering: pixelated; }",
      "#result-list .ingredient-row { grid-template-columns: 25px minmax(0, 1fr) auto; gap: 3px; }",
      "#result-list .ingredient-swatch { width: 24px; height: 24px; }",
      "@media (max-width: 760px) { #ingredient-list .ingredient-row { grid-template-columns: 25px minmax(0, 1fr) auto; gap: 3px; min-height: 27px; } #ingredient-list .ingredient-swatch { width: 24px; height: 24px; } }",
      "@media (max-width: 430px) { #result-list .ingredient-row { grid-template-columns: 20px minmax(0, 1fr) auto; gap: 2px; } #result-list .ingredient-swatch { width: 19px; height: 19px; } }"
    ].join("\n");
    document.head.append(style);

    const iconUrls = {};
    INGREDIENT_IDS.forEach(id => {
      const icon = document.createElement("canvas");
      icon.width = ITEM_SIZE;
      icon.height = ITEM_SIZE;
      drawItem(icon.getContext("2d"), id, 0, 0, false);
      iconUrls[id] = `url("${icon.toDataURL("image/png")}")`;
    });

    function decorateIcons() {
      document.querySelectorAll(".ingredient-row").forEach(row => {
        const name = row.querySelector(".ingredient-name");
        const swatch = row.querySelector(".ingredient-swatch");
        if (!name || !swatch) return;
        const id = INGREDIENT_IDS.find(ingredientId => INGREDIENT_NAMES[ingredientId] === name.textContent);
        if (id) swatch.style.setProperty("--ingredient-icon", iconUrls[id]);
      });
    }

    const observer = new MutationObserver(decorateIcons);
    observer.observe(document.body, { childList: true, subtree: true });
    decorateIcons();
  }

  function rectangle(context, x, y, width, height, color) {
    context.fillStyle = color;
    context.fillRect(x, y, width, height);
  }

  function drawBackground(context) {
    rectangle(context, 0, 0, WIDTH, HEIGHT, "#b7dfe1");
    rectangle(context, 0, 281, WIDTH, 139, "#e8c99e");
    rectangle(context, 0, 277, WIDTH, 10, "#9f6b4c");

    rectangle(context, 42, 42, 117, 93, "#fff6df");
    rectangle(context, 51, 51, 99, 75, "#79b8c2");
    rectangle(context, 98, 51, 7, 75, "#fff6df");
    rectangle(context, 51, 85, 99, 7, "#fff6df");
    rectangle(context, 60, 61, 20, 7, "#a9d8d6");
    rectangle(context, 121, 104, 20, 7, "#a9d8d6");

    rectangle(context, 190, 47, 124, 9, "#fff1d2");
    rectangle(context, 196, 56, 10, 59, "#b97950");
    rectangle(context, 284, 56, 10, 59, "#b97950");
    rectangle(context, 184, 112, 137, 8, "#8d5943");
    rectangle(context, 197, 78, 20, 28, "#f5d17b");
    rectangle(context, 222, 68, 23, 38, "#fff8e9");
    rectangle(context, 250, 85, 25, 21, "#b97850");
    rectangle(context, 302, 70, 18, 30, "#789c73");

    rectangle(context, 0, 340, WIDTH, 8, "#d5a77b");
    for (let x = -20; x < WIDTH; x += 64) {
      rectangle(context, x, 348, 32, 8, "#d5a77b");
      rectangle(context, x + 32, 356, 32, 8, "#d5a77b");
      rectangle(context, x, 364, 32, 8, "#d5a77b");
      rectangle(context, x + 32, 372, 32, 8, "#d5a77b");
      rectangle(context, x, 380, 32, 8, "#d5a77b");
      rectangle(context, x + 32, 388, 32, 8, "#d5a77b");
      rectangle(context, x, 396, 32, 8, "#d5a77b");
      rectangle(context, x + 32, 404, 32, 8, "#d5a77b");
    }
  }

  function drawCat(context, x, y) {
    const dark = "#694536";
    const fur = "#e5aa6b";
    const light = "#fff6e2";
    rectangle(context, x + 5, y + 23, 8, 24, dark);
    rectangle(context, x + 67, y + 23, 8, 24, dark);
    rectangle(context, x + 10, y + 20, 57, 48, dark);
    rectangle(context, x + 15, y + 25, 47, 38, fur);
    rectangle(context, x + 13, y + 10, 18, 21, dark);
    rectangle(context, x + 18, y + 15, 8, 11, fur);
    rectangle(context, x + 47, y + 10, 18, 21, dark);
    rectangle(context, x + 52, y + 15, 8, 11, fur);
    rectangle(context, x + 26, y + 38, 5, 8, dark);
    rectangle(context, x + 47, y + 38, 5, 8, dark);
    rectangle(context, x + 36, y + 47, 7, 5, "#c75d68");
    rectangle(context, x + 23, y + 49, 13, 3, dark);
    rectangle(context, x + 43, y + 49, 13, 3, dark);
    rectangle(context, x + 22, y + 55, 34, 3, dark);
    rectangle(context, x + 10, y + 49, 14, 3, light);
    rectangle(context, x + 53, y + 49, 14, 3, light);
    rectangle(context, x + 25, y + 1, 38, 11, dark);
    rectangle(context, x + 29, y + 4, 30, 7, light);
    rectangle(context, x + 20, y + 10, 50, 6, dark);
    rectangle(context, x + 24, y + 12, 42, 3, light);
    rectangle(context, x + 18, y + 64, 42, 15, "#fff2d6");
    rectangle(context, x + 35, y + 64, 8, 12, "#d97768");
    rectangle(context, x + 4, y + 78, 70, 9, dark);
    rectangle(context, x + 10, y + 82, 58, 18, "#c67d50");
    rectangle(context, x + 15, y + 85, 48, 11, "#e5aa6b");
    rectangle(context, x + 20, y + 90, 38, 3, dark);
    rectangle(context, x + 10, y + 98, 58, 6, dark);
  }

  function drawBasket(context, x, y) {
    rectangle(context, x + 5, y, 56, 5, "#684536");
    rectangle(context, x, y + 5, 66, 27, "#684536");
    rectangle(context, x + 5, y + 10, 56, 17, "#d18b51");
    rectangle(context, x + 14, y + 10, 5, 17, "#8b583e");
    rectangle(context, x + 29, y + 10, 5, 17, "#8b583e");
    rectangle(context, x + 44, y + 10, 5, 17, "#8b583e");
    rectangle(context, x + 6, y + 27, 55, 5, "#684536");
  }

  function drawScene(context, objects, basketX, timeLeft) {
    drawBackground(context);
    drawCat(context, 275, 217);
    rectangle(context, 0, 407, WIDTH, 13, "#8d5943");
    rectangle(context, 18, 404, WIDTH - 36, 6, "#b77950");
    rectangle(context, 70, 391, 92, 13, "#c99167");
    rectangle(context, 85, 378, 15, 13, "#fff4dd");
    rectangle(context, 100, 370, 15, 21, "#fff4dd");
    rectangle(context, 115, 378, 15, 13, "#fff4dd");
    rectangle(context, 133, 382, 18, 9, "#d97768");
    rectangle(context, 134, 377, 16, 5, "#648b55");

    objects.forEach(object => {
      rectangle(context, object.x + 8, object.y + ITEM_SIZE - 4, ITEM_SIZE - 16, 4, "rgba(91, 67, 55, .16)");
      drawItem(context, object.type, object.x, object.y, true);
    });

    drawBasket(context, basketX - 33, 330);
    if (timeLeft <= 10 && Math.floor(timeLeft * 6) % 2 === 0) {
      rectangle(context, 12, 12, 7, 7, "#f5c76d");
      rectangle(context, 24, 21, 4, 4, "#fff6df");
    }
  }

  function createStage() {
    let running = false;
    let lastTimestamp = 0;
    let elapsed = 0;
    let spawnIn = 0.25;
    let basketX = WIDTH / 2;
    let direction = 0;
    let pointerActive = false;
    let objects = [];
    let inventory = {};
    let animationId = 0;
    let canvas;
    let context;
    let callbacks;
    let lastSpawnedType = "";

    function moveBasketTo(event) {
      if (!running) return;
      const bounds = canvas.getBoundingClientRect();
      const scaleX = WIDTH / bounds.width;
      basketX = Math.max(38, Math.min(WIDTH - 38, (event.clientX - bounds.left) * scaleX));
    }

    function onKeyDown(event) {
      if (event.code === "ArrowLeft" || event.code === "KeyA") {
        direction = -1;
        event.preventDefault();
      } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        direction = 1;
        event.preventDefault();
      }
    }

    function onKeyUp(event) {
      if ((event.code === "ArrowLeft" || event.code === "KeyA") && direction < 0) direction = 0;
      if ((event.code === "ArrowRight" || event.code === "KeyD") && direction > 0) direction = 0;
    }

    function bind() {
      canvas.addEventListener("pointerdown", onPointerDown);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerup", onPointerUp);
      canvas.addEventListener("pointercancel", onPointerUp);
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    function unbind() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }

    function onPointerDown(event) {
      event.preventDefault();
      pointerActive = true;
      if (canvas.setPointerCapture) canvas.setPointerCapture(event.pointerId);
      moveBasketTo(event);
    }

    function onPointerMove(event) {
      event.preventDefault();
      if (pointerActive) moveBasketTo(event);
    }

    function onPointerUp() {
      pointerActive = false;
    }

    function onVisibilityChange() {
      if (!running) return;
      lastTimestamp = 0;
      if (document.hidden) {
        cancelAnimationFrame(animationId);
      } else {
        animationId = requestAnimationFrame(loop);
      }
    }

    function spawnObject() {
      let type = ITEM_TYPES[Math.floor(Math.random() * ITEM_TYPES.length)];
      if (type === lastSpawnedType && Math.random() < 0.65) {
        type = ITEM_TYPES[(ITEM_TYPES.indexOf(type) + 1 + Math.floor(Math.random() * (ITEM_TYPES.length - 1))) % ITEM_TYPES.length];
      }
      lastSpawnedType = type;
      objects.push({
        type,
        x: 10 + Math.random() * (WIDTH - ITEM_SIZE - 10),
        y: -ITEM_SIZE - 5,
        speed: 105 + Math.random() * 65 + elapsed * 1.1
      });
    }

    function catchObject(object) {
      if (object.type === "trouble") {
        for (let index = INGREDIENT_IDS.length - 1; index >= 0; index--) {
          const id = INGREDIENT_IDS[index];
          if (inventory[id] > 0) {
            inventory[id] -= 1;
            break;
          }
        }
      } else {
        inventory[object.type] += 1;
      }
      if (callbacks.onInventoryChange) callbacks.onInventoryChange({ ...inventory });
    }

    function update(delta) {
      elapsed += delta;
      const timeLeft = Math.max(0, DURATION - elapsed);
      basketX = Math.max(38, Math.min(WIDTH - 38, basketX + direction * delta * 330));
      spawnIn -= delta;
      if (spawnIn <= 0) {
        spawnObject();
        spawnIn = Math.max(0.38, 0.78 - elapsed * 0.004) + Math.random() * 0.25;
      }

      objects.forEach(object => {
        object.y += object.speed * delta;
        if (object.y + ITEM_SIZE - 5 >= 330 && object.y + ITEM_SIZE - 13 <= 362 &&
          object.x + ITEM_SIZE - 6 >= basketX - 29 && object.x + 6 <= basketX + 29) {
          object.caught = true;
          catchObject(object);
        }
      });
      objects = objects.filter(object => !object.caught && object.y < HEIGHT + 10);
      callbacks.onUpdate(inventory, timeLeft);
      return timeLeft;
    }

    function loop(timestamp) {
      if (!running || document.hidden) return;
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
      lastTimestamp = timestamp;
      const timeLeft = update(delta);
      drawScene(context, objects, basketX, timeLeft);
      if (timeLeft <= 0) {
        running = false;
        unbind();
        callbacks.onComplete({ ...inventory });
        return;
      }
      animationId = requestAnimationFrame(loop);
    }

    function start(options) {
      canvas = options.canvas;
      context = canvas.getContext("2d");
      context.imageSmoothingEnabled = false;
      callbacks = options;
      inventory = { ...options.inventory };
      objects = [];
      elapsed = 0;
      spawnIn = 0.25;
      basketX = WIDTH / 2;
      direction = 0;
      pointerActive = false;
      lastTimestamp = 0;
      lastSpawnedType = "";
      running = true;
      bind();
      callbacks.onUpdate(inventory, DURATION);
      animationId = requestAnimationFrame(loop);

      return {
        setDirection(value) {
          direction = Math.max(-1, Math.min(1, value));
        },
        stop() {
          if (!running) return;
          running = false;
          cancelAnimationFrame(animationId);
          unbind();
        }
      };
    }

    return { start };
  }

  installIngredientIcons();
  window.MeowStages = window.MeowStages || {};
  window.MeowStages.stage1 = createStage();
})();
