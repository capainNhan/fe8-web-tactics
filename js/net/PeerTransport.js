
/**
 * PEER TRANSPORT
 * Lớp nối mạng dùng PeerJS (WebRTC), miễn phí, không cần máy chủ riêng.
 * Chỉ file này biết về PeerJS; muốn đổi cách kết nối (Firebase, WebSocket...)
 * thì viết một transport khác có cùng giao diện:
 *
 *   host:   await transport.listen(code);  transport.onConnection = conn => {...}
 *   client: const conn = await transport.connect(code);
 *   conn:   { id, send(msg), close(), onMessage, onClose }
 *
 * Cần nạp thư viện PeerJS (biến toàn cục `Peer`) trước khi dùng.
 */

const PREFIX = "fe8tac-";
const CONNECT_TIMEOUT_MS = 20000;

/**
 * Danh sách máy chủ hỗ trợ vượt NAT.
 *  - STUN: giúp hai máy biết địa chỉ công khai của nhau (miễn phí, Google).
 *  - TURN: chuyển tiếp dữ liệu khi kết nối trực tiếp bị chặn (thường là 4G).
 * Các máy chủ TURN công cộng miễn phí có thể ngừng hoạt động hoặc quá tải bất cứ lúc nào.
 * Có thể thêm máy chủ của riêng bạn qua tham số `extraIceServers`.
 */
export const DEFAULT_ICE_SERVERS = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  {
    urls: ["turn:eu-0.turn.peerjs.com:3478", "turn:us-0.turn.peerjs.com:3478"],
    username: "peerjs",
    credential: "peerjsp"
  },
  {
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turn:openrelay.metered.ca:443?transport=tcp"
    ],
    username: "openrelayproject",
    credential: "openrelayproject"
  }
];

const ERROR_TEXT = {
  "peer-unavailable": "Không tìm thấy phòng với mã này (GM đã tạo phòng và còn mở trang chưa?).",
  "unavailable-id": "Mã phòng đã bị trùng, hãy tạo lại.",
  "network": "Không kết nối được tới máy chủ trung gian của PeerJS.",
  "server-error": "Máy chủ trung gian của PeerJS đang lỗi.",
  "socket-error": "Mất kết nối tới máy chủ trung gian của PeerJS.",
  "socket-closed": "Máy chủ trung gian của PeerJS đã đóng kết nối.",
  "browser-incompatible": "Trình duyệt này không hỗ trợ kết nối trực tiếp (WebRTC)."
};

function describe(error) {
  return ERROR_TEXT[error?.type] ?? `Lỗi kết nối: ${error?.type ?? error?.message ?? error}`;
}

function wrap(dataConnection) {
  const conn = {
    id: dataConnection.peer,
    onMessage: null,
    onClose: null,
    send: message => dataConnection.send(message),
    close: () => dataConnection.close()
  };

  dataConnection.on("data", data => conn.onMessage?.(data));
  dataConnection.on("close", () => conn.onClose?.());
  dataConnection.on("error", () => conn.onClose?.());

  return conn;
}

export class PeerTransport {
  constructor({
    PeerClass = globalThis.Peer,
    extraIceServers = [],
    onStage = null
  } = {}) {
    this.PeerClass = PeerClass;
    this.iceServers = [...DEFAULT_ICE_SERVERS, ...extraIceServers];
    this.onStage = onStage; // (text) => void, báo tiến trình để hiện lên màn hình

    this.peer = null;
    this.onConnection = null;
    this.onError = null;
  }

  ensureLibrary() {
    if (!this.PeerClass) {
      throw new Error("Chưa nạp được thư viện PeerJS (kiểm tra mạng).");
    }
  }

  stage(text) {
    this.onStage?.(text);
  }

  options() {
    return { config: { iceServers: this.iceServers } };
  }

  listen(code) {
    this.ensureLibrary();

    return new Promise((resolve, reject) => {
      this.stage("Đang kết nối máy chủ trung gian PeerJS...");

      const peer = new this.PeerClass(PREFIX + code, this.options());

      this.peer = peer;

      const timer = setTimeout(
        () => reject(new Error("Không nối được máy chủ trung gian PeerJS. Mạng có thể đang chặn, hoặc máy chủ miễn phí đang quá tải.")),
        CONNECT_TIMEOUT_MS
      );

      peer.on("open", () => {
        clearTimeout(timer);
        resolve();
      });

      peer.on("error", error => {
        clearTimeout(timer);

        const message = describe(error);

        reject(new Error(message));
        this.onError?.(message);
      });

      peer.on("connection", dataConnection => {
        this.stage("Có người đang kết nối...");
        this.onConnection?.(wrap(dataConnection));
      });

      // Mất liên lạc với máy chủ trung gian: nối lại, các kết nối đang có vẫn giữ.
      peer.on("disconnected", () => {
        try {
          peer.reconnect();
        } catch {
          // bỏ qua
        }
      });
    });
  }

  connect(code) {
    this.ensureLibrary();

    return new Promise((resolve, reject) => {
      let finished = false;
      let step = "signaling";
      let dataConnection = null;

      this.stage("Bước 1/2: nối máy chủ trung gian PeerJS...");

      const peer = new this.PeerClass(undefined, this.options());

      this.peer = peer;

      const fail = message => {
        if (finished) return;

        finished = true;
        clearTimeout(timer);
        peer.destroy();
        reject(new Error(message));
      };

      const timer = setTimeout(() => {
        if (step === "signaling") {
          fail("Bước 1 thất bại: không nối được máy chủ trung gian PeerJS. Mạng có thể đang chặn, hoặc máy chủ miễn phí đang quá tải. Thử đổi mạng, hoặc bấm Chẩn đoán mạng.");
          return;
        }

        const state = dataConnection?.peerConnection?.iceConnectionState ?? "không rõ";

        fail(`Bước 2 thất bại: đã tìm thấy phòng nhưng không thiết lập được đường truyền với máy GM (trạng thái ICE: ${state}). Thường do NAT hoặc mạng 4G chặn kết nối trực tiếp, và máy chủ chuyển tiếp (TURN) miễn phí không dùng được. Hãy bấm Chẩn đoán mạng.`);
      }, CONNECT_TIMEOUT_MS);

      peer.on("error", error => fail(describe(error)));

      peer.on("open", () => {
        step = "ice";
        this.stage("Bước 2/2: đang tìm máy GM và thiết lập đường truyền...");

        dataConnection = peer.connect(PREFIX + code, {
          reliable: true,
          serialization: "json"
        });

        dataConnection.on("open", () => {
          if (finished) return;

          finished = true;
          clearTimeout(timer);
          resolve(wrap(dataConnection));
        });
      });
    });
  }

  close() {
    this.peer?.destroy();
    this.peer = null;
  }
}
