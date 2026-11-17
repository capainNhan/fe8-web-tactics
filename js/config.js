
/**
 * CẤU HÌNH KÍCH THƯỚC
 * UI_SCALE là hệ số phóng to toàn bộ giao diện (map + battle).
 * Muốn giao diện to/nhỏ hơn: đổi UI_SCALE (1 = bản gốc 384px, 2 = 768px, 3 = 1152px).
 * Mọi kích thước giao diện trên map đi qua px() để tự co giãn theo.
 */

export const UI_SCALE = 2;

export const px = n => n * UI_SCALE;

export const TILE = px(48);
export const GRID = 8;

export const GAME_WIDTH = TILE * GRID;
export const GAME_HEIGHT = TILE * GRID;
