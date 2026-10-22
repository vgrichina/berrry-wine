#!/usr/bin/env node

const assert = require('assert');
const path = require('path');
const fixture = process.argv.includes('--source-fixture');
const { createHostImports } = require(fixture ? './version-source-fixture' : '../lib/host-imports');
const { buildVersionBlob, buildVersionPe, findVersionBlob } = require('../tools/pe-version');
const { compileSrcWasm } = require(fixture ? './version-source-fixture' : './compile-src');

async function main() {
  const blob = buildVersionBlob([
    0xFEEF04BD, 0x00010000, 0x00050006,
    0x00070008, 0x0009000A, 0x000B000C,
  ]);
  const pe = buildVersionPe(blob);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null, resourceJson: {} };
  const imports = createHostImports(ctx);
  imports.host.memory = memory;
  imports.host.create_thread = () => 0;
  imports.host.exit_thread = () => 0;
  imports.host.terminate_thread = () => 0;
  imports.host.create_event = () => 0;
  imports.host.set_event = () => 0;
  imports.host.reset_event = () => 0;
  imports.host.wait_single = () => 0;
  imports.host.wait_multiple = () => 0;
  imports.host.com_create_instance = () => 0x80004002;
  ctx.vfs.files.set('c:\\windows\\temp\\version.dll', {
    data: new Uint8Array(pe), attrs: 0x20,
  });
  const bad = Buffer.from(pe);
  bad.writeUInt32LE(0x7FFFFFF0, 0x200 + 0x48);
  ctx.vfs.files.set('c:\\windows\\temp\\bad.dll', {
    data: new Uint8Array(bad), attrs: 0x20,
  });

  const wasm = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + `
    (func (export "query_wide") (param $block i32) (param $path i32)
        (param $out i32) (param $length i32) (result i32)
      (call $version_query (local.get $block) (local.get $path)
        (local.get $out) (local.get $length) (i32.const 1)))
  ` : source);
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const e = instance.exports;
  ctx.exports = e;
  const u8 = new Uint8Array(memory.buffer);
  const dv = new DataView(memory.buffer);
  const wa = gp => gp - e.get_image_base() + e.get_guest_base();

  function writeAscii(value) {
    const gp = e.guest_alloc(value.length + 1);
    for (let i = 0; i < value.length; i++) u8[wa(gp) + i] = value.charCodeAt(i);
    u8[wa(gp) + value.length] = 0;
    return gp;
  }

  function writeWide(value) {
    const gp = e.guest_alloc((value.length + 1) * 2);
    for (let i = 0; i < value.length; i++) dv.setUint16(wa(gp) + i * 2, value.charCodeAt(i), true);
    dv.setUint16(wa(gp) + value.length * 2, 0, true);
    return gp;
  }

  const ansiPath = writeAscii('C:\\Windows\\Temp\\Version.dll');
  const widePath = writeWide('C:\\Windows\\Temp\\Version.dll');
  const handleOut = e.guest_alloc(4);
  dv.setUint32(wa(handleOut), 0xDEADBEEF, true);
  assert.strictEqual(e.test_call_GetFileVersionInfoSizeA(ansiPath, handleOut), blob.length);
  assert.strictEqual(dv.getUint32(wa(handleOut), true), 0);
  assert.strictEqual(e.test_call_GetFileVersionInfoSizeW(widePath, 0), blob.length);

  const full = e.guest_alloc(blob.length);
  assert.strictEqual(e.test_call_GetFileVersionInfoA(ansiPath, 0, blob.length, full), 1);
  assert.deepStrictEqual(Buffer.from(u8.subarray(wa(full), wa(full) + blob.length)), blob);

  const shortLen = blob.length - 7;
  const short = e.guest_alloc(blob.length + 4);
  u8.fill(0xA5, wa(short), wa(short) + blob.length + 4);
  assert.strictEqual(e.test_call_GetFileVersionInfoW(widePath, 0, shortLen, short), 1);
  assert.deepStrictEqual(Buffer.from(u8.subarray(wa(short), wa(short) + shortLen)), blob.subarray(0, shortLen));
  assert.deepStrictEqual(Array.from(u8.subarray(wa(short) + shortLen, wa(short) + blob.length + 4)),
    new Array(11).fill(0xA5));

  assert.strictEqual(e.test_call_GetFileVersionInfoSizeA(writeAscii('C:\\missing.dll'), 0), 0);
  assert.strictEqual(e.test_call_GetFileVersionInfoSizeA(writeAscii('C:\\Windows\\Temp\\bad.dll'), 0), 0);

  // A genuine hierarchy with two languages and binary translations. String
  // values differ from the fixed version: NFS III queries FileVersion text.
  const align = n => (n + 3) & ~3;
  function node(key, type, value, children = []) {
    const keyBytes = Buffer.from(key + '\0', 'utf16le');
    const valueAt = align(6 + keyBytes.length);
    let size = valueAt + value.length;
    for (const child of children) size = align(size) + child.length;
    const out = Buffer.alloc(size);
    out.writeUInt16LE(size, 0);
    out.writeUInt16LE(type === 1 ? value.length / 2 : value.length, 2);
    out.writeUInt16LE(type, 4);
    keyBytes.copy(out, 6);
    value.copy(out, valueAt);
    let at = valueAt + value.length;
    for (const child of children) { at = align(at); child.copy(out, at); at += child.length; }
    return out;
  }
  const textNode = (key, value) => node(key, 1, Buffer.from(value + '\0', 'utf16le'));
  const empty = Buffer.alloc(0);
  const tree = node('VS_VERSION_INFO', 0, blob.subarray(40), [
    node('StringFileInfo', 1, empty, [
      node('040904B0', 1, empty, [textNode('FileVersion', '-1, -1.-1'),
        textNode('ProductName', 'Demo racer')]),
      node('040C04B0', 1, empty, [textNode('ProductName', 'Course')]),
    ]),
    node('VarFileInfo', 1, empty, [node('Translation', 0, Buffer.from([9, 4, 176, 4, 12, 4, 176, 4]))]),
  ]);
  const resource = e.guest_alloc(tree.length);
  u8.set(tree, wa(resource));
  const outPtr = e.guest_alloc(4), outLen = e.guest_alloc(4);
  function query(sub) {
    const ok = e.test_call_VerQueryValueA(resource, writeAscii(sub), outPtr, outLen);
    const count = dv.getUint32(wa(outLen), true);
    const ptr = dv.getUint32(wa(outPtr), true);
    return { ok, count, ptr, text: ok ? Buffer.from(u8.subarray(wa(ptr), wa(ptr) + count)).toString('latin1') : '' };
  }
  let q = query('\\stringfileinfo\\040904b0\\fileversion');
  assert.strictEqual(q.ok, 1);
  assert.strictEqual(q.text, '-1, -1.-1\0');
  assert.strictEqual(q.count, 10, 'ANSI string length includes terminator');
  assert.strictEqual(query('\\StringFileInfo\\040904B0\\ProductName').text, 'Demo racer\0');
  assert.strictEqual(query('\\StringFileInfo\\040C04B0\\ProductName').text, 'Course\0');
  // Answers stay valid together: Crusaders of Might and Magic keeps the
  // FileVersion pointer, asks for CompanyName, then compares FileVersion.
  const held = query('\\StringFileInfo\\040904B0\\FileVersion');
  query('\\StringFileInfo\\040904B0\\ProductName');
  assert.strictEqual(Buffer.from(u8.subarray(wa(held.ptr), wa(held.ptr) + held.count)).toString('latin1'),
    '-1, -1.-1\0', 'a later ANSI query must not overwrite an earlier answer');
  q = query('\\VarFileInfo\\Translation');
  assert.strictEqual(q.count, 8, 'real translation array, not a canned language');
  assert.deepStrictEqual(Buffer.from(u8.subarray(wa(q.ptr), wa(q.ptr) + q.count)), Buffer.from([9, 4, 176, 4, 12, 4, 176, 4]));
  q = query('\\');
  assert.strictEqual(q.ptr, resource + 40);
  assert.strictEqual(q.count, 52);
  q = query('\\StringFileInfo\\040904B0\\Missing');
  assert.strictEqual(q.ok, 0);
  assert.strictEqual(q.count, 0);
  assert.deepStrictEqual(Buffer.from(u8.subarray(wa(resource), wa(resource) + tree.length)), tree,
    'ANSI queries must not corrupt the UTF-16 source');
  assert.strictEqual(e.query_wide(resource, writeWide('\\StringFileInfo\\040C04B0\\ProductName'), outPtr, outLen), 1);
  const wideResult = dv.getUint32(wa(outPtr), true);
  assert(wideResult >= resource && wideResult < resource + tree.length);
  assert.strictEqual(Buffer.from(u8.subarray(wa(wideResult), wa(wideResult) + 14)).toString('utf16le'), 'Course\0');
  assert.strictEqual(dv.getUint32(wa(outLen), true), 7, 'wide string length is characters, not bytes');

  // VB5/VB6 write a text node's wValueLength in BYTES (JigSawedME.exe:
  // ProductName "JigSawedME" has wValueLength 0x16). Doubled, it runs past
  // wLength; Windows bounds the value by the node and still answers. Failing
  // here left App.ProductName empty and GetSetting raised VB error 5.
  const vbText = (key, value) => {
    const n = textNode(key, value);
    n.writeUInt16LE((value.length + 1) * 2, 2);
    return n;
  };
  const vbTree = node('VS_VERSION_INFO', 0, blob.subarray(40), [
    node('StringFileInfo', 1, empty, [
      node('040904B0', 1, empty, [vbText('CompanyName', 'Michael D. Cook'),
        vbText('ProductName', 'JigSawedME')]),
    ]),
    node('VarFileInfo', 1, empty, [node('Translation', 0, Buffer.from([9, 4, 176, 4]))]),
  ]);
  const vbRes = e.guest_alloc(vbTree.length);
  u8.set(vbTree, wa(vbRes));
  const vbQuery = sub => {
    const ok = e.test_call_VerQueryValueA(vbRes, writeAscii(sub), outPtr, outLen);
    const count = dv.getUint32(wa(outLen), true);
    const ptr = dv.getUint32(wa(outPtr), true);
    return { ok, count, text: ok ? Buffer.from(u8.subarray(wa(ptr), wa(ptr) + count)).toString('latin1') : '' };
  };
  q = vbQuery('\\StringFileInfo\\040904b0\\ProductName');
  assert.strictEqual(q.ok, 1, 'byte-count wValueLength must not reject the node');
  assert.strictEqual(q.text, 'JigSawedME\0');
  assert.strictEqual(q.count, 11, 'length stops at the terminator, not the doubled byte count');
  assert.strictEqual(vbQuery('\\StringFileInfo\\040904b0\\CompanyName').text, 'Michael D. Cook\0');
  assert.strictEqual(e.query_wide(vbRes, writeWide('\\StringFileInfo\\040904B0\\ProductName'), outPtr, outLen), 1);
  assert.strictEqual(dv.getUint32(wa(outLen), true), 11);
  assert.deepStrictEqual(Buffer.from(u8.subarray(wa(vbRes), wa(vbRes) + vbTree.length)), vbTree);

  // A zero-sized child must fail rather than looping forever or fabricating a value.
  dv.setUint16(wa(resource) + 92, 0, true);
  assert.strictEqual(query('\\StringFileInfo\\040904B0\\FileVersion').ok, 0);
  const nativeArg = process.argv.find(a => a.startsWith('--native-dir='));
  if (nativeArg) {
    const fs = require('fs');
    const dir = nativeArg.slice('--native-dir='.length);
    for (const name of ['dsetup.dll', 'dsetup32.dll', 'd3dconfigutility.exe']) {
      const native = fs.readFileSync(path.join(dir, name));
      const actual = findVersionBlob(native);
      if (name !== 'd3dconfigutility.exe') assert(actual, `${name} has an authentic version resource`);
      // Deliberately use the name the native Win9x detector reads. The source
      // bytes are the sealed setup/config files, not a claimed DDRAW runtime.
      const file = 'c:\\windows\\system\\ddraw.dll';
      ctx.vfs.files.set(file, {data: native, attrs: 0x20});
      for (const wide of [false, true]) {
        const gp = wide ? writeWide(file) : writeAscii(file);
        const suffix = wide ? 'W' : 'A';
        if (!actual) {
          assert.strictEqual(e['test_call_GetFileVersionInfoSize' + suffix](gp, 0), 0);
          const out = e.guest_alloc(96);
          u8.fill(0xa5, wa(out), wa(out) + 96);
          assert.strictEqual(e['test_call_GetFileVersionInfo' + suffix](gp, 0, 92, out), 0);
          assert(u8.subarray(wa(out), wa(out) + 96).every(v => v === 0xa5));
          continue;
        }
        assert.strictEqual(e['test_call_GetFileVersionInfoSize' + suffix](gp, 0), actual.length);
        const out = e.guest_alloc(actual.length + 4);
        u8.fill(0xa5, wa(out), wa(out) + actual.length + 4);
        assert.strictEqual(e['test_call_GetFileVersionInfo' + suffix](gp, 0, actual.length, out), 1);
        assert.deepStrictEqual(Buffer.from(u8.subarray(wa(out), wa(out) + actual.length)), actual,
          `${name} ${suffix}: actual resource bytes, no inferred capability/version`);
        assert(u8.subarray(wa(out) + actual.length, wa(out) + actual.length + 4).every(v => v === 0xa5));
        assert.strictEqual(e.test_call_VerQueryValueA(out, writeAscii('\\'), outPtr, outLen), 1);
        assert.strictEqual(dv.getUint32(wa(outLen), true), 52);
      }
    }
    console.log('PASS authentic setup/config RT_VERSION bytes through DDRAW path, A/W exact copy and root query; no runtime capability claim');
  }
  console.log('PASS file-backed GetFileVersionInfo A/W resource lookup');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
