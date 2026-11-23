/**
 * TEARRING UNITS
 * Unit chiến đấu chạy bằng engine port từ bản decomp (js/tearring/).
 * Dữ liệu gốc do tools/tearring_extract.py trích ra assets/tearring/BU<nnn>.pak.
 *
 * Muốn thêm nhân vật: chạy tearring_extract.py --units <số>, thêm mục vào đây,
 * rồi gán  trUnit: "BU<nnn>"  cho unit trong data/units.js (cả hai bên giao chiến
 * đều phải có trUnit thì BattleScene mới dùng engine này, nếu không sẽ dùng sheet cũ).
 *
 *   facing : hướng nhìn của ảnh gốc ("left" | "right"); engine tự lật bằng cờ flip của game
 *   shadow : vẽ bóng đổ (dùng dữ liệu bóng trong BSET.DDD của unit)
 */
export const TEARRING_ROOT = "./assets/tearring/";

export const TEARRING_UNITS = {
  BU004: { facing: "right", shadow: true },
  BU030: { facing: "right", shadow: true },
  BU052: { facing: "left", shadow: true }
};

// Số motion = nhóm * 11 + khe (M<g>_<k>.D)
export const MOTION = {
  idle: 0,      // M0_0
  move: 1,      // M0_1  phi/chạy
  dodge: 4,     // M0_4  né
  attack: 11,   // M1_0  đòn mở đầu
  attack2: 12,  // M1_1  đòn tiếp theo
  crit: 19      // M1_8  chí mạng
};
