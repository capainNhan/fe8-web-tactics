
import { DEFAULT_ICE_SERVERS } from "./PeerTransport.js";

/**
 * DIAGNOSE
 * Kiểm tra mạng của máy này có đủ điều kiện chơi online qua PeerJS không.
 * report(text, level) với level: "ok" | "bad" | "warn" | "".
 */

function gatherCandidates(iceServers, ms = 7000) {
  return new Promise(resolve => {
    const types = {};
    let pc;

    const done = () => {
      clearTimeout(timer);
      try { pc.close(); } catch { /* bỏ qua */ }
      resolve(types);
    };

    const timer = setTimeout(done, ms);

    try {
      pc = new RTCPeerConnection({ iceServers });
    } catch {
      clearTimeout(timer);
      resolve(null);
      return;
    }

    pc.createDataChannel("diag");

    pc.onicecandidate = event => {
      if (!event.candidate) {
        done();
        return;
      }

      const match = / typ (\w+)/.exec(event.candidate.candidate);
      const type = match ? match[1] : "khác";

      types[type] = (types[type] ?? 0) + 1;
    };

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(done);
  });
}

function checkSignaling(PeerClass, iceServers, ms = 10000) {
  return new Promise(resolve => {
    const started = performance.now();
    const peer = new PeerClass(undefined, { config: { iceServers } });

    const finish = result => {
      clearTimeout(timer);
      try { peer.destroy(); } catch { /* bỏ qua */ }
      resolve(result);
    };

    const timer = setTimeout(() => finish({ ok: false, reason: "quá thời gian chờ" }), ms);

    peer.on("open", () => finish({ ok: true, ms: Math.round(performance.now() - started) }));
    peer.on("error", error => finish({ ok: false, reason: error?.type ?? String(error) }));
  });
}

export async function runDiagnostics({
  PeerClass = globalThis.Peer,
  iceServers = DEFAULT_ICE_SERVERS,
  report
}) {
  report("Đang kiểm tra, mất khoảng 20 giây...", "warn");

  // 1. Thư viện
  if (!PeerClass) {
    report("1) Thư viện PeerJS: CHƯA NẠP ĐƯỢC. Mạng đang chặn jsDelivr, hoặc địa chỉ thư viện sai.", "bad");
    return;
  }

  report("1) Thư viện PeerJS: đã nạp.", "ok");

  // 2. Máy chủ trung gian
  const signaling = await checkSignaling(PeerClass, iceServers);

  if (signaling.ok) {
    report(`2) Máy chủ trung gian PeerJS: kết nối được (${signaling.ms} ms).`, "ok");
  } else {
    report(`2) Máy chủ trung gian PeerJS: KHÔNG kết nối được (${signaling.reason}). Mạng chặn hoặc máy chủ miễn phí đang lỗi. Thử đổi mạng.`, "bad");
  }

  // 3. WebRTC
  if (typeof RTCPeerConnection === "undefined") {
    report("3) WebRTC: trình duyệt không hỗ trợ.", "bad");
    return;
  }

  const stunOnly = iceServers.filter(s =>
    [].concat(s.urls).every(u => u.startsWith("stun:"))
  );

  const withStun = await gatherCandidates(stunOnly);

  if (!withStun) {
    report("3) WebRTC: không khởi tạo được.", "bad");
    return;
  }

  const hasPublic = (withStun.srflx ?? 0) > 0;

  report(
    hasPublic
      ? "3) STUN (biết địa chỉ công khai): hoạt động."
      : "3) STUN (biết địa chỉ công khai): KHÔNG hoạt động. Mạng chặn UDP, nên kết nối trực tiếp gần như chắc chắn thất bại.",
    hasPublic ? "ok" : "bad"
  );

  // 4. TURN
  const withTurn = await gatherCandidates(iceServers, 9000);
  const hasRelay = (withTurn?.relay ?? 0) > 0;

  report(
    hasRelay
      ? "4) TURN (máy chủ chuyển tiếp): dùng được. Đây là đường dự phòng khi kết nối trực tiếp bị chặn."
      : "4) TURN (máy chủ chuyển tiếp): KHÔNG dùng được (các máy chủ miễn phí có thể đã ngừng hoặc bị chặn).",
    hasRelay ? "ok" : "warn"
  );

  // Kết luận
  if (!signaling.ok) {
    report("Kết luận: máy này không tới được máy chủ trung gian, không thể tạo/vào phòng. Thử mạng khác.", "bad");
  } else if (hasPublic || hasRelay) {
    report("Kết luận: máy này đủ điều kiện. Nếu vẫn lỗi, nguyên nhân có thể nằm ở máy còn lại. Hãy chạy chẩn đoán trên cả hai máy.", "ok");
  } else {
    report("Kết luận: máy này không thể kết nối online qua PeerJS miễn phí. Cần đổi mạng hoặc dùng máy chủ TURN riêng.", "bad");
  }
}
