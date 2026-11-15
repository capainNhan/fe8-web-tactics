const TILE_SIZE = 48;
const GRID_SIZE = 8;

const unitsData = [
  {
    id: 'player1', name: 'Kiếm Sĩ', team: 'player', x: 1, y: 3, color: 0x3498db,
    hp: 24, maxHp: 24, str: 9, skl: 12, spd: 13, lck: 6, def: 5, con: 8, mov: 5,
    weapon: { name: 'Iron Sword', type: 'sword', mt: 5, hit: 90, crit: 0, wt: 5, range: 1 }
  },
  {
    id: 'enemy1', name: 'Lính Đánh Thuê', team: 'enemy', x: 5, y: 3, color: 0xe74c3c,
    hp: 26, maxHp: 26, str: 10, skl: 8, spd: 8, lck: 3, def: 6, con: 10, mov: 5,
    weapon: { name: 'Steel Blade', type: 'sword', mt: 11, hit: 70, crit: 0, wt: 12, range: 1 }
  }
];

let selectedUnit = null;
let moveTiles = [];

function logMsg(text) {
  const box = document.getElementById('log-box');
  box.innerHTML += `<br>> ${text}`;
  box.scrollTop = box.scrollHeight;
}

class BattleScene extends Phaser.Scene {
  constructor() { super('BattleScene'); }

  create() {
    this.graphics = this.add.graphics();
    this.drawGrid();

    unitsData.forEach(u => {
      const container = this.add.container(u.x * TILE_SIZE + TILE_SIZE / 2, u.y * TILE_SIZE + TILE_SIZE / 2);
      const circle = this.add.circle(0, 0, 18, u.color);
      const label = this.add.text(-12, -8, u.team === 'player' ? 'P1' : 'E1', { fontSize: '14px', fill: '#fff' });
      container.add([circle, label]);
      u.sprite = container;
    });

    this.input.on('pointerdown', (pointer) => {
      const gx = Math.floor(pointer.x / TILE_SIZE);
      const gy = Math.floor(pointer.y / TILE_SIZE);
      if (gx >= 0 && gx < GRID_SIZE && gy >= 0 && gy < GRID_SIZE) {
        this.handleTileClick(gx, gy);
      }
    });
  }

  drawGrid() {
    this.graphics.clear();
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        this.graphics.lineStyle(1, 0x33334d, 1);
        this.graphics.fillStyle((x + y) % 2 === 0 ? 0x22223b : 0x2a2a4a, 1);
        this.graphics.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        this.graphics.strokeRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }

    moveTiles.forEach(t => {
      this.graphics.fillStyle(0x2ecc71, 0.35);
      this.graphics.fillRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });
  }

  handleTileClick(gx, gy) {
    const clickedUnit = unitsData.find(u => u.x === gx && u.y === gy && u.hp > 0);

    if (clickedUnit && clickedUnit.team === 'player') {
      selectedUnit = clickedUnit;
      this.calcMoveRange(selectedUnit);
      this.drawGrid();
      logMsg(`Đã chọn ${selectedUnit.name} (HP: ${selectedUnit.hp}/${selectedUnit.maxHp})`);
      return;
    }

    if (selectedUnit) {
      if (clickedUnit && clickedUnit.team === 'enemy') {
        const dist = Math.abs(selectedUnit.x - clickedUnit.x) + Math.abs(selectedUnit.y - clickedUnit.y);
        if (dist === 1) {
          this.executeCombat(selectedUnit, clickedUnit);
          selectedUnit = null;
          moveTiles = [];
          this.drawGrid();
          return;
        }
      }

      if (moveTiles.some(t => t.x === gx && t.y === gy) && !clickedUnit) {
        selectedUnit.x = gx;
        selectedUnit.y = gy;
        this.tweens.add({
          targets: selectedUnit.sprite,
          x: gx * TILE_SIZE + TILE_SIZE / 2,
          y: gy * TILE_SIZE + TILE_SIZE / 2,
          duration: 200
        });
        logMsg(`${selectedUnit.name} di chuyển tới (${gx}, ${gy}). Bấm vào địch bên cạnh để đánh!`);
        this.calcMoveRange(selectedUnit);
        this.drawGrid();
      }
    }
  }

  calcMoveRange(unit) {
    moveTiles = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const dist = Math.abs(unit.x - x) + Math.abs(unit.y - y);
        if (dist <= unit.mov) moveTiles.push({ x, y });
      }
    }
  }

  executeCombat(att, def) {
    const preview = calculateBattlePreview(att, def);
    logMsg(`--- GIAO TRANH: ${att.name} vs ${def.name} ---`);
    logMsg(`${att.name}: Dmg ${preview.attacker.dmg} | Hit ${preview.attacker.hit}% | Crit ${preview.attacker.crit}% ${preview.attacker.double ? '(x2)' : ''}`);

    this.performStrike(att, def, preview.attacker);

    if (def.hp > 0) {
      this.performStrike(def, att, preview.defender);
    }

    if (att.hp > 0 && def.hp > 0 && preview.attacker.double) {
      logMsg(`${att.name} tốc độ vượt trội, tung đòn thứ 2!`);
      this.performStrike(att, def, preview.attacker);
    }
  }

  performStrike(att, def, stats) {
    if (roll2RN(stats.hit)) {
      const isCrit = (Math.random() * 100) < stats.crit;
      const finalDmg = isCrit ? stats.dmg * 3 : stats.dmg;
      def.hp = Math.max(0, def.hp - finalDmg);
      logMsg(`💥 ${att.name} đánh trúng${isCrit ? ' CHÍ MẠNG' : ''}! ${def.name} mất ${finalDmg} HP (Còn ${def.hp}/${def.maxHp})`);
      if (def.hp === 0) {
        logMsg(`💀 ${def.name} đã bị hạ gục!`);
        def.sprite.setVisible(false);
      }
    } else {
      logMsg(`💨 ${att.name} đánh trượt!`);
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  width: TILE_SIZE * GRID_SIZE,
  height: TILE_SIZE * GRID_SIZE,
  parent: 'game-container',
  pixelArt: true,
  scene: BattleScene
});
