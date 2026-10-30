'use strict';

const neImageErrors = typeof require === 'function' ? require('./ne-load-error') : globalThis.NeLoadErrorApi;

// Dependency admission only: these names dispatch to host implementations,
// not guest export tables. CARDS deliberately remains a real image despite
// its fixed module id. Dynamic names need owned slots for their import thunks.
function neFixedBuiltinId(name) {
  const id = ['KERNEL', 'USER', 'GDI', 'KEYBOARD', 'SOUND', 'SHELL', 'MMSYSTEM',
    'COMMDLG', 'CARDS', 'DDEML', 'NDDEAPI', 'WIN87EM'].indexOf(name) + 1;
  return id === 9 ? 0 : id;
}
function neBuiltinDependency(name) {
  if (neFixedBuiltinId(name)) return 'fixed';
  if (['TOOLHELP', 'VER', 'AVIFILE', 'MSVIDEO', 'DISPLAY', 'LZEXPAND'].includes(name)) return 'dynamic';
  return null;
}

// Validate the byte ranges consumed by the existing NE loader before it writes
// guest memory. This bridge currently admits ordinary single-data DLLs only.
function inspectNeDll(input) {
  if (!(input instanceof Uint8Array)) throw new TypeError('NE image bytes required');
  const bytes = Uint8Array.from(input), v = new DataView(bytes.buffer);
  const range = (p, n) => {
    if (!Number.isSafeInteger(p) || !Number.isSafeInteger(n) || p < 0 || n < 0 || p > bytes.length - n)
      throw new neImageErrors.NeLoadError(11, 'NE image range outside file');
    return p;
  };
  const u16 = p => v.getUint16(range(p, 2), true), u32 = p => v.getUint32(range(p, 4), true);
  const str = p => {
    range(p, 1); const n = bytes[p]; range(p + 1, n);
    const text = String.fromCharCode(...bytes.subarray(p + 1, p + 1 + n));
    if (!n || /[^\x20-\x7e]/.test(text)) throw new Error('Invalid NE name');
    return text;
  };
  if (u16(0) !== 0x5a4d) throw new neImageErrors.NeLoadError(11, 'Not MZ');
  const ne = u32(0x3c); range(ne, 64);
  if (u16(ne) !== 0x454e) throw new neImageErrors.NeLoadError(11, 'Not NE');
  const flags = u16(ne + 12);
  if (!(flags & 0x8000) || (flags & 2)) throw new Error('NE bridge requires a single-data DLL');
  if (u16(ne + 0x3e) >= 0x400) throw new Error('NE DllEntryPoint lifecycle is not implemented');
  const count = u16(ne + 0x1c), shift = u16(ne + 0x32) || 9;
  if (!count || count > 255 || shift > 16) throw new Error('Unsupported NE segment layout');
  const segments = [], table = ne + u16(ne + 0x22); range(table, count * 8);
  for (let i = 0; i < count; i++) {
    const p = table + i * 8, pos = u16(p) * 2 ** shift;
    const length = pos ? (u16(p + 2) || 65536) : 0, size = u16(p + 6) || 65536, flags = u16(p + 4);
    if ((flags & 8) || length > size) throw new Error('Unsupported NE iterated or oversized segment');
    if (pos) range(pos, length);
    segments.push({pos, length, size, flags});
  }
  const segment = (id, off, width = 1) => {
    const s = segments[id - 1];
    if (!s || off < 0 || off > s.size - width) throw new Error('Invalid NE segment target');
    return s;
  };
  const autoData = u16(ne + 14), initCS = u16(ne + 0x16), initIP = u16(ne + 0x14);
  if (autoData && (!(flags & 1) || !(segment(autoData, 0).flags & 1))) throw new Error('Invalid NE automatic data');
  if (initCS && (segment(initCS, initIP).flags & 1)) throw new Error('Invalid NE initializer');
  if (!initCS && initIP) throw new Error('Invalid NE initializer');
  const entries = new Map(), entryStart = ne + u16(ne + 4), entryEnd = entryStart + u16(ne + 6);
  range(entryStart, entryEnd - entryStart);
  let p = entryStart, ordinal = 1;
  while (p < entryEnd) {
    const n = bytes[p++]; if (!n) break;
    if (p >= entryEnd) throw new Error('Truncated NE entry bundle');
    const indicator = bytes[p++];
    if (!indicator) { ordinal += n; continue; }
    for (let i = 0; i < n; i++, ordinal++) {
      const width = indicator === 255 ? 6 : 3;
      if (p > entryEnd - width) throw new Error('Truncated NE entry');
      const id = indicator === 255 ? bytes[p + 3] : indicator, off = u16(p + width - 2);
      segment(id, off); entries.set(ordinal, {segment: id, offset: off}); p += width;
    }
  }
  const names = new Map();
  const nameTable = (start, end) => {
    range(start, end - start);
    for (let p = start; p < end && bytes[p];) {
      const n = bytes[p]; if (p > end - n - 3) throw new Error('Truncated NE name table');
      const name = str(p), ordinal = u16(p + n + 1);
      if (ordinal) { if (!entries.has(ordinal)) throw new Error('NE name references absent entry'); names.set(name.toUpperCase(), ordinal); }
      p += n + 3;
    }
  };
  const resident = u16(ne + 0x26), modTable = u16(ne + 0x28), imports = ne + u16(ne + 0x2a);
  if (resident) nameTable(ne + resident, ne + modTable);
  const nrSize = u16(ne + 0x20); if (nrSize) nameTable(u32(ne + 0x2c), u32(ne + 0x2c) + nrSize);
  const dependencies = [], importEntries = [], moduleCount = u16(ne + 0x1e);
  range(ne + modTable, moduleCount * 2);
  for (let i = 0; i < moduleCount; i++) dependencies.push(str(imports + u16(ne + modTable + i * 2)).toUpperCase());
  for (const s of segments) {
    if (!(s.flags & 0x100) || !s.pos) continue;
    let p = s.pos + s.length; const n = u16(p); p += 2; range(p, n * 8);
    const written = new Set();
    for (let i = 0; i < n; i++, p += 8) {
      const kind = bytes[p + 1] & 3, additive = bytes[p + 1] & 4;
      if (kind === 3) continue; // Existing x87 OS fixups leave instructions intact.
      const type = bytes[p] & 15, width = ({0:1, 2:2, 3:4, 5:2})[type];
      if (!width) throw new Error('Unsupported NE relocation width');
      const a = u16(p + 4), b = u16(p + 6);
      if (!kind) {
        if (a === 255) { if (!entries.has(b)) throw new Error('Absent NE relocation entry'); }
        else segment(a, b);
      } else {
        if (!dependencies[a - 1]) throw new Error('Invalid NE import module');
        const symbol = kind === 1 ? b : str(imports + b);
        if (!symbol) throw new Error('Invalid NE import symbol');
        importEntries.push({module: dependencies[a - 1], symbol});
      }
      // Validate the original chain without mutating it. Cycles would hang the
      // existing relocation loop and cannot be bounded by the execution driver.
      const seen = new Set(); let site = u16(p + 2);
      while (site !== 65535) {
        if (site > s.length - Math.max(width, 2) || seen.has(site)) throw new Error('Invalid NE relocation chain');
        // Earlier patches must not rewrite a later chain's link word. Reject
        // overlap rather than interpreting a chain after selector substitution.
        for (let at=site;at<site+Math.max(width,2);at++)
          if (written.has(at)) throw new Error('Overlapping NE relocation chains');
        for (let at=site;at<site+width;at++) written.add(at);
        seen.add(site); if (additive) break; site = u16(s.pos + site);
      }
    }
  }
  return {bytes, dependencies: [...new Set(dependencies)], imports: importEntries, names, entries, hasInitializer: !!initCS};
}
const neImageApi = {inspectNeDll, neBuiltinDependency, neFixedBuiltinId};
if (typeof module !== 'undefined' && module.exports) module.exports = neImageApi;
else globalThis.NeImage = neImageApi;
