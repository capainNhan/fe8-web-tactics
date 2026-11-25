#!/usr/bin/env python3
"""Công cụ quét mã máy B.BIN (đã dùng trong suốt quá trình decomp).
  python3 tools/decomp/scan.py funcs  [lo hi]            danh sách hàm (mở đầu addiu sp,-N) và kích thước (lệnh)
  python3 tools/decomp/scan.py callers 0x8014e728        ai gọi (jal) hàm này, theo hàm chứa
  python3 tools/decomp/scan.py field 0x2ec [lo hi]       lệnh load/store có hằng dịch chuyển = 0x2ec (ai đọc/ghi trường)
  python3 tools/decomp/scan.py global 0x80166884         ai đọc/ghi biến toàn cục (lui+offset), trong B.BIN và exe
  python3 tools/decomp/scan.py dis 0x800ff4d4 320        in mã dịch ngược (dasm)
Biến môi trường TR_EXTRACT trỏ tới thư mục extract_overlays.py đã tạo."""
import os, struct, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
EXTRACT = os.environ.get("TR_EXTRACT", os.path.join(HERE, "extracted"))
BASE = 0x800f1008
OPS = {0x20: "lb", 0x21: "lh", 0x23: "lw", 0x24: "lbu", 0x25: "lhu", 0x28: "sb", 0x29: "sh", 0x2b: "sw"}

raw = open(os.path.join(EXTRACT, "B.BIN"), "rb").read()
words = [struct.unpack_from("<I", raw, i * 4)[0] for i in range(len(raw) // 4)]

def fstart(i):
    while i >= 0:
        w = words[i]
        if (w >> 16) == 0x27bd and (w & 0x8000): return BASE + i * 4
        i -= 1

def funcs(lo=BASE, hi=BASE + len(raw)):
    fs = [BASE + i * 4 for i, w in enumerate(words) if (w >> 16) == 0x27bd and (w & 0x8000)]
    fs = [f for f in fs if lo <= f <= hi]
    for a, b in zip(fs, fs[1:] + [hi]): print(f"{a:08x}  {(b - a) // 4:5d} lệnh")

def callers(addr):
    enc = 0x0c000000 | ((addr >> 2) & 0x3ffffff)
    for i, w in enumerate(words):
        if w == enc: print(f"{BASE + i * 4:08x} trong hàm {fstart(i):x}")

def field(imm, lo=BASE, hi=BASE + len(raw)):
    for i, w in enumerate(words):
        a = BASE + i * 4
        if (w >> 26) in OPS and (w & 0xffff) == imm and lo <= a <= hi:
            print(f"{a:08x} {OPS[w >> 26]:3} rt={(w >> 16) & 31:2} rs={(w >> 21) & 31:2} trong hàm {fstart(i):x}")

def glob(addr):
    imm = addr & 0xffff
    exe = open(os.path.join(EXTRACT, "SLPS_031.77"), "rb").read()
    taddr, tsize = struct.unpack("<II", exe[0x18:0x20])
    text = exe[0x800:0x800 + tsize]
    for name, buf, b0 in (("B.BIN", raw, BASE), ("EXE", text, taddr)):
        ws = [struct.unpack_from("<I", buf, i * 4)[0] for i in range(len(buf) // 4)]
        for i, w in enumerate(ws):
            if (w >> 26) in OPS and (w & 0xffff) == imm:
                print(f"{name} {b0 + i * 4:08x} {OPS[w >> 26]}")

if __name__ == "__main__":
    c = sys.argv[1]; a = sys.argv[2:]
    if c == "funcs": funcs(*[int(x, 16) for x in a])
    elif c == "callers": callers(int(a[0], 16))
    elif c == "field": field(int(a[0], 16), *[int(x, 16) for x in a[1:]])
    elif c == "global": glob(int(a[0], 16))
    elif c == "dis":
        from dasm import load_exe, load_overlay, show
        exe = load_exe(os.path.join(EXTRACT, "SLPS_031.77")); img = load_overlay(os.path.join(EXTRACT, "B.BIN"))
        print(show(img, int(a[0], 16), int(a[1]), exe))
    else: print(__doc__)
