'use strict';

// INT 21h/11h,12h. Microsoft MS-DOS 3.3 Programmer's Reference, functions
// 11h/12h, and MS-DOS 4.0 DOS/SEARCH.ASM (SearchSet), DOS/DIR.ASM (Srch).
// https://www.pcjs.org/documents/books/mspl13/msdos/dosref33/
// https://github.com/microsoft/MS-DOS/blob/main/v4.0/src/DOS/SEARCH.ASM
// Search continuation belongs to the *input FCB*, never the result DTA.
// Private continuation bytes 12..21 are opaque, as on DOS; copied FCBs carry
// independent cursors. They are not a claim to DOS's internal disk layout.
const upper = b => b >= 0x61 && b <= 0x7a ? b - 32 : b;
const get32 = (b, at) => (b[at] | b[at + 1] << 8 | b[at + 2] << 16 | b[at + 3] << 24) >>> 0;
const put32 = (b, at, v) => { for (let i = 0; i < 4; i++) b[at + i] = v >>> (8 * i) & 255; };
const invalid = b => b < 32 || b === 127 || '"+,./:;<=>[\\]|'.includes(String.fromCharCode(b));

function pattern(bytes) {
  const out = Uint8Array.from(bytes, upper);
  if (out.length !== 11 || out[0] === 32 || out.some(invalid)) return null;
  for (const [start, end] of [[0, 8], [8, 11]]) {
    const star = out.indexOf(42, start);
    if (star >= start && star < end) out.fill(63, star, end);
  }
  return out;
}

function entryName(name) {
  // The C: host overlay has no short-name alias generator. Never truncate a
  // long name or turn it into a false match against an unrelated 8.3 name.
  if (typeof name !== 'string' || !/^[^.]{1,8}(?:\.[^.]{1,3})?$/.test(name)) return null;
  const [base, ext = ''] = name.split('.');
  const s = base.padEnd(8, ' ') + ext.padEnd(3, ' ');
  if ([...s].some(c => c.charCodeAt(0) > 255)) return null;
  const b = Uint8Array.from(s, c => upper(c.charCodeAt(0)));
  return b.some(c => invalid(c) || c === 42 || c === 63) ? null : b;
}

function dirent(e) {
  if (e.directoryEntry) return Uint8Array.from(e.directoryEntry);
  const name = e.labelName || entryName(e.name);
  if (!name) return null;
  // C: overlay / ISO redirector have no FAT clusters. Zero reserved/cluster
  // bytes describe that namespace; FAT entries above retain the original bytes.
  const b = new Uint8Array(32);
  b.set(name); b[11] = e.attributes;
  const time = e.time ?? 0, date = e.date ?? 0;
  b[22] = time & 255; b[23] = time >>> 8;
  b[24] = date & 255; b[25] = date >>> 8;
  put32(b, 28, e.size);
  return b;
}

function range(m, at, length, offset) {
  return Number.isInteger(at) && at >= 0 && at + length <= 0x100000 &&
    offset + length <= 0x10000 &&
    (m.vmExports?.get_cr0() < 0 || at + length <= m.mem.length);
}

// Validate *all* destinations before the first write. Page faults propagate
// through the existing host-service exception path, never become AL=FFh.
function writeBuffers(m, writes) {
  const ex = m.vmExports;
  if (ex && ex.get_cr0() < 0) {
    const user = ex.get_vm86() || (ex.get_cs() & 3) === 3 ? 1 : 0;
    const prepared = writes.map(([at, b]) => [b,
      Array.from(b, (_, i) => ex.pg_probe(at + i, 1, user))]);
    for (const [b, physical] of prepared)
      for (let i = 0; i < b.length; i++) ex.pg_phys_write(physical[i], b[i]);
  } else {
    for (const [at, b] of writes) m.guestWrite(at, b);
  }
}

function fcbSearch(m, ah, r) {
  const ex = m.vmExports;
  // Real-mode/VM86 DOS interface only. A protected selector needs an extender
  // thunk. Unsafe/cross-segment/A20-wrapped/overlapping buffers and malformed
  // FCBs return false to the caller's observable unsupported-service path.
  if (ex && (ex.get_cr0() & 1) && !ex.get_vm86()) return false;
  const offset = r.get('dx') & 0xffff;
  const at = ((r.get('ds') & 0xffff) * 16) + offset;
  if (!range(m, at, 1, offset)) return false;
  const prefix = m.guestRd(at) === 255 ? 7 : 0, length = prefix + 22;
  if (!range(m, at, length, offset)) return false;
  const input = m.guestBytes(at, length), fcb = input.subarray(prefix);
  const attr = prefix ? input[6] : 0, pat = pattern(fcb.subarray(1, 12));
  if (!pat || (attr & 0xc0)) return false;
  const dta = m.dtaAddr(), outLength = prefix + 33;
  if (m.fcbDta?.at === dta && m.fcbDta.realLinear !== undefined && m.fcbDta.realLinear !== dta) return false;
  const dtaOffset = m.fcbDta?.at === dta ? m.fcbDta.offset : m.dta === undefined ? 0x80 : dta & 15;
  if (!range(m, dta, outLength, dtaOffset) || (at < dta + outLength && dta < at + length)) return false;
  const status = al => { r.set('ax', (r.get('ax') & 0xff00) | al); return true; };
  let id, cursor = 0, state;
  if (ah === 0x11) {
    const drive = fcb[0] ? fcb[0] - 1 : m.currentDrive;
    if (!m.driveAvailable(drive)) return status(255);
    const volume = m.dataVolume(drive);
    // DOS forces a volume-only query to the root, even with a non-root cwd.
    const directory = (attr & 0x1e) === 8 ? '' : m.driveDirectory(drive);
    const key = drive === 2 ? directory : String.fromCharCode(97 + drive) + ':/' + directory;
    state = { drive, requestedDrive: fcb[0], volume, key, attr, pat, prefix, owner: m.curPsp };
    // Identical queries can share immutable namespace/pattern metadata: the
    // position lives in each guest FCB. Repeated FindFirst must not retain one
    // host search object per call or reset a copied FCB's cursor.
    for (const [token, prior] of m.fcbSearches || []) {
      if (prior.drive === drive && prior.requestedDrive === fcb[0] && prior.volume === volume &&
          prior.key === key && prior.attr === attr && prior.prefix === prefix && prior.owner === m.curPsp &&
          prior.pat.every((b, i) => b === pat[i])) { id = token; break; }
    }
    if (id === undefined) id = ((m.fcbSearchSerial || 0) + 1) >>> 0;
    if (!id) throw Error('FCB search token space exhausted');
  } else {
    id = get32(fcb, 12); cursor = get32(fcb, 16);
    state = fcb[20] === 0x46 && fcb[21] === 0x43 ? m.fcbSearches?.get(id) : null;
    if (!state || state.owner !== m.curPsp || state.prefix !== prefix || state.attr !== attr || state.requestedDrive !== fcb[0] ||
        !state.pat.every((b, i) => b === pat[i]) ||
        !m.driveAvailable(state.drive) || m.dataVolume(state.drive) !== state.volume) return status(255);
  }
  const entries = m.dirEntries(state.key);
  if ((attr & 8) && (state.key === '' || /^[a-z]:\/$/.test(state.key))) {
    const label = state.volume?.label;
    if (label) {
      // ISO identifiers beyond the FCB's 11 bytes have no established mapping
      // here. Refuse that label search instead of inventing/truncating a name.
      if (!state.volume.labelEntry && (label.length > 11 || [...label].some(c => c.charCodeAt(0) > 255))) return false;
      entries.push({ labelName: Uint8Array.from(label.padEnd(11, ' '), c => upper(c.charCodeAt(0))),
        attributes: 8, size: 0, date: 0, directoryEntry: state.volume.labelEntry, directoryOrder: state.volume.labelOrder });
    }
  }
  // dirEntries groups files and directories for handle searches. Restore the
  // mounted FAT's original physical directory order for FCB continuation.
  if (state.volume && state.volume.kind !== 'iso9660') entries.sort((a, b) => a.directoryOrder - b.directoryOrder);
  for (; cursor < entries.length; cursor++) {
    const e = entries[cursor];
    if (e.attributes & 8 ? !(attr & 8) : (attr & 0x1e) === 8 || ((e.attributes & 0x16) & ~attr)) continue;
    const entry = dirent(e);
    if (!entry || !pat.every((b, i) => b === 63 || b === upper(entry[i]))) continue;
    const result = new Uint8Array(outLength);
    if (prefix) { result[0] = 255; result[6] = attr; }
    result[prefix] = state.drive + 1; result.set(entry, prefix + 1);
    put32(fcb, 12, id); put32(fcb, 16, cursor + 1); fcb[20] = 0x46; fcb[21] = 0x43;
    writeBuffers(m, [[at + prefix + 12, fcb.subarray(12, 22)], [dta, result]]);
    if (!m.fcbSearches) m.fcbSearches = new Map();
    m.fcbSearches.set(id, state); m.fcbSearchSerial = Math.max(m.fcbSearchSerial || 0, id);
    // Only AL is a result field. Preserve AH, other registers and all flags;
    // FCB failure is not the CF/AX error convention used by handle searches.
    return status(0);
  }
  return status(255);
}

module.exports = { fcbSearch };
