/** archive.js - container AR của game: u32 count; {u32 offset; u32 size; char name[16]}[count]  (txArFind 0x800365c0) */
export function parseAR(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const n = dv.getUint32(0, true);
  const files = {};
  for (let i = 0; i < n; i++) {
    const e = 4 + 24 * i;
    const off = dv.getUint32(e, true), size = dv.getUint32(e + 4, true);
    let name = "";
    for (let k = 0; k < 16 && u8[e + 8 + k]; k++) name += String.fromCharCode(u8[e + 8 + k]);
    files[name] = u8.subarray(off, off + size);
  }
  return files;
}
