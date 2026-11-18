
/**
 * MEMORY TRANSPORT
 * Mạng giả trong bộ nhớ, cùng giao diện với PeerTransport.
 * Dùng để test HostSession/ClientSession mà không cần mạng thật.
 */

export function createMemoryNetwork() {
  const hosts = new Map();

  const pair = () => {
    const make = () => ({
      id: Math.random().toString(36).slice(2),
      onMessage: null,
      onClose: null,
      closed: false,
      other: null,
      send(message) {
        const target = this.other;

        if (this.closed || target.closed) return;

        const copy = JSON.parse(JSON.stringify(message));

        queueMicrotask(() => target.onMessage?.(copy));
      },
      close() {
        if (this.closed) return;

        this.closed = true;

        const target = this.other;

        // Như WebRTC thật: đóng kết nối thì cả hai đầu đều nhận sự kiện close.
        queueMicrotask(() => {
          this.onClose?.();

          if (!target.closed) {
            target.closed = true;
            target.onClose?.();
          }
        });
      }
    });

    const a = make();
    const b = make();

    a.other = b;
    b.other = a;

    return [a, b];
  };

  return {
    createHostTransport() {
      const transport = {
        onConnection: null,
        async listen(code) {
          hosts.set(code, transport);
        }
      };

      return transport;
    },

    createClientTransport() {
      return {
        async connect(code) {
          const host = hosts.get(code);

          if (!host) throw new Error("Không tìm thấy phòng với mã này.");

          const [clientSide, hostSide] = pair();

          host.onConnection?.(hostSide);

          return clientSide;
        }
      };
    }
  };
}
