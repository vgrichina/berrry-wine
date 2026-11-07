'use strict';

// A detached, read-only DOS volume. Parse the original image, including FAT
// chains and subdirectories; never unpack it into the writable C: namespace.
function readFat12(source) {
  if (!(source instanceof Uint8Array) || source.length < 512) throw Error('invalid FAT12 image');
  const image = Uint8Array.from(source), v = new DataView(image.buffer);
  const u16 = p => v.getUint16(p, true), u32 = p => v.getUint32(p, true);
  const bps = u16(11), spc = image[13], reserved = u16(14), fats = image[16];
  const roots = u16(17), sectors = u16(19) || u32(32), fatSectors = u16(22);
  const rootSector = reserved + fats * fatSectors;
  const dataSector = rootSector + Math.ceil(roots * 32 / bps);
  const clusters = Math.floor((sectors - dataSector) / spc);
  if (![128, 256, 512, 1024, 2048, 4096].includes(bps) || !spc || (spc & (spc - 1)) ||
      !reserved || !fats || !roots || !fatSectors || sectors * bps !== image.length ||
      clusters < 1 || clusters >= 4085 || Math.ceil((clusters + 2) * 1.5) > fatSectors * bps ||
      image[510] !== 0x55 || image[511] !== 0xaa) throw Error('invalid FAT12 geometry');
  const fat = image.subarray(reserved * bps, (reserved + fatSectors) * bps);
  for (let i = 1; i < fats; i++) {
    const copy = image.subarray((reserved + i * fatSectors) * bps, (reserved + (i + 1) * fatSectors) * bps);
    if (copy.some((b, n) => b !== fat[n])) throw Error('inconsistent FAT12 copies');
  }
  const claimed = new Set(), entries = new Map(), directories = new Set(['']), directoryMetadata = new Map();
  function chain(first) {
    const parts = []; let cluster = first;
    while (cluster < 0xff8) {
      if (cluster < 2 || cluster >= clusters + 2 || claimed.has(cluster)) throw Error('invalid FAT12 chain');
      claimed.add(cluster);
      const at = (dataSector + (cluster - 2) * spc) * bps;
      parts.push(image.subarray(at, at + spc * bps));
      const offset = cluster + (cluster >> 1), pair = fat[offset] | fat[offset + 1] << 8;
      cluster = cluster & 1 ? pair >>> 4 : pair & 0xfff;
    }
    const bytes = new Uint8Array(parts.length * spc * bps);
    parts.forEach((p, i) => bytes.set(p, i * spc * bps));
    return bytes;
  }
  let label = '';
  function directory(bytes, prefix, depth = 0) {
    if (depth > 64) throw Error('FAT12 directory depth');
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let at = 0; at + 32 <= bytes.length; at += 32) {
      if (!bytes[at]) break;
      const attr = bytes[at + 11];
      if (bytes[at] === 0xe5 || attr === 0x0f) continue;
      const text = (p, n) => Array.from(bytes.subarray(p, p + n), b => String.fromCharCode(b)).join('').trimEnd();
      const base = text(at, 8), ext = text(at + 8, 3);
      if (attr & 8) { if (!prefix) label = text(at, 11); continue; }
      if (base === '.' || base === '..') continue;
      const name = base + (ext ? '.' + ext : '');
      if (!base || /[\\/:\x00-\x20]/.test(name)) throw Error('invalid FAT12 name');
      const key = prefix + name.toLowerCase();
      if (entries.has(key) || directories.has(key)) throw Error('duplicate FAT12 name');
      const first = dv.getUint16(at + 26, true), size = dv.getUint32(at + 28, true);
      const metadata = { attributes: attr, time: dv.getUint16(at + 22, true), date: dv.getUint16(at + 24, true) };
      if (attr & 0x10) {
        directories.add(key); directoryMetadata.set(key, metadata); directory(chain(first), key + '/', depth + 1);
      } else {
        const data = first ? chain(first) : new Uint8Array();
        if (size > data.length || (!size && first)) throw Error('invalid FAT12 file size');
        entries.set(key, { data: data.slice(0, size), ...metadata, size });
      }
    }
  }
  directory(image.subarray(rootSector * bps, rootSector * bps + roots * 32), '');
  return { entries, directories, directoryMetadata, label, bps, spc, clusters, freeClusters: Array.from({ length: clusters }, (_, i) => {
    const c = i + 2, at = c + (c >> 1), pair = fat[at] | fat[at + 1] << 8;
    return (c & 1 ? pair >>> 4 : pair & 0xfff) === 0;
  }).filter(Boolean).length };
}

module.exports = { readFat12 };
