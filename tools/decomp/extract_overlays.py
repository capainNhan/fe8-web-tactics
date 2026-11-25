#!/usr/bin/env python3
"""Trích các overlay / exe từ ảnh đĩa để đọc mã máy.
python3 tools/decomp/extract_overlays.py --bin tearingsaga.bin [--out tools/decomp/extracted]
Ra: SLPS_031.77 (exe, text tại 0x80010000+), B.BIN (trận, nạp tại 0x800f1008), E/G/H/J/T.BIN."""
import argparse, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
from tearring_extract import Disc

ap = argparse.ArgumentParser()
ap.add_argument("--bin", required=True)
ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "extracted"))
a = ap.parse_args()
d = Disc(a.bin)
os.makedirs(a.out, exist_ok=True)
for n in ["SLPS_031.77", "B.BIN", "E.BIN", "G.BIN", "H.BIN", "J.BIN", "T.BIN"]:
    open(os.path.join(a.out, n), "wb").write(d.get("/" + n))
    print("ok", n)
