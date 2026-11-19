(function () {
  "use strict";

  const WIDTH = 640;
  const HEIGHT = 420;
  const DURATION = 30;
  const ITEM_SIZE = 60;
  const BASKET_WIDTH = 66;
  const POOP_SEPARATION_SECONDS = 0.5;
  const INGREDIENT_SPEED_MULT = 1.12;
  const INGREDIENT_IDS = ["milk", "egg", "butter", "sugar", "salt", "cocoa", "strawberry", "chocolate", "cream"];
  const STANDALONE_POOP_RATE = 0.075;
  const STANDALONE_POOP_CHANCE_AFTER_OTHER_DROP = STANDALONE_POOP_RATE / (1 - STANDALONE_POOP_RATE);
  const FALL_SPEEDS = {
    milk: [70, 96], butter: [70, 96], cream: [70, 96],
    sugar: [108, 138], salt: [108, 138], cocoa: [108, 138],
    egg: [155, 190], strawberry: [155, 190], chocolate: [155, 190]
  };
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
    context.fillStyle = "#8a6045";
    context.fillRect(x + 15, y + 2, 28, 2);
    context.beginPath();
    context.moveTo(x + 8, y + 10);
    context.lineTo(x + 30, y - 6);
    context.lineTo(x + 52, y + 10);
    context.closePath();
    context.fill();
    context.fillStyle = bodyColor;
    context.fillRect(x + 10, y + 10, 40, 44);
    context.fillRect(x + 15, y + 5, 30, 12);
    context.fillStyle = "#ffffff";
    context.fillRect(x + 12, y + 18, 3, 28);
    context.fillStyle = "rgba(54, 72, 59, .18)";
    context.fillRect(x + 45, y + 18, 3, 31);
    context.fillStyle = labelColor;
    context.fillRect(x + 14, y + 24, 32, 17);
    context.fillStyle = "rgba(255, 255, 255, .55)";
    context.fillRect(x + 16, y + 26, 28, 2);
    if (withLabel) pixelTextCentered(context, label, x + 30, y + 32.5, 0.8, "#55483f");
    context.fillStyle = cream ? "#fff7e7" : "#e7f7f4";
    context.fillRect(x + 18, y + 12, 24, 7);
    context.fillStyle = "rgba(255, 255, 255, .5)";
    context.fillRect(x + 20, y + 13, 17, 2);
  }

  function drawJar(context, x, y, powderColor, label, withLabel) {
    context.fillStyle = "#684536";
    context.fillRect(x + 15, y + 3, 30, 5);
    context.fillRect(x + 12, y + 8, 36, 6);
    context.fillStyle = "#a27758";
    context.fillRect(x + 16, y + 4, 20, 2);
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
    context.fillStyle = "rgba(255, 255, 255, .42)";
    context.fillRect(x + 18, y + 33, 3, 12);
    context.fillRect(x + 23, y + 35, 2, 2);
    context.fillRect(x + 34, y + 38, 2, 2);
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
      context.fillRect(25, 13, 3, 3);
      context.fillStyle = "#d9c36a";
      context.fillRect(18, 46, 24, 4);
      context.fillRect(22, 50, 16, 2);
      context.fillStyle = "#fff7cc";
      context.fillRect(39, 20, 2, 2);
      context.fillRect(35, 27, 2, 2);
    } else if (id === "butter") {
      context.save();
      context.translate(3, 8);
      context.rotate(-0.12);
      context.fillStyle = "#684536";
      context.fillRect(5, 5, 50, 38);
      context.fillStyle = "#f7cf56";
      context.fillRect(8, 8, 44, 32);
      context.fillStyle = "#ffe98a";
      context.fillRect(8, 8, 44, 5);
      context.fillRect(12, 14, 29, 2);
      context.fillStyle = "#eab83c";
      context.fillRect(47, 15, 5, 23);
      context.fillStyle = "#fff1a7";
      context.fillRect(13, 22, 3, 12);
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
      context.fillStyle = "#a6c76b";
      context.fillRect(28, 15, 3, 8);
      context.fillRect(23, 20, 3, 2);
      context.fillRect(34, 20, 3, 2);
      context.fillStyle = "#fff1b5";
      context.fillRect(22, 32, 3, 3);
      context.fillRect(35, 34, 3, 3);
      context.fillRect(28, 40, 3, 3);
      context.fillRect(38, 43, 3, 3);
      context.fillRect(20, 40, 2, 2);
      context.fillRect(32, 47, 2, 2);
      context.fillStyle = "#f77a79";
      context.fillRect(18, 29, 3, 5);
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
      context.fillRect(38, 26, 5, 5);
      context.fillRect(26, 38, 5, 5);
      context.fillStyle = "#a87558";
      context.fillRect(17, 24, 2, 2);
      context.fillRect(39, 26, 2, 2);
      context.fillRect(27, 38, 2, 2);
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
      context.fillStyle = "#9c6b50";
      context.fillRect(20, 43, 2, 2);
      context.fillRect(31, 34, 2, 2);
      context.fillRect(38, 48, 2, 2);
      context.fillStyle = "#a27a62";
      context.fillRect(18, 18, 3, 8);
      context.fillRect(27, 10, 3, 7);
      context.fillRect(39, 17, 3, 9);
      context.fillStyle = "#c29a78";
      context.fillRect(19, 18, 1, 4);
      context.fillRect(28, 10, 1, 3);
      context.fillRect(40, 17, 1, 5);
    }
    context.restore();
  }

  function installIngredientIcons() {
    const style = document.createElement("style");
    style.textContent = [
      "#ingredient-list .ingredient-row, #result-list .ingredient-row { grid-template-columns: 35px minmax(0, 1fr) auto; gap: 5px; min-height: 39px; }",
      "#ingredient-list .ingredient-swatch, #result-list .ingredient-swatch { display: block; width: 34px; height: 34px; border: 0; background: var(--ingredient-icon) center / contain no-repeat !important; image-rendering: pixelated; }",
      ".pantry-count-headings { display: grid; grid-template-columns: 35px minmax(0, 1fr) 32px 38px; gap: 5px; margin: 8px 0 -3px; color: #977e6c; font-size: 9px; font-weight: 900; text-align: center; }",
      ".pantry-count-headings span:first-child { grid-column: 2; text-align: left; }",
      "#ingredient-list .pantry-inventory-row { grid-template-columns: 35px minmax(0, 1fr) 32px 38px; gap: 5px; min-height: 39px; }",
      "#ingredient-list .pantry-inventory-row .shared-count, #ingredient-list .pantry-inventory-row .round-count { text-align: center; }",
      "#ingredient-list .pantry-inventory-row .ingredient-name { overflow: hidden; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }",
      "#result-list .ingredient-row { grid-template-columns: 25px minmax(0, 1fr) auto; gap: 3px; }",
      "#result-list .ingredient-swatch { width: 24px; height: 24px; }",
      "@media (max-width: 760px) { #ingredient-list .ingredient-row { grid-template-columns: 25px minmax(0, 1fr) auto; gap: 3px; min-height: 27px; } #ingredient-list .pantry-inventory-row { grid-template-columns: 25px minmax(0, 1fr) 34px 42px; gap: 3px; min-height: 29px; } #ingredient-list .ingredient-swatch { width: 24px; height: 24px; } .pantry-count-headings { grid-template-columns: 25px minmax(0, 1fr) 34px 42px; gap: 3px; } #ingredient-list .pantry-inventory-row .ingredient-name { font-size: 10px; } }",
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
    rectangle(context, 0, 0, WIDTH, 11, "#a4d3d5");
    rectangle(context, 0, 271, WIDTH, 6, "#a9d1cf");
    rectangle(context, 0, 281, WIDTH, 139, "#e8c99e");
    rectangle(context, 0, 277, WIDTH, 10, "#9f6b4c");

    rectangle(context, 42, 42, 117, 93, "#fff6df");
    rectangle(context, 42, 42, 117, 5, "#f5e6c6");
    rectangle(context, 51, 51, 99, 75, "#79b8c2");
    rectangle(context, 98, 51, 7, 75, "#fff6df");
    rectangle(context, 51, 85, 99, 7, "#fff6df");
    rectangle(context, 60, 61, 20, 7, "#a9d8d6");
    rectangle(context, 121, 104, 20, 7, "#a9d8d6");
    rectangle(context, 55, 55, 3, 25, "#c2e5df");
    rectangle(context, 110, 56, 23, 3, "#c2e5df");
    rectangle(context, 128, 97, 13, 3, "#c2e5df");

    rectangle(context, 190, 47, 124, 9, "#fff1d2");
    rectangle(context, 190, 47, 124, 3, "#fff9e8");
    rectangle(context, 196, 56, 10, 59, "#b97950");
    rectangle(context, 284, 56, 10, 59, "#b97950");
    rectangle(context, 184, 112, 137, 8, "#8d5943");
    rectangle(context, 187, 120, 132, 3, "#6e493a");
    rectangle(context, 197, 78, 20, 28, "#f5d17b");
    rectangle(context, 200, 81, 3, 19, "#ffe9a8");
    rectangle(context, 211, 81, 3, 20, "#d4a84e");
    rectangle(context, 222, 68, 23, 38, "#fff8e9");
    rectangle(context, 226, 72, 15, 3, "#e4d4b8");
    rectangle(context, 227, 80, 2, 20, "#e8dec9");
    rectangle(context, 250, 85, 25, 21, "#b97850");
    rectangle(context, 253, 89, 19, 3, "#d99a68");
    rectangle(context, 253, 96, 3, 7, "#986044");
    rectangle(context, 302, 70, 18, 30, "#789c73");
    rectangle(context, 305, 66, 11, 6, "#a4bd7d");
    rectangle(context, 306, 74, 3, 20, "#d3d8b0");

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
    for (let x = 8; x < WIDTH; x += 64) {
      rectangle(context, x, 350, 2, 48, "rgba(151, 105, 70, .12)");
      rectangle(context, x + 22, 370, 2, 2, "rgba(151, 105, 70, .28)");
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
    rectangle(context, x + 23, y + 66, 8, 3, "#fff9ec");
    rectangle(context, x + 48, y + 66, 7, 3, "#dfc7a6");
    rectangle(context, x + 4, y + 78, 70, 9, dark);
    rectangle(context, x + 10, y + 82, 58, 18, "#c67d50");
    rectangle(context, x + 15, y + 85, 48, 11, "#e5aa6b");
    rectangle(context, x + 20, y + 90, 38, 3, dark);
    rectangle(context, x + 10, y + 98, 58, 6, dark);
    rectangle(context, x + 12, y + 83, 4, 12, "#e4a16d");
    rectangle(context, x + 59, y + 84, 5, 11, "#ad6848");
    rectangle(context, x + 19, y + 86, 4, 2, "#f2c184");
    rectangle(context, x + 54, y + 89, 5, 2, "#f2c184");
    rectangle(context, x + 27, y + 40, 2, 2, "#fff6e2");
    rectangle(context, x + 48, y + 40, 2, 2, "#fff6e2");
    rectangle(context, x + 23, y + 49, 5, 2, "#efb29f");
    rectangle(context, x + 51, y + 49, 5, 2, "#efb29f");
    rectangle(context, x + 38, y + 48, 2, 2, "#f3a5a1");
    rectangle(context, x + 40, y + 54, 2, 3, "#fff0d6");
    rectangle(context, x + 19, y + 51, 7, 1, "#fff2d6");
    rectangle(context, x + 54, y + 51, 7, 1, "#fff2d6");
    rectangle(context, x + 28, y + 17, 7, 2, "#fffdf3");
    rectangle(context, x + 51, y + 17, 7, 2, "#e7d8bd");
    rectangle(context, x + 33, y + 5, 16, 2, "#fffdf3");
  }

  function drawBasket(context, x, y) {
    rectangle(context, x + 5, y, 56, 5, "#684536");
    rectangle(context, x, y + 5, 66, 27, "#684536");
    rectangle(context, x + 5, y + 10, 56, 17, "#d18b51");
    rectangle(context, x + 7, y + 11, 52, 2, "#e2a261");
    rectangle(context, x + 14, y + 10, 5, 17, "#8b583e");
    rectangle(context, x + 29, y + 10, 5, 17, "#8b583e");
    rectangle(context, x + 44, y + 10, 5, 17, "#8b583e");
    rectangle(context, x + 15, y + 13, 2, 11, "#b97746");
    rectangle(context, x + 30, y + 13, 2, 11, "#b97746");
    rectangle(context, x + 45, y + 13, 2, 11, "#b97746");
    rectangle(context, x + 6, y + 27, 55, 5, "#684536");
    rectangle(context, x + 8, y + 28, 51, 2, "#ad7048");
  }

  function drawScene(context, objects, basketX, timeLeft, impactTime) {
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
      const objectWidth = object.width || ITEM_SIZE;
      rectangle(context, object.x + 8, object.y + ITEM_SIZE - 4, objectWidth - 16, 4, "rgba(91, 67, 55, .16)");
      drawItem(context, object.type, object.x, object.y, true);
    });

    drawBasket(context, basketX - 33, 330);
    if (timeLeft <= 10 && Math.floor(timeLeft * 6) % 2 === 0) {
      rectangle(context, 12, 12, 7, 7, "#f5c76d");
      rectangle(context, 24, 21, 4, 4, "#fff6df");
    }
    if (impactTime > 0) {
      context.fillStyle = `rgba(211, 76, 65, ${Math.min(.3, impactTime * .75)})`;
      context.fillRect(0, 0, WIDTH, HEIGHT);
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
    let sharedInventory = {};
    let roundInventory = {};
    let animationId = 0;
    let canvas;
    let context;
    let callbacks;
    let lastSpawnedType = "";
    let lastSpawn = null;
    let spawnHistory = [];
    let feedback = "";
    let feedbackTime = 0;
    let impactTime = 0;

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

    function getSpawnX(type, width) {
      const minX = 10;
      const maxX = WIDTH - width - 10;
      const oppositeDrops = spawnHistory.filter(drop =>
        elapsed - drop.time <= POOP_SEPARATION_SECONDS &&
        (type === "trouble") !== (drop.type === "trouble")
      );
      if (lastSpawn &&
        (type === "trouble") !== (lastSpawn.type === "trouble") &&
        !oppositeDrops.includes(lastSpawn)) {
        oppositeDrops.push(lastSpawn);
      }
      if (oppositeDrops.length === 0) {
        return minX + Math.random() * (maxX - minX);
      }

      const safePositions = [];
      for (let x = minX; x <= maxX; x += 1) {
        const centerX = x + width / 2;
        if (oppositeDrops.every(drop => Math.abs(centerX - drop.centerX) >= BASKET_WIDTH)) {
          safePositions.push(x);
        }
      }
      return safePositions[Math.floor(Math.random() * safePositions.length)];
    }

    function spawnObject() {
      const isStandalonePoop = lastSpawnedType !== "trouble" &&
        Math.random() < STANDALONE_POOP_CHANCE_AFTER_OTHER_DROP;
      let type;
      if (isStandalonePoop) {
        type = "trouble";
      } else {
        type = INGREDIENT_IDS[Math.floor(Math.random() * INGREDIENT_IDS.length)];
        if (type === lastSpawnedType && Math.random() < 0.65) {
          type = INGREDIENT_IDS[
            (INGREDIENT_IDS.indexOf(type) + 1 + Math.floor(Math.random() * (INGREDIENT_IDS.length - 1))) % INGREDIENT_IDS.length
          ];
        }
      }
      lastSpawnedType = type;
      const width = ITEM_SIZE;
      const baseSpeed = type === "trouble"
        ? 175 + Math.random() * 20 + elapsed * .7
        : FALL_SPEEDS[type][0] + Math.random() * (FALL_SPEEDS[type][1] - FALL_SPEEDS[type][0]) + elapsed * .7;
      const speed = baseSpeed * 1.25 * (type === "trouble" ? 1 : INGREDIENT_SPEED_MULT);
      spawnHistory = spawnHistory.filter(drop => elapsed - drop.time <= POOP_SEPARATION_SECONDS);
      const x = getSpawnX(type, width);
      lastSpawn = { type, centerX: x + width / 2, time: elapsed };
      spawnHistory.push(lastSpawn);
      objects.push({
        type,
        width,
        x,
        y: -ITEM_SIZE - 5,
        speed
      });
    }

    function catchObject(object) {
      if (object.type === "trouble") {
        resetRoundForDung();
      } else {
        roundInventory[object.type] += 1;
      }
    }

    function resetRoundForDung() {
      roundInventory = Object.fromEntries(INGREDIENT_IDS.map(id => [id, 0]));
      feedback = "앗, 똥! 이번 판 재료가 초기화됐어요.";
      feedbackTime = 1.1;
      impactTime = .28;
    }

    function update(delta) {
      elapsed += delta;
      const timeLeft = Math.max(0, DURATION - elapsed);
      feedbackTime = Math.max(0, feedbackTime - delta);
      impactTime = Math.max(0, impactTime - delta);
      if (feedbackTime === 0) feedback = "";
      basketX = Math.max(38, Math.min(WIDTH - 38, basketX + direction * delta * 330));
      spawnIn -= delta;
      if (spawnIn <= 0) {
        spawnObject();
        spawnIn = Math.max(0.38, 0.78 - elapsed * 0.004) + Math.random() * 0.25;
      }

      objects.forEach(object => {
        object.y += object.speed * delta;
        const objectWidth = object.width || ITEM_SIZE;
        if (object.y + ITEM_SIZE - 5 >= 330 && object.y + ITEM_SIZE - 13 <= 362 &&
          object.x + objectWidth - 6 >= basketX - 29 && object.x + 6 <= basketX + 29) {
          object.caught = true;
          catchObject(object);
        }
      });
      objects = objects.filter(object => !object.caught && object.y < HEIGHT + 10);
      callbacks.onUpdate(sharedInventory, roundInventory, timeLeft, feedback);
      return timeLeft;
    }

    function loop(timestamp) {
      if (!running || document.hidden) return;
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.05);
      lastTimestamp = timestamp;
      const timeLeft = update(delta);
      drawScene(context, objects, basketX, timeLeft, impactTime);
      if (timeLeft <= 0) {
        finishRound("timeout");
        return;
      }
      animationId = requestAnimationFrame(loop);
    }

    function finishRound(reason) {
      if (!running) return;
      running = false;
      cancelAnimationFrame(animationId);
      unbind();
      const transferred = { ...roundInventory };
      INGREDIENT_IDS.forEach(id => {
        sharedInventory[id] = (sharedInventory[id] || 0) + transferred[id];
      });
      roundInventory = Object.fromEntries(INGREDIENT_IDS.map(id => [id, 0]));
      if (callbacks.onInventoryChange) callbacks.onInventoryChange({ ...sharedInventory });
      callbacks.onUpdate(sharedInventory, roundInventory, Math.max(0, DURATION - elapsed), "");
      callbacks.onComplete({ ...sharedInventory }, transferred, reason);
    }

    function start(options) {
      canvas = options.canvas;
      context = canvas.getContext("2d");
      context.imageSmoothingEnabled = false;
      callbacks = options;
      sharedInventory = { ...options.inventory };
      roundInventory = Object.fromEntries(INGREDIENT_IDS.map(id => [id, 0]));
      objects = [];
      elapsed = 0;
      spawnIn = 0.25;
      basketX = WIDTH / 2;
      direction = 0;
      pointerActive = false;
      lastTimestamp = 0;
      lastSpawnedType = "";
      lastSpawn = null;
      spawnHistory = [];
      feedback = "";
      feedbackTime = 0;
      impactTime = 0;
      running = true;
      bind();
      callbacks.onUpdate(sharedInventory, roundInventory, DURATION, "");
      animationId = requestAnimationFrame(loop);

      return {
        setDirection(value) {
          direction = Math.max(-1, Math.min(1, value));
        },
        takeAway() {
          finishRound("take-away");
        },
        discard() {
          if (!running) return;
          running = false;
          cancelAnimationFrame(animationId);
          unbind();
        },
        stop() {
          finishRound("navigate");
        }
      };
    }

    return { start };
  }

  installIngredientIcons();
  window.MeowStages = window.MeowStages || {};
  window.MeowStages.stage1 = createStage();
})();
