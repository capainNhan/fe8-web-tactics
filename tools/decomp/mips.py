"""Minimal MIPS R3000A disassembler (MIPS-I, COP0, COP2/GTE) for PS1 analysis."""
import struct

REG = ["zero","at","v0","v1","a0","a1","a2","a3","t0","t1","t2","t3","t4","t5","t6","t7",
       "s0","s1","s2","s3","s4","s5","s6","s7","t8","t9","k0","k1","gp","sp","fp","ra"]

SPECIAL = {0x00:"sll",0x02:"srl",0x03:"sra",0x04:"sllv",0x06:"srlv",0x07:"srav",
           0x08:"jr",0x09:"jalr",0x0c:"syscall",0x0d:"break",0x10:"mfhi",0x11:"mthi",
           0x12:"mflo",0x13:"mtlo",0x18:"mult",0x19:"multu",0x1a:"div",0x1b:"divu",
           0x20:"add",0x21:"addu",0x22:"sub",0x23:"subu",0x24:"and",0x25:"or",
           0x26:"xor",0x27:"nor",0x2a:"slt",0x2b:"sltu"}
IMM = {0x08:"addi",0x09:"addiu",0x0a:"slti",0x0b:"sltiu",0x0c:"andi",0x0d:"ori",
       0x0e:"xori",0x0f:"lui"}
MEM = {0x20:"lb",0x21:"lh",0x22:"lwl",0x23:"lw",0x24:"lbu",0x25:"lhu",0x26:"lwr",
       0x28:"sb",0x29:"sh",0x2a:"swl",0x2b:"sw",0x2e:"swr",0x32:"lwc2",0x3a:"swc2"}
BR2 = {0x04:"beq",0x05:"bne"}
BR1 = {0x06:"blez",0x07:"bgtz"}
GTE = {0x01:"RTPS",0x06:"NCLIP",0x0c:"OP",0x10:"DPCS",0x11:"INTPL",0x12:"MVMVA",
       0x13:"NCDS",0x14:"CDP",0x16:"NCDT",0x1b:"NCCS",0x1c:"CC",0x1e:"NCS",
       0x20:"NCT",0x28:"SQR",0x29:"DCPL",0x2a:"DPCT",0x2d:"AVSZ3",0x2e:"AVSZ4",
       0x30:"RTPT",0x3d:"GPF",0x3e:"GPL",0x3f:"NCCT"}

def s16(x): return x - 0x10000 if x & 0x8000 else x

def dis(w, pc):
    """Return (text, kind, target) kind in {None,'branch','jump','call','ret','jr','jalr'}."""
    op = w >> 26
    rs = (w >> 21) & 31; rt = (w >> 16) & 31; rd = (w >> 11) & 31
    sh = (w >> 6) & 31; fn = w & 63; imm = w & 0xffff
    r = REG
    if w == 0: return "nop", None, None
    if op == 0:
        m = SPECIAL.get(fn)
        if m is None: return f".word 0x{w:08x}", None, None
        if m in ("sll","srl","sra"): return f"{m} {r[rd]},{r[rt]},{sh}", None, None
        if m in ("sllv","srlv","srav"): return f"{m} {r[rd]},{r[rt]},{r[rs]}", None, None
        if m == "jr":
            return f"jr {r[rs]}", ("ret" if rs == 31 else "jr"), None
        if m == "jalr": return f"jalr {r[rd]},{r[rs]}", "jalr", None
        if m in ("syscall","break"): return m, None, None
        if m in ("mfhi","mflo"): return f"{m} {r[rd]}", None, None
        if m in ("mthi","mtlo"): return f"{m} {r[rs]}", None, None
        if m in ("mult","multu","div","divu"): return f"{m} {r[rs]},{r[rt]}", None, None
        return f"{m} {r[rd]},{r[rs]},{r[rt]}", None, None
    if op == 1:
        t = (pc + 4 + (s16(imm) << 2)) & 0xffffffff
        names = {0:"bltz",1:"bgez",0x10:"bltzal",0x11:"bgezal"}
        m = names.get(rt)
        if m is None: return f".word 0x{w:08x}", None, None
        return f"{m} {r[rs]},0x{t:08x}", ("call" if rt >= 0x10 else "branch"), t
    if op == 2:
        t = (pc & 0xf0000000) | ((w & 0x3ffffff) << 2)
        return f"j 0x{t:08x}", "jump", t
    if op == 3:
        t = (pc & 0xf0000000) | ((w & 0x3ffffff) << 2)
        return f"jal 0x{t:08x}", "call", t
    if op in BR2:
        t = (pc + 4 + (s16(imm) << 2)) & 0xffffffff
        return f"{BR2[op]} {r[rs]},{r[rt]},0x{t:08x}", "branch", t
    if op in BR1:
        t = (pc + 4 + (s16(imm) << 2)) & 0xffffffff
        return f"{BR1[op]} {r[rs]},0x{t:08x}", "branch", t
    if op in IMM:
        if op == 0x0f: return f"lui {r[rt]},0x{imm:x}", None, None
        if op in (0x0c, 0x0d, 0x0e): return f"{IMM[op]} {r[rt]},{r[rs]},0x{imm:x}", None, None
        return f"{IMM[op]} {r[rt]},{r[rs]},{s16(imm)}", None, None
    if op in MEM:
        if op in (0x32, 0x3a): return f"{MEM[op]} c2r{rt},{s16(imm)}({r[rs]})", None, None
        return f"{MEM[op]} {r[rt]},{s16(imm)}({r[rs]})", None, None
    if op == 0x10:
        if rs == 0: return f"mfc0 {r[rt]},c0r{rd}", None, None
        if rs == 4: return f"mtc0 {r[rt]},c0r{rd}", None, None
        if w & 0x3f == 0x10 and rs == 0x10: return "rfe", None, None
        return f".word 0x{w:08x}", None, None
    if op == 0x12:
        if w & (1 << 25):
            c = w & 0x3f
            return f"gte {GTE.get(c, 'cmd_%02x' % c)} 0x{w & 0x1ffffff:07x}", None, None
        nm = {0:"mfc2",2:"cfc2",4:"mtc2",6:"ctc2"}.get(rs)
        if nm: return f"{nm} {r[rt]},c2r{rd}", None, None
    return f".word 0x{w:08x}", None, None

class Image:
    def __init__(self, data, base):
        self.d = data; self.base = base
        self.n = len(data) // 4
    def word(self, addr):
        o = addr - self.base
        return struct.unpack_from("<I", self.d, o)[0]
    def contains(self, addr):
        return self.base <= addr < self.base + self.n * 4
    def listing(self, start, end):
        out = []
        a = start
        while a < end:
            w = self.word(a)
            t, k, tg = dis(w, a)
            out.append((a, w, t, k, tg))
            a += 4
        return out

def load_exe(path):
    d = open(path, "rb").read()
    pc, gp, taddr, tsize = struct.unpack("<IIII", d[0x10:0x20])
    return Image(d[0x800:0x800 + tsize], taddr)

def load_overlay(path, base=0x800f1008):
    return Image(open(path, "rb").read(), base)

if __name__ == "__main__":
    import sys
    path, a0, a1 = sys.argv[1], int(sys.argv[2], 16), int(sys.argv[3], 16)
    img = load_exe(path) if path.endswith("SLPS_031.77") else load_overlay(path)
    for a, w, t, k, tg in img.listing(a0, a1):
        print(f"{a:08x}: {w:08x}  {t}")
