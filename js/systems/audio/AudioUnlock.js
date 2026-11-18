/**
 * AUDIO UNLOCK
 * Trình duyệt chỉ cho phát tiếng sau khi người chơi bấm/chạm lần đầu.
 * Module này đăng ký bắt cử chỉ đầu tiên rồi gọi callback một lần.
 */

const EVENTS = ["pointerdown", "keydown", "touchstart"];

export function onFirstGesture(callback, target = globalThis.window) {
  if (!target?.addEventListener) return () => {};

  let done = false;

  const handler = () => {
    if (done) return;

    done = true;
    remove();
    callback();
  };

  const remove = () =>
    EVENTS.forEach(name => target.removeEventListener(name, handler, true));

  EVENTS.forEach(name => target.addEventListener(name, handler, true));

  return remove;
}
