import {
  GAME_WIDTH,
  GAME_HEIGHT
} from "./config.js";

import { BattleScene } from "./scenes/BattleScene.js";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: "game-container",
  backgroundColor: "#22223b",
  pixelArt: true,

  render: {
    antialias: false,
    roundPixels: true
  },

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },

  scene: [BattleScene]
});

window.fe8Game = game;
