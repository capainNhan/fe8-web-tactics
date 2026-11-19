
/**
 * OBJECTIVES (điều kiện thắng / thua)
 * Hiện tại: tiêu diệt toàn bộ đối phương. Muốn thêm mục tiêu khác
 * (chiếm pháo đài, sống sót N lượt...) thì thêm vào checkOutcome.
 *
 * Trả về null nếu ván chưa kết thúc, hoặc { winner, reason }.
 */
export function checkOutcome(state) {
  const alive = team =>
    state.units.some(u => u.team === team && u.hp > 0);

  if (!alive("enemy")) {
    return { winner: "player", reason: "Đã tiêu diệt toàn bộ quân địch." };
  }

  if (!alive("player")) {
    return { winner: "enemy", reason: "Toàn bộ quân ta đã gục ngã." };
  }

  return null;
}
