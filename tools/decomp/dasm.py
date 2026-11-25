import sys, json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
# Thư mục chứa overlay đã trích (extract_overlays.py).  Đổi bằng biến môi trường TR_EXTRACT.
EXTRACT = os.environ.get('TR_EXTRACT', os.path.join(HERE, 'extracted'))
from mips import *
SYMF = os.path.join(HERE, "syms.json")      # tuỳ chọn: {"0x80059db8": "TmLerp", ...}
def load_syms():
    return {int(k,16):v for k,v in json.load(open(SYMF)).items()} if os.path.exists(SYMF) else {}
def cstr(img, a):
    if not img.contains(a): return None
    o = a - img.base; s = img.d[o:o+80].split(b"\0")[0]
    if len(s) >= 3 and all(32 <= c < 127 for c in s): return s.decode()
    return None
def show(img, start, nwords, exe=None, name=""):
    syms = load_syms()
    end = start + 4*nwords
    labels = set()
    for a in range(start, end, 4):
        t,k,tg = dis(img.word(a), a)
        if k in ("branch",) and tg is not None and start <= tg < end: labels.add(tg)
    regval = {}
    out = []
    for a in range(start, end, 4):
        w = img.word(a); t,k,tg = dis(w, a)
        if a in labels: out.append(f"L_{a:08x}:")
        note = ""
        op = w >> 26; rs=(w>>21)&31; rt=(w>>16)&31; imm=w&0xffff
        if op == 0x0f: regval[rt] = imm << 16
        elif op in (0x09,0x0d) and rs in regval and rs == rt or (op in (0x09,0x0d) and rs in regval):
            hi = regval[rs]; v = (hi + (imm-0x10000 if (imm&0x8000 and op==9) else imm)) & 0xffffffff
            note = f"; =0x{v:08x}"
            s = cstr(img, v) or (cstr(exe, v) if exe else None)
            if s: note += f' "{s}"'
            regval[rt] = v
        elif op in (0x20,0x21,0x23,0x24,0x25,0x28,0x29,0x2b) and rs in regval:
            v = (regval[rs] + (imm-0x10000 if imm&0x8000 else imm)) & 0xffffffff
            note = f"; [0x{v:08x}]"
            if v in syms: note += f" {syms[v]}"
        if k == "call" and tg is not None:
            note = f"; {syms.get(tg, 'sub_%08x' % tg)}"
        if k in ("branch",) and tg in labels: t = re.sub(r"0x[0-9a-f]{8}$", f"L_{tg:08x}", t)
        out.append(f"  {a:08x}: {w:08x}  {t:38s}{note}")
    return "\n".join(out)
if __name__ == "__main__":
    f, a, n = sys.argv[1], int(sys.argv[2],16), int(sys.argv[3])
    exe = load_exe(os.path.join(EXTRACT, "SLPS_031.77"))
    img = exe if f=="EXE" else load_overlay(os.path.join(EXTRACT, f))
    print(show(img, a, n, exe))
