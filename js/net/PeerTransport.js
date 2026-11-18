
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
const CONNECT_TIMEOUT_MS = 15000;

const ERROR_TEXT = {
  "peer-unavailable": "Không tìm thấy phòng với mã này.",
  "unavailable-id": "Mã phòng đã bị trùng, hãy tạo lại.",
  "network": "Không kết nối được tới máy chủ trung gian của PeerJS.",
  "server-error": "Máy chủ trung gian của PeerJS đang lỗi.",
  "socket-error": "Mất kết nối tới máy chủ trung gian của PeerJS.",
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
  constructor({ PeerClass = globalThis.Peer, config } = {}) {
    this.PeerClass = PeerClass;
    this.config = config;
    this.peer = null;
    this.onConnection = null;
    this.onError = null;
  }

  ensureLibrary() {
    if (!this.PeerClass) {
      throw new Error("Chưa nạp được thư viện PeerJS (kiểm tra mạng).");
    }
  }

  listen(code) {
    this.ensureLibrary();

    return new Promise((resolve, reject) => {
      const peer = new this.PeerClass(PREFIX + code, this.config);

      this.peer = peer;

      peer.on("open", () => resolve());
      peer.on("error", error => {
        const message = describe(error);

        reject(new Error(message));
        this.onError?.(message);
      });

      peer.on("connection", dataConnection => {
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
      const peer = new this.PeerClass(this.config);

      this.peer = peer;

      let finished = false;

      const fail = message => {
        if (finished) return;

        finished = true;
        clearTimeout(timer);
        peer.destroy();
        reject(new Error(message));
      };

      const timer = setTimeout(
        () => fail("Hết thời gian chờ. Mạng của bạn hoặc của GM có thể đang chặn kết nối trực tiếp."),
        CONNECT_TIMEOUT_MS
      );

      peer.on("error", error => fail(describe(error)));

      peer.on("open", () => {
        const dataConnection = peer.connect(PREFIX + code, {
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
