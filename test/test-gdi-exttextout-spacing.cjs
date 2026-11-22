'use strict';

// Microsoft WIN32.HLP 2460/3106: character extra is added to EACH character.
// 2138/3105: TA_UPDATECP uses and updates the current reference position.
// Compare successive runs with independently positioned public TextOut calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { bootRenderHarness } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated');

async function main() {
  const options = process.env.TEXT_LAYOUT_WASM
    ? { prebuiltModule: await WebAssembly.compile(fs.readFileSync(process.env.TEXT_LAYOUT_WASM)) } : {};
  const { exports: w, memory } = await bootRenderHarness(options);
  const bytes = new Uint8Array(memory.buffer);
  const wa = p => RegionMap.g2w(p, w.get_image_base() >>> 0);
  const alloc = n => { const p = w.guest_alloc(n) >>> 0; bytes.fill(0, wa(p), wa(p) + n); return p; };
  const width = 240, height = 40, failures = [], rows = [];
  const surface = () => {
    const bmi = alloc(40), out = alloc(4);
    w.guest_write32(bmi, 40); w.guest_write32(bmi + 4, width);
    w.guest_write32(bmi + 8, -height); w.guest_write16(bmi + 12, 1); w.guest_write16(bmi + 14, 32);
    const bitmap = w.test_call_CreateDIBSection(0, bmi, 0, out, 0, 0) >>> 0;
    const dc = w.test_call_CreateCompatibleDC(0) >>> 0;
    assert(bitmap && dc); w.test_call_SelectObject(dc, bitmap);
    w.test_gdi_dc_set_field(dc, 28, 1, 2); // TRANSPARENT, as in existing layout tests
    return { dc, bits: RegionMap.BASE.DIB_BACKING_BASE + (w.guest_read32(out) - 0x50000000) };
  };
  const actual = surface(), reference = surface();
  const ansi = alloc(8), wide = alloc(16), bang = alloc(4), size = alloc(8), dx = alloc(16);
  bytes.set(Buffer.from('WiM\0'), wa(ansi));
  [...'WiM'].forEach((c, i) => w.guest_write16(wide + 2 * i, c.charCodeAt(0)));
  bytes[wa(bang)] = 33;
  for (let i = 0; i < 4; i++) w.guest_write32(dx + 4 * i, 25);
  for (const faceName of ['Arial', 'MS Sans Serif']) {
    const face = alloc(64);
    [...faceName].forEach((c, i) => w.guest_write16(face + 2 * i, c.charCodeAt(0)));
    const font = w.test_call_CreateFontW(-16, 0, 0, 0, 400, 0, 0, 0, 0, 0, 0, 0, 0, face) >>> 0;
    assert(font); for (const s of [actual, reference]) w.test_call_SelectObject(s.dc, font);
    for (const isWide of [false, true]) for (const count of [0, 1, 3])
      for (const extra of [0, 4, -1]) for (const explicitDx of [false, true]) {
        const text = isWide ? wide : ansi;
        w.test_call_SetTextCharacterExtra(reference.dc, 0);
        assert.equal(w.test_call_GetTextExtentPoint32A(reference.dc, ansi, count, size), 1);
        const natural = w.guest_read32(size);
        const advance = explicitDx ? count * 25 : natural + count * extra;
        for (const s of [actual, reference]) {
          assert.equal(w.test_call_PatBlt(s.dc, 0, 0, width, height, 0x00f00021), 1);
          w.test_call_SetTextCharacterExtra(s.dc, extra);
        }
        w.test_gdi_dc_set_field(actual.dc, 32, 1, 0); // TA_LEFT | TA_TOP | TA_UPDATECP
        w.test_gdi_dc_set_field(reference.dc, 32, 0, 0);
        assert.equal(w.test_call_MoveToEx(actual.dc, 12, 8, 0), 1);
        assert.equal(w.test_call_MoveToEx(reference.dc, 90, 25, 0), 1);
        const call = isWide ? w.test_call_ExtTextOutW : w.test_call_ExtTextOutA;
        assert.equal(call(actual.dc, 190, 25, 0, 0, text, count, explicitDx ? dx : 0), 1);
        const x = w.test_gdi_dc_get_field(actual.dc, 12, 0);
        const y = w.test_gdi_dc_get_field(actual.dc, 16, 0);
        // TextOut is the separate public positioning oracle for the next run.
        assert.equal(call(reference.dc, 12, 8, 0, 0, text, count, explicitDx ? dx : 0), 1);
        assert.equal(w.test_call_TextOutA(actual.dc, 190, 25, bang, 1), 1);
        assert.equal(w.test_call_TextOutA(reference.dc, 12 + advance, 8, bang, 1), 1);
        assert.equal(w.test_gdi_dc_get_field(reference.dc, 12, 0), 90, 'TA_NOUPDATECP preserves x');
        assert.equal(w.test_gdi_dc_get_field(reference.dc, 16, 0), 25, 'TA_NOUPDATECP preserves y');
        const a = bytes.slice(actual.bits, actual.bits + width * height * 4);
        const b = bytes.slice(reference.bits, reference.bits + width * height * 4);
        const pixelsEqual = Buffer.from(a).equals(Buffer.from(b));
        const row = { faceName, isWide, count, extra, explicitDx, x, expectedX: 12 + advance, y, pixelsEqual };
        rows.push(row);
        if (x !== 12 + advance || y !== 8 || !pixelsEqual) failures.push(row);
        if (process.env.TEXT_LAYOUT_OUTPUT && faceName === 'Arial' && !isWide && count === 3 && extra === 4 && !explicitDx) {
          const { PNG } = require('pngjs');
          for (const [name, data] of [['actual', a], ['reference', b]]) {
            const png = new PNG({ width, height });
            for (let i = 0; i < data.length; i += 4) { png.data[i] = data[i + 2]; png.data[i + 1] = data[i + 1]; png.data[i + 2] = data[i]; png.data[i + 3] = 255; }
            fs.writeFileSync(process.env.TEXT_LAYOUT_OUTPUT + '-' + name + '.png', PNG.sync.write(png));
          }
        }
      }
  }
  if (process.env.TEXT_LAYOUT_OUTPUT) fs.writeFileSync(process.env.TEXT_LAYOUT_OUTPUT + '.json', JSON.stringify({ rows, failures }, null, 2));
  assert.deepEqual(failures, [], 'ordinary TA_UPDATECP must retain the final character extra before the next visible run');
  console.log('PASS 72 ANSI/UTF16 native-font spacing/current-position cases and independent public GDI pixel comparisons');
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { main };
