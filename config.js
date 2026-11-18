
/**
 * CẤU HÌNH KÍCH THƯỚC
 * UI_SCALE là hệ số phóng to toàn bộ giao diện (map + battle).
 * Muốn giao diện to/nhỏ hơn: đổi UI_SCALE (1 = bản gốc 384px, 2 = 768px, 3 = 1152px).
 * Mọi kích thước giao diện trên map đi qua px() để tự co giãn theo.
 */

import { ACTIVE_MAP } from "./data/maps/index.js";

export const UI_SCALE = 2;

export const px = n => n * UI_SCALE;

// Kích thước khung game cố định; TILE tự co theo kích thước bản đồ
// (bản đồ 8x8 -> ô 96px, 12x12 -> ô 64px). Xem data/maps/index.js.
export const GAME_WIDTH = px(384);
export const GAME_HEIGHT = px(384);

export const GRID = ACTIVE_MAP.width;

export const TILE = GAME_WIDTH / GRID;
