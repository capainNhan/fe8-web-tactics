
/**
 * GAME LOG
 * Ghi một dòng vào khung log dưới màn hình game (#log-box).
 * Dùng chung cho MapScene và BattleScene.
 */

export function log(message) {
  const box = document.getElementById("log-box");

  if (!box) return;

  box.append(
    document.createElement("br"),
    "> " + message
  );

  box.scrollTop = box.scrollHeight;
}
