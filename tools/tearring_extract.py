#!/usr/bin/env python3
"""
tearring_extract.py - trích dữ liệu trận đấu của TearRing Saga từ ảnh đĩa cho engine JS.

Xuất ra (mặc định assets/tearring/):
  common.json     bảng dùng chung đọc từ B.BIN / SLPS_031.77 (vị trí trang VRAM, điểm bóng...)
  rsincos.bin     g_rsincos[4096] (u32 LE, lo16 = sin, hi16 = cos) -- 0x800c491c trong exe
  BU<nnn>.pak     MỘT container AR (đúng định dạng của game) gộp BU1/.ARS + BU2/.AR + BU3/.ART
                  của unit: BSET.DDD, POS.BAS/EXT, CLUT.TIM, B*.DDD, M*.D (nguyên byte, không sửa)

Dùng:  python3 tools/tearring_extract.py --bin tearingsaga.bin --units 4 30 52
       python3 tools/tearring_extract.py --bin tearingsaga.bin --all
Không cần thư viện ngoài.  Đọc đĩa MODE2/2352 hoặc ISO 2048.
"""
import argparse, json, os, re, struct, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
B_BASE = 0x800f1008          # B.BIN nạp tại đây


class Disc:
    def __init__(self, path):
        self.f = open(path, "rb")
        head = self.f.read(16)
        self.raw = head[:12] == b"\x00" + b"\xff" * 10 + b"\x00"
        self.ss = 2352 if self.raw else 2048
        pvd = self.sector(16)
        if pvd[1:6] != b"CD001":
            sys.exit("không phải ảnh ISO9660")
        root = pvd[156:190]
        self.index = {}
        self._walk(struct.unpack("<I", root[2:6])[0], struct.unpack("<I", root[10:14])[0], "")

    def sector(self, lba):
        self.f.seek(lba * self.ss)
        d = self.f.read(self.ss)
        return d[24:24 + 2048] if self.raw else d

    def _read(self, lba, size):
        out = bytearray()
        for i in range((size + 2047) // 2048):
            out += self.sector(lba + i)
        return bytes(out[:size])

    def _walk(self, lba, size, path):
        d = self._read(lba, size)
        pos = 0
        while pos < len(d):
            n = d[pos]
            if n == 0:
                pos = (pos // 2048 + 1) * 2048
                continue
            rec = d[pos:pos + n]
            pos += n
            name = rec[33:33 + rec[32]]
            if name in (b"\x00", b"\x01"):
                continue
            name = name.decode("ascii", "replace").split(";")[0]
            elba = struct.unpack("<I", rec[2:6])[0]
            esize = struct.unpack("<I", rec[10:14])[0]
            if rec[25] & 2:
                self._walk(elba, esize, path + "/" + name)
            else:
                self.index[path + "/" + name] = (elba, esize)

    def get(self, p):
        return self._read(*self.index[p])

    def has(self, p):
        return p in self.index


def ar_parse(d):
    n = struct.unpack_from("<I", d, 0)[0]
    out = {}
    for i in range(n):
        off, size = struct.unpack_from("<II", d, 4 + 24 * i)
        out[d[4 + 24 * i + 8:4 + 24 * i + 24].split(b"\0")[0].decode("ascii", "replace")] = d[off:off + size]
    return out


def ar_build(files):
    """Container AR: u32 count; {u32 offset; u32 size; char name[16]}[count]; payload."""
    names = list(files)
    off = 4 + 24 * len(names)
    head, body = bytearray(struct.pack("<I", len(names))), bytearray()
    for n in names:
        d = files[n]
        head += struct.pack("<II16s", off + len(body), len(d), n.encode("ascii"))
        body += d
        body += bytes((-len(body)) % 4)
    return bytes(head + body)


def unit_files(disc, bu):
    files = {}
    for tag, ext in (("BU1", "ARS"), ("BU2", "AR"), ("BU3", "ART")):
        p = "/%s/BU%03d.%s" % (tag, bu, ext)
        if disc.has(p):
            for k, v in ar_parse(disc.get(p)).items():
                files.setdefault(k, v)
    return files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bin", required=True)
    ap.add_argument("--units", type=int, nargs="*", default=[])
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--out", default=os.path.join(ROOT, "assets", "tearring"))
    a = ap.parse_args()
    disc = Disc(a.bin)
    os.makedirs(a.out, exist_ok=True)

    bbin, ex = disc.get("/B.BIN"), disc.get("/SLPS_031.77")
    taddr, tsize = struct.unpack("<II", ex[0x18:0x20])
    text = ex[0x800:0x800 + tsize]

    def exe(addr, n):
        return text[addr - taddr: addr - taddr + n]

    def bb(addr, n):
        return bbin[addr - B_BASE: addr - B_BASE + n]

    open(os.path.join(a.out, "rsincos.bin"), "wb").write(exe(0x800c491c, 4 * 4096))
    common = {
        "note": "đọc từ B.BIN/SLPS_031.77; địa chỉ gốc ghi kèm",
        # 0x80166854 + 4*(participant*3 + group): vị trí (x, y) của trang texture trong VRAM
        "vramTable": [list(struct.unpack_from("<HH", bb(0x80166854 + 4 * i, 4))) for i in range(6)],
        # 0x80166890: 13 điểm của bóng đổ (SPOINT)
        "shadowPts": [list(struct.unpack_from("<hh", bb(0x80166890 + 4 * i, 4))) for i in range(13)],
        # 0x80166888: bảng số motion cho cờ mask12 của BSET (BtlMotionStart)
        "motionTbl": list(bb(0x80166888, 8)),
    }
    json.dump(common, open(os.path.join(a.out, "common.json"), "w"), indent=1)

    units = a.units
    if a.all:
        units = sorted(int(m.group(1)) for p in disc.index for m in [re.match(r"/BU1/BU(\d+)\.ARS$", p)] if m)
    for bu in units:
        files = unit_files(disc, bu)
        need = {"BSET.DDD", "POS.BAS", "CLUT.TIM"}
        if not need <= set(files):
            print(f"BU{bu:03d}: thiếu {sorted(need - set(files))}, bỏ qua")
            continue
        keep = {k: v for k, v in files.items()
                if k in ("BSET.DDD", "POS.BAS", "POS.EXT", "CLUT.TIM")
                or re.fullmatch(r"B\d\.DDD", k) or re.fullmatch(r"M\d+_\d+\.D", k)}
        open(os.path.join(a.out, "BU%03d.pak" % bu), "wb").write(ar_build(keep))
        print(f"BU{bu:03d}: {len(keep)} file, {sum(map(len, keep.values()))} byte")


if __name__ == "__main__":
    main()
