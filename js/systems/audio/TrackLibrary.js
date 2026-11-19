import { TRACKS } from "../../data/music.js";

/**
 * TRACK LIBRARY
 * Tải và giải mã file nhạc thành AudioBuffer, có nhớ đệm.
 * Thử lần lượt từng file trong track.files; không file nào dùng được -> trả null
 * (người gọi sẽ chuyển sang nhạc dự phòng). Chỉ lo việc tải, không phát.
 */
export class TrackLibrary {
  constructor(getContext, tracks = TRACKS) {
    this.getContext = getContext;
    this.tracks = tracks;
    this.cache = new Map(); // id -> Promise<AudioBuffer | null>
  }

  has(id) {
    return !!this.tracks[id];
  }

  get(id) {
    if (!this.cache.has(id)) {
      this.cache.set(id, this.load(id));
    }

    return this.cache.get(id);
  }

  preload(ids) {
    return Promise.all(ids.map(id => this.get(id)));
  }

  async load(id) {
    const track = this.tracks[id];

    if (!track) return null;

    for (const url of track.files) {
      try {
        const response = await fetch(url);

        if (!response.ok) continue;

        const data = await response.arrayBuffer();

        return await this.getContext().decodeAudioData(data);

      } catch {
        // Thử file kế tiếp.
      }
    }

    if (track.files.length) {
      console.warn(`[Music] Không tìm thấy file cho "${id}", dùng bản dự phòng.`);
    }

    return null;
  }
}
