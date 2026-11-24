/**
 * TEARRING UNITS
 * Unit chiến đấu và token trên map đều chạy bằng engine port từ bản decomp (js/tearring/).
 * Dữ liệu gốc do tools/tearring_extract.py trích ra assets/tearring/BU<nnn>.pak (xem ADD_CHARACTER.md).
 *
 *   facing : hướng nhìn của ảnh gốc ("left" | "right"); engine tự lật bằng cờ của game
 *   shadow : vẽ bóng đổ (dữ liệu bóng trong BSET.DDD của unit)
 *   kind   : "mounted" (kỵ binh) | "foot" (bộ binh)
 *   weapon : vũ khí của đòn đánh thường (M1_0): "sword" | "lance" | "bow" | "magic"
 *   note   : ghi chú cho người chọn unit
 *
 * Mỗi số BU là một nhân vật x kiểu vũ khí.  Bản thường (vd BU016) có đòn đánh trơn; bản kế tiếp
 * (vd BU017) là đòn kỹ năng có hào quang xanh.
 */
export const TEARRING_ROOT = "./assets/tearring/";

export const TEARRING_UNITS = {
  // ---- Đang dùng trong data/units.js ----
  BU016: { facing: "left",  shadow: true, kind: "mounted", weapon: "sword", note: "ngựa trắng, tóc xanh" },
  BU038: { facing: "left",  shadow: true, kind: "mounted", weapon: "sword", note: "tóc xanh lục, ngựa trắng yên xanh" },
  BU002: { facing: "right", shadow: true, kind: "mounted", weapon: "sword", note: "ngựa nâu, áo tím" },
  BU051: { facing: "left",  shadow: true, kind: "mounted", weapon: "sword", note: "ngựa xám ô-liu" },
  BU061: { facing: "left",  shadow: true, kind: "mounted", weapon: "sword", note: "ngựa trắng yên xanh" },
  BU081: { facing: "left",  shadow: true, kind: "mounted", weapon: "sword", note: "ngựa trắng yên vàng" },

  // ---- Kho unit để dùng sau: bộ binh kiếm ----
  BU027: { facing: "right", shadow: true, kind: "foot", weapon: "sword", note: "tóc xanh, vệt chém" },
  BU048: { facing: "right", shadow: true, kind: "foot", weapon: "sword", note: "giáp xám, áo choàng" },
  BU058: { facing: "right", shadow: true, kind: "foot", weapon: "sword", note: "giáp xanh" },
  BU188: { facing: "right", shadow: true, kind: "foot", weapon: "sword", note: "nữ, áo xanh lục" },
  BU198: { facing: "right", shadow: true, kind: "foot", weapon: "sword", note: "nữ, tóc xanh nhạt" },
  BU201: { facing: "right", shadow: true, kind: "foot", weapon: "sword", note: "hiệp sĩ giáp đen, khiên" },
  BU204: { facing: "right", shadow: true, kind: "foot", weapon: "sword", note: "giáp nặng, khiên lớn" },
  BU207: { facing: "right", shadow: true, kind: "foot", weapon: "sword", note: "áo choàng xanh quý tộc" },
  BU224: { facing: "right", shadow: true, kind: "foot", weapon: "sword", note: "giáp xanh trắng" },
  BU230: { facing: "right", shadow: true, kind: "foot", weapon: "sword", note: "nữ tóc đỏ" },
  BU233: { facing: "right", shadow: true, kind: "foot", weapon: "sword", note: "tóc cam, giáp nhẹ" },

  // ---- Giáo ----
  BU212: { facing: "left",  shadow: true, kind: "foot",    weapon: "lance", note: "lính giáp ô-liu" },
  BU218: { facing: "left",  shadow: true, kind: "foot",    weapon: "lance", note: "hiệp sĩ đen" },
  BU171: { facing: "left",  shadow: true, kind: "mounted", weapon: "lance", note: "kỵ binh giáp đen" },
  BU172: { facing: "left",  shadow: true, kind: "mounted", weapon: "lance", note: "kỵ binh giáp đen" },

  // ---- Cung ----
  BU185: { facing: "right", shadow: true, kind: "foot", weapon: "bow", note: "cung thủ áo tím" },
  BU190: { facing: "right", shadow: true, kind: "foot", weapon: "bow", note: "cung thủ nữ áo xanh lục" },
  BU196: { facing: "right", shadow: true, kind: "foot", weapon: "bow", note: "cung thủ nữ áo xanh lục" },

  // ---- Đã dùng để kiểm chứng engine (đòn kỹ năng / phép) ----
  BU004: { facing: "right", shadow: true, kind: "mounted", weapon: "magic", note: "kỵ binh phép, hào quang xanh" },
  BU052: { facing: "left",  shadow: true, kind: "mounted", weapon: "sword", note: "bản kỹ năng của BU051 (hào quang)" },
  BU030: { facing: "right", shadow: true, kind: "foot",    weapon: "magic", note: "bộ binh tóc xanh, phép" }
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
