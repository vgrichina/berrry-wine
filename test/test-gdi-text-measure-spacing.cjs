'use strict';

// Microsoft WIN32.HLP 2464/2465: extent includes SetTextCharacterExtra.
// 3106: add the extra to EACH character, including break characters.
// 2463: ExPoint size is the whole string; dx describes the fitted prefixes.
// Ordinary MM_TEXT, ASCII A/W, no justification, explicit dx, or kerning.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { bootRenderHarness } = require('./render-helper');

const extraWat = ['GetTextExtentPointA', 'GetTextExtentPointW', 'SetBkMode',
  'SetTextAlign', 'GetCurrentPositionEx'].map(name => {
  const count = name.startsWith('GetTextExtent') ? 4 : 2;
  return `(func (export "spacing_${name}") (param ${Array(count).fill('i32').join(' ')}) (result i32)
    (local $saved i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (call $handle_${name} ${Array.from({length: 6}, (_, i) => i < count ? `(local.get ${i})` : '(i32.const 0)').join(' ')})
    (i32.store offset=16 (global.get $reg_base) (local.get $saved))
    (i32.load (global.get $reg_base)))`;
}).join('\n');

async function main() {
  const options = process.env.TEXT_MEASURE_WASM
    ? { prebuiltModule: await WebAssembly.compile(fs.readFileSync(process.env.TEXT_MEASURE_WASM)) }
    : { extraWat };
  const { exports: w, memory } = await bootRenderHarness(options);
  const bytes = new Uint8Array(memory.buffer);
  const wa = p => w.guest_to_wasm(p) >>> 0;
  const alloc = n => { const p = w.guest_alloc(n) >>> 0; bytes.fill(0, wa(p), wa(p) + n); return p; };
  const read = p => w.guest_read32(p) | 0;
  const string = (text, wide) => {
    const p = alloc((text.length + 1) * (wide ? 2 : 1));
    [...text].forEach((c, i) => wide ? w.guest_write16(p + 2 * i, c.charCodeAt(0)) : bytes[wa(p) + i] = c.charCodeAt(0));
    return p;
  };
  const width = 220, height = 40, canary = 0x1234abcd;
  const surface = () => {
    const bmi = alloc(40), out = alloc(4);
    w.guest_write32(bmi, 40); w.guest_write32(bmi + 4, width);
    w.guest_write32(bmi + 8, -height); w.guest_write16(bmi + 12, 1); w.guest_write16(bmi + 14, 32);
    const bitmap = w.test_call_CreateDIBSection(0, bmi, 0, out, 0, 0) >>> 0;
    const dc = w.test_call_CreateCompatibleDC(0) >>> 0;
    assert(bitmap && dc); w.test_call_SelectObject(dc, bitmap);
    w.spacing_SetBkMode(dc, 1); w.spacing_SetTextAlign(dc, 0);
    return { dc, bitmap, bits: wa(w.guest_read32(out) >>> 0) };
  };
  const actual = surface(), reference = surface();
  const storage = alloc(16), size = storage + 4, dxStorage = alloc(32), dx = dxStorage + 4;
  const fitStorage = alloc(12), fit = fitStorage + 4, metric = alloc(4), cp = alloc(8);
  const marker = string('|', false), rows = [], failures = [], fonts = [];
  let fitChecks = 0, widthControls = 0;
  const check = (condition, label, row) => { if (!condition) row.errors.push(label); };
  const reset = () => {
    for (let i = 0; i < 16; i += 4) w.guest_write32(storage + i, canary);
    for (let i = 0; i < 32; i += 4) w.guest_write32(dxStorage + i, canary);
    for (let i = 0; i < 12; i += 4) w.guest_write32(fitStorage + i, canary);
  };
  const guards = (row, count) => {
    for (const p of [storage, storage + 12, dxStorage, dx + count * 4, fitStorage, fitStorage + 8])
      check(read(p) === canary, 'output canary ' + p, row);
  };
  for (const faceName of ['Arial', 'MS Sans Serif']) {
    const font = w.test_call_CreateFontW(-16, 0, 0, 0, 400, 0, 0, 0, 0, 0, 0, 0, 0, string(faceName, true)) >>> 0;
    assert(font); fonts.push(font);
    for (const s of [actual, reference]) w.test_call_SelectObject(s.dc, font);
    for (const wide of [false, true]) for (const text of ['', 'W', 'WiM', 'W M', 'WiM ']) {
      const pointer = string(text, wide), chars = [...text];
      const getWidth = wide ? w.test_call_GetCharWidth32W : w.test_call_GetCharWidthA;
      w.test_call_SetTextCharacterExtra(reference.dc, 0);
      const advances = chars.map(c => {
        assert.equal(getWidth(reference.dc, c.charCodeAt(0), c.charCodeAt(0), metric), 1);
        return read(metric);
      });
      const point = w['spacing_GetTextExtentPoint' + (wide ? 'W' : 'A')];
      const point32 = w['test_call_GetTextExtentPoint32' + (wide ? 'W' : 'A')];
      const ex = w['test_call_GetTextExtentExPoint' + (wide ? 'W' : 'A')];
      const draw = w['test_call_TextOut' + (wide ? 'W' : 'A')];
      assert.equal(point32(reference.dc, pointer, chars.length, size), 1);
      assert.equal(read(size), advances.reduce((sum, n) => sum + n, 0), 'zero-extra ordinary run agrees with public raw widths');
      const baselineHeight = read(size + 4);
      for (const extra of [0, 4, -1]) {
        assert(advances.every(n => n + extra > 0), 'fit cases retain positive advances');
        let total = 0;
        const prefixes = advances.map(n => (total += n + extra));
        for (const kind of ['Point', 'Point32', 'ExPoint']) {
          const row = { faceName, wide, text, extra, kind, expectedWidth: total, errors: [] };
          w.test_call_SetTextCharacterExtra(actual.dc, extra);
          check(w.test_call_GetTextCharacterExtra(actual.dc) === extra, 'DC character-extra state', row);
          reset();
          const success = kind === 'ExPoint'
            ? ex(actual.dc, pointer, chars.length, 1000, fit, dx, size)
            : (kind === 'Point' ? point : point32)(actual.dc, pointer, chars.length, size);
          row.width = read(size); row.height = read(size + 4);
          check(success === 1, 'public BOOL', row);
          check(row.width === total && row.height === baselineHeight, 'SIZE', row);
          guards(row, chars.length);
          if (kind === 'ExPoint') {
            check(read(fit) === chars.length, 'all-fit count', row);
            for (let i = 0; i < chars.length; i++) check(read(dx + i * 4) === prefixes[i], 'all-fit dx ' + i, row);
            for (const max of new Set([0, total + 1, ...prefixes, ...prefixes.map(n => n - 1)])) {
              reset();
              check(ex(actual.dc, pointer, chars.length, max, fit, dx, size) === 1, 'bounded BOOL', row);
              const expectedFit = prefixes.filter(n => n <= max).length;
              check(read(fit) === expectedFit, 'fit at ' + max, row);
              check(read(size) === total && read(size + 4) === baselineHeight, 'whole SIZE at ' + max, row);
              // The historical contract specifies dx only for fitted characters.
              for (let i = 0; i < expectedFit; i++) check(read(dx + i * 4) === prefixes[i], 'fitted dx ' + i + ' at ' + max, row);
              guards(row, chars.length); fitChecks++;
            }
            for (const [fitOut, dxOut] of [[0, 0], [fit, 0], [0, dx]]) {
              reset();
              check(ex(actual.dc, pointer, chars.length, 0, fitOut, dxOut, size) === 1, 'optional outputs BOOL', row);
              check(read(size) === total && read(size + 4) === baselineHeight, 'optional outputs SIZE', row);
              if (fitOut) check(read(fit) === 0, 'optional fit', row);
              guards(row, chars.length);
            }
          }
          for (let i = 0; i < chars.length; i++) {
            assert.equal(getWidth(actual.dc, chars[i].charCodeAt(0), chars[i].charCodeAt(0), metric), 1);
            check(read(metric) === advances[i], 'raw glyph width ignores extra', row); widthControls++;
          }
          // Compare the measured endpoint and actual spaced run with independent
          // single-character TextOut calls at positions from public raw widths.
          // The marker makes final extra visible even for one/trailing-space runs.
          for (const s of [actual, reference]) {
            assert.equal(w.test_call_PatBlt(s.dc, 0, 0, width, height, 0x00ff0062), 1);
            assert.equal(w.test_call_MoveToEx(s.dc, 170, 28, 0), 1);
          }
          assert.equal(draw(actual.dc, 12, 8, pointer, chars.length), 1);
          w.test_call_SetTextCharacterExtra(reference.dc, 0);
          let x = 12;
          for (let i = 0; i < chars.length; i++) {
            assert.equal(draw(reference.dc, x, 8, pointer + i * (wide ? 2 : 1), 1), 1);
            x += advances[i] + extra;
          }
          w.test_call_SetTextCharacterExtra(actual.dc, 0);
          assert.equal(w.test_call_TextOutA(actual.dc, 12 + row.width, 8, marker, 1), 1);
          assert.equal(w.test_call_TextOutA(reference.dc, x, 8, marker, 1), 1);
          const a = Buffer.from(bytes.slice(actual.bits, actual.bits + width * height * 4));
          const b = Buffer.from(bytes.slice(reference.bits, reference.bits + width * height * 4));
          row.pixelsEqual = a.equals(b);
          check(row.pixelsEqual, 'whole independent public GDI rendered comparison', row);
          for (const s of [actual, reference]) {
            assert.equal(w.spacing_GetCurrentPositionEx(s.dc, cp), 1);
            check(read(cp) === 170 && read(cp + 4) === 28, 'NOUPDATECP preserves current position', row);
          }
          if (process.env.TEXT_MEASURE_OUTPUT && faceName === 'Arial' && !wide && text === 'WiM' && extra === 4 && kind === 'Point32') {
            const { PNG } = require('pngjs');
            for (const [name, data] of [['actual', a], ['reference', b]]) {
              const png = new PNG({width, height});
              for (let i = 0; i < data.length; i += 4) { png.data[i] = data[i + 2]; png.data[i + 1] = data[i + 1]; png.data[i + 2] = data[i]; png.data[i + 3] = 255; }
              fs.writeFileSync(process.env.TEXT_MEASURE_OUTPUT + '-' + name + '.png', PNG.sync.write(png));
            }
          }
          rows.push(row); if (row.errors.length) failures.push(row);
        }
      }
    }
  }
  for (const s of [actual, reference]) { w.test_call_DeleteDC(s.dc); w.test_call_DeleteObject(s.bitmap); }
  for (const font of fonts) w.test_call_DeleteObject(font);
  const result = {rows, failures, fitChecks, widthControls};
  if (process.env.TEXT_MEASURE_OUTPUT) fs.writeFileSync(process.env.TEXT_MEASURE_OUTPUT + '.json', JSON.stringify(result, null, 2));
  assert.deepEqual(failures, [], 'ordinary extents must include character extra for each character');
  console.log(`PASS ${rows.length} A/W Point/32/ExPoint cases; ${fitChecks} fit boundaries; ${widthControls} raw-width controls; independent whole public GDI pixels`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = {main, extraWat};
