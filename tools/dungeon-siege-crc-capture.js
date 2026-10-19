'use strict';
// Serialized into existing control eval. Only JS getters/translation and reads;
// never call guest_to_wasm, allocation, commit, filesystem read, or guest code.
function captureCrcBoundary(exports, memory, layout, ctx, encode) {
  const fail = message => { throw new Error(message); };
  if ((exports.get_eip() >>> 0) !== 0x00628d6a) fail('Wrong breakpoint');
  const view = new Uint8Array(memory.buffer);
  const shared = Object.prototype.toString.call(memory.buffer) === '[object SharedArrayBuffer]';
  const ptes = new Uint32Array(memory.buffer, layout.BASE.GUEST_PAGE_TABLE, layout.SIZE.GUEST_PAGE_TABLE >>> 2);
  const imageBase = exports.get_image_base() >>> 0;
  function translate(address) {
    const guest = address >>> 0, direct = (guest - imageBase + layout.GUEST_BASE) >>> 0;
    // Same read-only ordering as lib/mem-utils.g2w / guest_page_translate.
    // These limits are fixed ABI ranges, not allocator-produced region bases.
    if (direct < 0x08000000) return direct;
    const dib = (guest - 0x50000000) >>> 0;
    if (dib < 0x03f00000) return (layout.BASE.DIB_BACKING_BASE + dib) >>> 0;
    const pte = shared ? Atomics.load(ptes, guest >>> 12) >>> 0 : ptes[guest >>> 12] >>> 0;
    return pte & 0x800 ? ((pte & 0xfffff000) | (guest & 4095)) >>> 0 : 0xf0;
  }
  const pages = [], holes = [];
  function read(address, length, record = false) {
    address >>>= 0;
    if (!Number.isInteger(length) || length < 0 || length > 1836044 || address + length > 0x100000000) fail('Invalid capture range');
    const out = new Uint8Array(length);
    for (let at = 0; at < length;) {
      const guest = address + at, count = Math.min(length - at, 4096 - (guest & 4095));
      const wa = translate(guest), end = translate(guest + count - 1);
      const pte = shared ? Atomics.load(ptes, guest >>> 12) >>> 0 : ptes[guest >>> 12] >>> 0;
      if (wa < 0x12000 || wa + count > view.length || end !== wa + count - 1) {
        if (!record) fail('Unmapped/non-affine guest field at 0x' + guest.toString(16));
        const hole = { guest, bytes: count, pte, mapped: false };
        pages.push(hole); holes.push(hole); at += count; continue;
      }
      out.set(view.subarray(wa, wa + count), at);
      if (record) pages.push({ guest, wasm: wa, bytes: count, pte, mapped: true });
      at += count;
    }
    return out;
  }
  const word = address => new DataView(read(address, 4).buffer).getUint32(0, true);
  const owner = exports.get_esi() >>> 0;
  const fields = { owner, flags: word(owner + 4), buffer: word(owner + 12),
    innerLength: word(owner + 16), pageSize: word(owner + 20), slice: word(owner + 24),
    fileOffset: word(owner + 0x94), length: word(owner + 0x9c), expectedCrc: word(owner + 0xd8) };
  if (fields.length !== 1836044 || fields.fileOffset !== 194793312 || fields.expectedCrc !== 0x6fdb45eb) fail('Unexpected original directory fields');
  const bytes = read(fields.buffer, fields.length, true);
  const table = read(0x006f6468, 1024), tableView = new DataView(table.buffer);
  let crc = 0xffffffff;
  if (!holes.length) for (const byte of bytes) crc = (tableView.getUint32(((crc ^ byte) & 255) * 4, true) ^ (crc >>> 8)) >>> 0;
  const files = [];
  for (const [handle, f] of ctx.vfs.handles) {
    if (f && f.path === 'c:\\demo.ds') files.push({ handle: handle >>> 0, path: f.path, pos: f.pos, closed: !!f.closed });
  }
  const sliceHandle = word(fields.slice + 4);
  const activeFile = files.find(f => f.handle === sliceHandle && !f.closed);
  if (!activeFile || !Number.isSafeInteger(activeFile.pos)) fail('Missing live slice file cursor');
  if ((exports.get_eip() >>> 0) !== 0x00628d6a || (exports.get_esi() >>> 0) !== owner) fail('Guest moved during capture');
  return { eip: 0x00628d6a, guestCrc: exports.get_eax() >>> 0, expected: fields.expectedCrc,
    capturedCrc: holes.length ? null : (~crc) >>> 0, fields, sliceHandle, activeFile, files, pages, holes,
    complete: holes.length === 0,
    bytesBase64: holes.length ? null : encode(bytes),
    mappedFragments: holes.length ? pages.filter(p => p.mapped).map(p => ({ guest: p.guest,
      bytes: p.bytes, bytesBase64: encode(bytes.subarray(p.guest - fields.buffer, p.guest - fields.buffer + p.bytes)) })) : [],
    readOnly: true };
}
module.exports = { captureCrcBoundary };

if (require.main === module) {
  const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto');
  const id = process.argv[2];
  if (!/^20261019-dungeon-siege-[a-z0-9-]+$/.test(id || '')) throw new Error('Invalid run ID');
  const out = path.join('/home/user/wine-assembly/scratch/runs', id);
  const launch = JSON.parse(fs.readFileSync(path.join(out, 'launch.json')));
  if (!launch.captureCrc) throw new Error('Not a capture run');
  const target = path.join(out, 'crc-capture.json');
  if (fs.existsSync(target)) throw new Error('Preserve existing capture');
  const layout = require('../lib/region-map.generated');
  const code = '(' + captureCrcBoundary.toString() + ')(exports,memory,' + JSON.stringify(layout) + ',ctx,b=>Buffer.from(b).toString("base64"))';
  const body = JSON.stringify({ action: 'eval', code });
  let failed = false;
  const req = http.request({ hostname: '127.0.0.1', port: 8141, path: '/ctl', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
    const chunks = []; let count = 0;
    res.on('data', b => { count += b.length; if (count > 3 * 1024 ** 2) req.destroy(new Error('Capture reply exceeds 3MiB')); else chunks.push(b); });
    res.on('end', () => {
      if (failed) return;
      try {
        const reply = JSON.parse(Buffer.concat(chunks).toString());
        if (res.statusCode !== 200 || reply.ok !== true) throw new Error(JSON.stringify(reply));
        const result = reply.value;
        if (!result.readOnly || result.eip !== 0x00628d6a || result.fields.length !== 1836044) throw new Error('Invalid capture response');
        if (result.complete) {
          const bytes = Buffer.from(result.bytesBase64, 'base64');
          if (bytes.length !== 1836044 || result.holes.length) throw new Error('Invalid complete capture');
          fs.writeFileSync(path.join(out, 'crc-buffer.bin'), bytes, { flag: 'wx' });
          result.bufferArtifact = 'crc-buffer.bin'; result.sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
        } else {
          if (result.bytesBase64 !== null || !result.holes.length || result.capturedCrc !== null) throw new Error('Invalid hole capture');
          fs.writeFileSync(path.join(out, 'crc-mapped-fragments.json'), JSON.stringify(result.mappedFragments) + '\n', { flag: 'wx' });
          result.bufferArtifact = null; result.fragmentsArtifact = 'crc-mapped-fragments.json';
        }
        delete result.bytesBase64;
        delete result.mappedFragments;
        result.responseBytes = count;
        fs.writeFileSync(target, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
        console.log(JSON.stringify({ complete: result.complete, holes: result.holes.length, guestCrc: result.guestCrc, capturedCrc: result.capturedCrc, sha256: result.sha256 }));
      } catch (e) { console.error(e.message); process.exitCode = 1; }
    });
  });
  req.on('error', e => { failed = true; console.error(e.message); process.exitCode = 1; });
  req.setTimeout(10000, () => req.destroy(new Error('Capture timeout; no retry')));
  req.end(body);
}
