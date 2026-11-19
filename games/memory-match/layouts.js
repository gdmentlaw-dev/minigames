'use strict';

// Coordinates are measured in board units. A card is 100 by 120 units.
const CARD_WIDTH = 100;
const CARD_HEIGHT = 120;
const BOARD_MARGIN = 12;

// Each entry is [x, y, layer], measured from the top-left of its pile.
const PILES = {
  shallow: [
    [0, 0, 0], [112, 5, 0], [224, 0, 0], [336, 5, 0],
    [14, 132, 0], [126, 137, 0], [238, 132, 0], [350, 137, 0],
    [54, 46, 1], [167, 38, 1], [280, 10, 1],
    [8, 179, 1], [121, 170, 1], [234, 179, 1], [350, 137, 1],
  ],
  terrace: [
    [16, 0, 0], [124, 9, 0], [232, 0, 0], [340, 9, 0],
    [0, 136, 0], [110, 129, 0], [220, 136, 0], [330, 129, 0],
    [65, 40, 1], [180, 48, 1], [295, 42, 1],
    [44, 177, 1], [159, 174, 1], [274, 177, 1],
    [118, 92, 2], [234, 85, 2], [95, 221, 2], [210, 214, 2],
  ],
  cross: [
    [120, 0, 0],
    [0, 130, 0], [112, 132, 0], [224, 130, 0],
    [0, 262, 0], [112, 264, 0], [224, 262, 0],
    [0, 394, 0], [112, 396, 0], [224, 394, 0],
    [120, 528, 0],
    [62, 54, 1], [174, 56, 1],
    [5, 186, 1], [117, 188, 1], [230, 186, 1],
    [15, 316, 1], [127, 318, 1], [240, 316, 1], [121, 449, 1],
    [118, 108, 2], [230, 110, 2], [56, 245, 2], [168, 247, 2], [113, 379, 2],
    [147, 171, 3], [78, 312, 3],
  ],
  stair: [
    [0, 0, 0], [111, 0, 0], [222, 0, 0],
    [54, 130, 0], [165, 130, 0], [276, 130, 0],
    [150, 260, 0], [261, 260, 0], [236, 390, 0], [347, 390, 0],
    [56, 58, 1], [169, 58, 1], [109, 188, 1], [222, 188, 1],
    [208, 318, 1], [321, 318, 1], [270, 448, 1],
    [106, 102, 2], [218, 103, 2], [171, 234, 2], [283, 234, 2], [265, 365, 2],
    [160, 159, 3], [276, 294, 3],
  ],
  core: [
    [40, 10, 0], [150, 10, 0], [260, 10, 0], [370, 10, 0],
    [0, 142, 0], [110, 142, 0], [220, 142, 0], [330, 142, 0],
    [20, 274, 0], [130, 274, 0], [240, 274, 0], [350, 274, 0],
    [70, 406, 0], [180, 406, 0], [290, 406, 0],
    [28, 52, 1], [140, 52, 1], [252, 52, 1], [364, 52, 1],
    [34, 184, 1], [146, 184, 1], [258, 184, 1], [370, 184, 1],
    [0, 316, 1], [112, 316, 1], [224, 316, 1], [336, 316, 1],
    [88, 96, 2], [201, 96, 2], [314, 96, 2],
    [58, 229, 2], [171, 229, 2], [284, 229, 2], [117, 362, 2], [230, 362, 2],
    [124, 143, 3], [244, 143, 3], [97, 276, 3], [217, 276, 3],
  ],
  crown: [
    [154, 98, 4], [266, 98, 4], [101, 228, 4], [213, 228, 4],
    [156, 359, 4], [268, 359, 4],
  ],
  islands: [
    [0, 0, 0], [24, 162, 0], [0, 315, 0],
  ],
  canopy: [
    [35, 29, 0], [149, 37, 0], [267, 28, 0],
    [71, 157, 0], [185, 165, 0], [299, 156, 0],
    [100, 287, 0], [214, 293, 0], [328, 284, 0],
  ],
  pocket: [
    [0, 6, 0], [110, 0, 0], [220, 7, 0], [55, 134, 0], [168, 137, 0],
    [2, 48, 1], [114, 58, 1], [231, 54, 1], [151, 190, 1],
  ],
};

// Each entry is [pile, offset x, offset y]. The first six stages grow from 51 to 96 cards.
const STAGE_LAYOUTS = [
  [['stair', -470, 0], ['terrace', 31, 98], ['pocket', -161, 642]],
  [['cross', 90, 0], ['terrace', -467, 14], ['shallow', -444, 439]],
  [['stair', -480, 0], ['stair', 20, 112], ['terrace', -452, 632], ['islands', 260, 741]],
  [['core', -232, 0], ['stair', 19, 590], ['shallow', -477, 648]],
  [['core', -244, 5], ['crown', -244, 5], ['stair', -477, 550], ['terrace', 32, 700]],
  [['core', -460, 141], ['crown', -460, 141], ['core', 40, 60],
    ['islands', -466, 724], ['islands', -205, 684], ['islands', 70, 736], ['islands', 339, 650]],
];

// Stages 7–20 add nine-card layers to the major piles of the denser maps.
// Each entry is [base stage, added layers per major pile, from left to right in the definition].
const STACK_PLANS = [
  [4, [1, 1, 1]], [5, [1, 1, 1]], [5, [2, 1, 1]], [6, [2, 2]],
  [4, [3, 2, 2]], [5, [3, 2, 2]], [5, [3, 3, 2]], [6, [4, 4]],
  [4, [5, 3, 3]], [5, [4, 4, 3]], [5, [5, 3, 4]], [4, [6, 4, 4]],
  [5, [6, 4, 4]], [6, [7, 7]],
];
const MAX_STAGE = STAGE_LAYOUTS.length + STACK_PLANS.length;

function createStageLayout(stage) {
  const [baseStage, stacks] = STACK_PLANS[stage - STAGE_LAYOUTS.length - 1] ?? [stage];
  const layout = STAGE_LAYOUTS[baseStage - 1];
  const positions = [];

  function addPile(name, offsetX, offsetY, layerOffset = 0) {
    for (const [x, y, layer] of PILES[name]) {
      positions.push({ id: positions.length, x: x + offsetX, y: y + offsetY, layer: layer + layerOffset });
    }
  }

  for (const [name, x, y] of layout) addPile(name, x, y);
  if (stacks) {
    const firstNewLayer = Math.max(...positions.map(card => card.layer)) + 1;
    const majorPiles = layout.filter(([name]) => name !== 'crown' && name !== 'islands');
    majorPiles.forEach(([, x, y], index) => {
      for (let depth = 0; depth < stacks[index]; depth++) {
        const offsetX = depth % 2 === 0 ? -16 : 16;
        const offsetY = depth % 3 * 22;
        addPile('canopy', x + offsetX, y + offsetY, firstNewLayer + depth);
      }
    });
  }

  const left = Math.min(...positions.map(card => card.x)) - BOARD_MARGIN;
  const top = Math.min(...positions.map(card => card.y)) - BOARD_MARGIN;
  const width = Math.max(...positions.map(card => card.x + CARD_WIDTH)) - left + BOARD_MARGIN;
  const height = Math.max(...positions.map(card => card.y + CARD_HEIGHT)) - top + BOARD_MARGIN;
  for (const card of positions) {
    card.x -= left;
    card.y -= top;
  }
  return { positions, width, height };
}
