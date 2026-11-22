#!/usr/bin/env python3
"""
import_decomp.py - đưa kết quả export của bản decomp (export_anim.py) vào engine web.

Đầu vào : thư mục export của một unit, gồm animations.json + sprite_sheet.png
          (vd. files/out/BU004).
Đầu ra  : assets/characters/<Id>/spritesheet.png + spritesheet.json đúng định dạng
          mà SheetSpriteSet/SpriteLoader đang dùng, nên BattleScene không phải sửa.

Cách làm (không suy đoán thêm gì về hoạt ảnh):
  * mỗi frame của decomp bị cắt (crop) và có điểm gốc (anchor) riêng; ở đây chúng được
    xếp lại vào lưới ô đều, mọi frame canh theo CÙNG một điểm gốc chung -> vị trí tương
    đối giữa các frame giữ nguyên từng pixel;
  * frame giống hệt nhau (so sánh theo từng byte, kể cả vị trí trong ô) chỉ lưu một lần;
  * thời lượng: ms = ticks * tickMs.  tick_hz KHÔNG có trong mã đã decomp, nên tickMs là
    tham số (mặc định 20 ms = giá trị sheet TearRing Compositor đang dùng trong dự án).

Dùng:  python3 tools/import_decomp.py files/out/BU004 --id BU004 [--tick-ms 20]
Cần: Pillow.
"""
import argparse
import hashlib
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAX_TEX = 4096


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src", help="thư mục chứa animations.json + sprite_sheet.png")
    ap.add_argument("--id", required=True, help="tên thư mục đích trong assets/characters/")
    ap.add_argument("--tick-ms", type=float, default=20.0)
    ap.add_argument("--out", default=os.path.join(ROOT, "assets", "characters"))
    a = ap.parse_args()

    meta = json.load(open(os.path.join(a.src, "animations.json")))
    sheet = Image.open(os.path.join(a.src, meta["sprite_sheet"]["file"])).convert("RGBA")

    anims = meta["animations"]
    frames = [f for an in anims for f in an["frames"]]
    if not frames:
        sys.exit("animations.json không có frame nào")

    # Ô chung: phủ hợp của mọi frame khi canh theo cùng một điểm gốc.
    ax = max(f["anchor"]["x"] for f in frames)
    ay = max(f["anchor"]["y"] for f in frames)
    cw = ax + max(f["sheet"]["w"] - f["anchor"]["x"] for f in frames)
    ch = ay + max(f["sheet"]["h"] - f["anchor"]["y"] for f in frames)

    # Cắt từng frame, đặt vào ô, loại trùng.
    cells, index_of, order = [], {}, []
    for f in frames:
        s = f["sheet"]
        crop = sheet.crop((s["x"], s["y"], s["x"] + s["w"], s["y"] + s["h"]))
        cell = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
        cell.paste(crop, (ax - f["anchor"]["x"], ay - f["anchor"]["y"]))
        key = hashlib.sha1(cell.tobytes()).hexdigest()
        if key not in index_of:
            index_of[key] = len(cells)
            cells.append(cell)
        order.append(index_of[key])

    cols = max(1, min(len(cells), MAX_TEX // cw))
    rows = -(-len(cells) // cols)
    if rows * ch > MAX_TEX:
        print(f"CẢNH BÁO: sheet {cols*cw}x{rows*ch} vượt {MAX_TEX}px, GPU yếu có thể không nạp được",
              file=sys.stderr)
    atlas = Image.new("RGBA", (cols * cw, rows * ch), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        atlas.paste(c, ((i % cols) * cw, (i // cols) * ch))

    names = [f"f{i:03d}" for i in range(len(cells))]
    out_frames = {n: {"x": (i % cols) * cw, "y": (i // cols) * ch, "w": cw, "h": ch}
                  for i, n in enumerate(names)}

    # Hoạt ảnh: gộp các bước liền nhau cùng frame (tổng thời lượng không đổi).
    out_anims, impact_hint = {}, {}
    k = 0
    for an in anims:
        steps = []
        first_blend = None
        for f in an["frames"]:
            n = names[order[k]]
            k += 1
            ms = round(f["ticks"] * a.tick_ms, 3)
            if steps and steps[-1]["frame"] == n:
                steps[-1]["ms"] = round(steps[-1]["ms"] + ms, 3)
            else:
                if first_blend is None and f["blend_modes"]:
                    first_blend = len(steps)
                steps.append({"frame": n, "ms": ms})
        code = an["name"].removesuffix(".D")
        out_anims[code] = steps
        impact_hint[code] = first_blend if first_blend is not None else len(steps) - 1

    first_code = next(iter(out_anims))
    # Thế chờ = frame đầu của đòn; thế "rest" = frame cuối.  Cả hai lấy thẳng từ dữ liệu.
    out_anims["IDLE"] = [{"frame": out_anims[first_code][0]["frame"], "ms": 1000}]
    rest = out_anims[first_code][-1]["frame"]

    dst = os.path.join(a.out, a.id)
    os.makedirs(dst, exist_ok=True)
    atlas.save(os.path.join(dst, "spritesheet.png"), optimize=True)
    json.dump({
        "image": "spritesheet.png",
        "frameSize": {"w": cw, "h": ch},
        "pivot": {"x": 0, "y": 0},
        "flipped": False,
        "tickMs": a.tick_ms,
        "source": {"origin": "decomp", "unit": meta["unit"], "side": meta["render"]["side"],
                   "blend": "baked: mỗi frame đã gộp sẵn các packet bán trong suốt"},
        "frames": out_frames,
        "animations": out_anims,
    }, open(os.path.join(dst, "spritesheet.json"), "w"), indent=1)

    print(f"{a.id}: {len(frames)} frame -> {len(cells)} ô duy nhất, ô {cw}x{ch}, "
          f"sheet {atlas.size[0]}x{atlas.size[1]}")
    print("Dán vào js/data/battleSprites.js:\n")
    print(f'  {a.id}: {{\n    facing: "left",   // kiểm tra bằng sprite-lab.html\n    scale: 1.25,\n'
          f'    anchor: {{ x: {ax}, y: {ay} }},\n    rest: "{rest}",\n    reach: 125,\n'
          f'    roles: DECOMP_ROLES("{first_code}"),\n    impact: {{ {first_code}: {impact_hint[first_code]} }}\n  }},')


if __name__ == "__main__":
    main()
