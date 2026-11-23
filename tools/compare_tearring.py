#!/usr/bin/env python3
"""So crop RGBA do verify_tearring.mjs ghi ra với bản export đã kiểm chứng (animations.json + sprite_sheet.png).
python3 tools/compare_tearring.py <export_dir> <js_dump.bin> [motion_name]"""
import json, struct, sys
import numpy as np
from PIL import Image

exp, dump = sys.argv[1], sys.argv[2]
want = sys.argv[3] if len(sys.argv) > 3 else None
d = json.load(open(f"{exp}/animations.json"))
sheet = Image.open(f"{exp}/{d['sprite_sheet']['file']}").convert("RGBA")
an = next(a for a in d["animations"] if not want or a["name"].startswith(want))
ref = {}
for f in an["frames"]:
    for t in range(f["tick"], f["tick"] + f["ticks"]):
        ref[t] = f
raw = open(dump, "rb").read()
o, t, bad, exact, near, worst = 0, 0, [], 0, 0, 0
while o < len(raw):
    x0, y0, x1, y1, n, cnt = struct.unpack_from("<6i", raw, o); o += 24
    js = raw[o:o + n]; o += n
    f = ref.get(t)
    if f is None:
        bad.append((t, "không có frame tham chiếu")); t += 1; continue
    s = f["sheet"]
    img = np.array(sheet.crop((s["x"], s["y"], s["x"] + s["w"], s["y"] + s["h"])))
    rx0, ry0 = 160 + 80 - f["anchor"]["x"], 120 + 60 - f["anchor"]["y"]
    if (x0, y0, x1, y1) == (0, 0, 0, 0):           # JS: khung trống; exporter ghi ô trong suốt 1x1 ở (0,0)
        if (rx0, ry0, s["w"], s["h"]) == (0, 0, 1, 1) and img[0, 0, 3] == 0:
            exact += 1; t += 1; continue
    box_ok = (x0, y0, x1, y1) == (rx0, ry0, rx0 + s["w"], ry0 + s["h"])
    if not box_ok:
        bad.append((t, f"bbox js={(x0,y0,x1,y1)} ref={(rx0,ry0,rx0+s['w'],ry0+s['h'])}"))
    else:
        a = np.frombuffer(js, dtype=np.uint8).reshape(s["h"], s["w"], 4).astype(int)
        diff = np.abs(a - img.astype(int))
        m = int(diff.max()); worst = max(worst, m)
        if m == 0: exact += 1
        elif m <= 1: near += 1
        else: bad.append((t, f"pixel khác tối đa {m}, {int((diff.max(axis=2)>1).sum())} px"))
    t += 1
print(f"{an['name']}: {t} tick | giống từng byte: {exact} | lệch ≤1: {near} | lỗi: {len(bad)} | lệch lớn nhất: {worst}")
for b in bad[:12]: print("  ", b)
sys.exit(1 if bad else 0)
