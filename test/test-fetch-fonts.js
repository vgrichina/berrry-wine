#!/usr/bin/env node
'use strict';

// tools/fetch-fonts.js without the network: the optional CP950 Ming face.
//
// 1. optionalFontMounts: nothing for a Western app, nothing when no candidate
//    exists, and the user's MINGLIU.TTC ahead of the AR PL UMing TW stand-in.
// 2. The build path on the CC0 fixtures in test/fixtures/ttc-ebdt/: extract
//    collection faces by verified name, subset to CP950 with the existing
//    `keep` strike policy (EBLC/EBDT survive), rename into the MingLiU /
//    PMingLiU stand-in collection, byte-identical on rebuild. Needs fontTools;
//    without it this part is reported as SKIP, never as a pass.
// 3. Through the emulator: with no fetched face, "MingLiU" falls back to the
//    default face and Western faces are untouched; with the stand-in mounted
//    at C:\WINDOWS\FONTS\MINGLIU.TTC, MingLiU / PMingLiU / 細明體 / 新細明體
//    select its two faces and 12px draws the embedded strike, not the outline.
//
// `--fetched` additionally checks the real fonts/fetched/ output (after
// `node tools/fetch-fonts.js`): faces resolve by all four names and CJK glyphs
// have 1-bit strikes at 11-16 px. FETCHED_REFERENCE=<json> compares strike
// pixels with an independent decode ([{code, ppem, width, height, left, top,
// pixels}]).

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { bootRenderHarness } = require('./render-helper');
const {
  optionalFontMounts, fetchedAvailability, FETCHED_MANIFEST,
} = require('../lib/font-substitutions');
const ff = require('../tools/fetch-fonts');

const ROOT = path.join(__dirname, '..');
const FIX = path.join(__dirname, 'fixtures', 'ttc-ebdt');
const SUBSET_SCRIPT = path.join(ROOT, 'tools', 'gen-font-subsets.sh');
const CHECKER = ['10101', '01010', '11111', '01010', '10101'];
const WANT_FETCHED = process.argv.includes('--fetched');

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'fonts', 'substitutions.json'), 'utf8'));

// ---- 1. mount selection -------------------------------------------------
{
  const all = () => true, none = () => false;
  assert.deepStrictEqual(optionalFontMounts(manifest, { codePage: 0, isAvailable: all }), [],
    'the CP1252 default never mounts optional faces');
  assert.deepStrictEqual(optionalFontMounts(manifest, { codePage: 1252, isAvailable: all }), []);
  assert.deepStrictEqual(optionalFontMounts(manifest, { codePage: 950, isAvailable: none }), [],
    'absent fetched fonts mount nothing');
  const both = optionalFontMounts(manifest, { codePage: 950, isAvailable: all });
  assert.strictEqual(both.length, 1);
  assert.strictEqual(both[0].vfsPath, 'c:\\windows\\fonts\\mingliu.ttc');
  assert.strictEqual(both[0].file, 'fetched/mingliu.ttc', 'user MINGLIU.TTC wins');
  const open = optionalFontMounts(manifest, { codePage: 950,
    isAvailable: fetchedAvailability({ files: { 'mingliu-uming.ttc': {} } }) });
  assert.strictEqual(open[0].file, 'fetched/mingliu-uming.ttc', 'else the UMing stand-in');
  assert.deepStrictEqual(optionalFontMounts(manifest, { codePage: 950,
    isAvailable: fetchedAvailability(null) }), [], 'missing fetched.json mounts nothing');
  assert.strictEqual(FETCHED_MANIFEST, 'fetched/fetched.json');
  console.log('PASS optional CP950 mounts: code-page gated, absent-safe, user MingLiU first');
}

const haveFontTools = spawnSync('python3', ['-c', 'import fontTools'], { stdio: 'ignore' }).status === 0;
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-test-fetch-fonts-'));
const out = path.join(work, 'out');
fs.mkdirSync(out);
let standIn = null;

// ---- 2. build path on the fixtures -------------------------------------
if (!haveFontTools) {
  console.log('SKIP build path: fontTools not installed (pip install fonttools)');
} else {
  const log = () => {};
  // User path: both faces of a collection, chosen by name, strikes kept.
  const user = ff.buildUserCollection({ src: path.join(FIX, 'faces.ttc'), out, work, log,
    subsetScript: SUBSET_SCRIPT, expect: ['Fixture Bitmap', 'Fixture Other'],
    destName: 'mingliu.ttc' });
  const ub = fs.readFileSync(user);
  const uOff = ff.faceOffsets(ub);
  assert.deepStrictEqual(uOff.map(o => ff.familyName(ub, o)), ['Fixture Bitmap', 'Fixture Other']);
  assert.deepStrictEqual(ff.strikeSizes(ub, uOff[0]).map(s => s.ppemY), [12],
    'EBLC strike survives the CP950 subset');
  assert.ok(ff.sfntTables(ub, uOff[0]).has('EBDT'));
  assert.throws(() => ff.buildUserCollection({ src: path.join(FIX, 'faces.ttc'), out, work, log,
    subsetScript: SUBSET_SCRIPT }), /no face named "MingLiU"/, 'faces are verified by name');

  // Stand-in path: one subset face renamed into the MingLiU/PMingLiU pair.
  const sub = path.join(work, 'bitmap-cp950.ttf');
  ff.subsetCp950(path.join(FIX, 'bitmap.ttf'), sub, SUBSET_SCRIPT);
  const notice = 'Modified for test-fetch-fonts.js';
  standIn = ff.buildStandIn({ subset: sub, dest: path.join(out, 'mingliu-uming.ttc'), notice, work });
  const sb = fs.readFileSync(standIn);
  const sOff = ff.faceOffsets(sb);
  assert.deepStrictEqual(sOff.map(o => ff.familyName(sb, o)), ['MingLiU', 'PMingLiU']);
  for (const [i, local] of [[0, '細明體'], [1, '新細明體']]) {
    const recs = ff.nameRecords(sb, sOff[i]);
    assert.ok(recs.some(r => r.nameId === 1 && r.language === 0x404 && r.text === local), local);
    assert.ok(recs.some(r => r.nameId === 10 && r.text === notice), 'APL 2(a) notice');
    assert.ok(!recs.some(r => r.nameId === 1 && r.text === 'Fixture Bitmap'), 'old family gone');
    assert.deepStrictEqual(ff.strikeSizes(sb, sOff[i]).map(s => s.ppemY), [12]);
  }
  const shared = ff.sfntTables(sb, sOff[0]).get('EBDT').offset;
  assert.strictEqual(ff.sfntTables(sb, sOff[1]).get('EBDT').offset, shared,
    'the two faces share their tables');
  const again = ff.buildStandIn({ subset: sub, dest: path.join(work, 'again.ttc'), notice, work });
  assert.ok(fs.readFileSync(again).equals(sb), 'rebuild is byte-identical');

  const listing = ff.writeManifest(out);
  assert.deepStrictEqual(Object.keys(listing.files).sort(), ['mingliu-uming.ttc', 'mingliu.ttc']);
  assert.deepStrictEqual(listing.files['mingliu-uming.ttc'].strikes, [12]);
  const picked = optionalFontMounts(manifest, { codePage: 950,
    isAvailable: fetchedAvailability(listing) });
  assert.strictEqual(picked[0].file, 'fetched/mingliu.ttc');
  const firstListing = fs.readFileSync(path.join(out, 'fetched.json'));
  ff.writeManifest(out);
  assert.ok(fs.readFileSync(path.join(out, 'fetched.json')).equals(firstListing));
  console.log('PASS build path: verified face extraction, CP950 subset keeps EBLC/EBDT, ' +
    'MingLiU/PMingLiU stand-in, deterministic output and listing');
}

// ---- 3. through the emulator -------------------------------------------
(async () => {
  const { exports: w, memory, hostCtx } = await bootRenderHarness({ extraWat: `
    (func (export "fixture_register") (param i32) (result i32) (call $tt_reg_add (local.get 0)))
    (func (export "fixture_remove") (param i32) (result i32) (call $tt_reg_remove (local.get 0)))
    (func (export "fixture_index") (param i32) (result i32)
      (i32.load offset=44 (call $tt_face_record (local.get 0))))
    (func (export "fixture_data") (param i32) (result i32) (call $tt_face_data (local.get 0)))
    (func (export "fixture_lookup") (param i32 i32 i32 i32 i32) (result i32)
      (call $tt_sbit_lookup (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4)))
    (func (export "fixture_glyph") (param i32 i32 i32) (result i32)
      (call $tt_glyph_ensure (local.get 0) (local.get 1) (local.get 2)))
  ` });
  const b = new Uint8Array(memory.buffer), wa = p => w.guest_to_wasm(p) >>> 0;
  const alloc = n => { const p = w.guest_alloc(n) >>> 0; assert(p); b.fill(0, wa(p), wa(p) + n); return p; };
  const str = s => { const p = alloc(s.length + 1); b.set(Buffer.from(s, 'latin1'), wa(p)); return p; };
  const wide = s => { const p = alloc((s.length + 1) * 2); b.set(Buffer.from(s + '\0', 'utf16le'), wa(p)); return p; };
  const faceFor = name => w.test_tt_face_for_logfont(wa(str(name)), 400, 0);
  const dc = w.test_call_CreateCompatibleDC(0) >>> 0;
  const faceOfW = name => {
    const font = w.test_call_CreateFontW(-12, 0, 0, 0, 400, 0, 0, 0, 0, 0, 0, 0, 0, wide(name)) >>> 0;
    assert(font, name);
    w.test_call_SelectObject(dc, font);
    const len = w.test_call_GetFontData(dc, 0x66637474, 0, 0, 0) >>> 0;
    return len;
  };

  // Absent: what every host does today, and what a Western app always gets.
  const mounted = optionalFontMounts(manifest, { codePage: 950, isAvailable: () => false });
  assert.deepStrictEqual(mounted, []);
  const arial = faceFor('Arial');
  assert(arial >= 0);
  assert.strictEqual(faceFor('MingLiU'), arial, 'no fetched face: MingLiU uses the default face');
  assert.strictEqual(faceFor('PMingLiU'), arial);
  const arialA = w.test_tt_face_glyph(arial, 65, 12) >>> 0;
  assert(arialA && w.test_tt_entry_height(arialA) > 0, 'Western glyphs draw');
  console.log('PASS absent fallback: MingLiU resolves to the default face, Arial unaffected');

  if (!standIn) {
    console.log('SKIP emulator stand-in check: no fixture stand-in was built (fontTools)');
  } else {
    const vfsPath = optionalFontMounts(manifest, { codePage: 950, isAvailable: () => true })[0].vfsPath;
    hostCtx.vfs.files.set(vfsPath, { data: new Uint8Array(fs.readFileSync(standIn)), attrs: 0x20 });
    // The directory scan already ran (above, with nothing there); register the
    // way the scan would have.
    assert.strictEqual(w.fixture_register(str(vfsPath)), 2, 'two faces registered');
    const ming = faceFor('MingLiU'), pming = faceFor('PMingLiU');
    assert(ming >= 0 && pming >= 0 && ming !== pming && ming !== arial);
    assert.strictEqual(w.fixture_index(ming), 0);
    assert.strictEqual(w.fixture_index(pming), 1);
    const sb = fs.readFileSync(standIn);
    for (const name of ['MingLiU', '細明體', 'PMingLiU', '新細明體']) {
      assert.strictEqual(faceOfW(name), sb.length, `${name} selects the collection`);
    }
    for (const code of 'ABCDEG') {
      const g = w.test_tt_face_glyph(ming, code.charCodeAt(0), 12) >>> 0;
      assert(g);
      assert.strictEqual(w.test_tt_entry_width(g), 5, code);
      assert.strictEqual(w.test_tt_entry_height(g), 5, code);
      for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
        assert.strictEqual(w.test_tt_entry_pixel(g, x, y), Number(CHECKER[y][x]), `${code} ${x},${y}`);
      }
    }
    assert.notStrictEqual(w.test_tt_entry_height(w.test_tt_face_glyph(ming, 65, 13) >>> 0), 5,
      '13px has no strike and uses the outline');
    console.log('PASS stand-in mounted as MINGLIU.TTC: four names, two faces, 12px strike pixels');
    // Uninstall it so --fetched below sees only the real face by these names.
    assert.strictEqual(w.fixture_remove(str(vfsPath)), 1);
    hostCtx.vfs.files.delete(vfsPath);
    assert.strictEqual(faceFor('MingLiU'), arial, 'removal restores the fallback');
  }

  if (WANT_FETCHED) {
    const rels = optionalFontMounts(manifest, { codePage: 950,
      isAvailable: rel => fs.existsSync(path.join(ROOT, 'fonts', rel)) });
    assert.strictEqual(rels.length, 1, 'fonts/fetched has no CP950 face: run node tools/fetch-fonts.js');
    const file = path.join(ROOT, 'fonts', rels[0].file);
    const raw = fs.readFileSync(file);
    const p = 'c:\\windows\\fonts\\fetched-mingliu.ttc';
    hostCtx.vfs.files.set(p, { data: new Uint8Array(raw), attrs: 0x20 });
    assert.strictEqual(w.fixture_register(str(p)), 2);
    const face = faceFor('MingLiU');
    assert(face >= 0 && face !== arial);
    for (const name of ['MingLiU', '細明體', 'PMingLiU', '新細明體']) {
      assert.strictEqual(faceOfW(name), raw.length, name);
    }
    const data = w.fixture_data(face) >>> 0, size = w.test_tt_face_size(face) >>> 0;
    const look = alloc(32);
    const sample = [...'中文字體明細新'].map(c => c.codePointAt(0));
    for (const code of sample) {
      const gid = w.test_tt_glyph_index(data, size, code);
      assert(gid > 0, `U+${code.toString(16)} mapped`);
      for (let ppem = 11; ppem <= 16; ppem++) {
        assert(w.fixture_lookup(data, size, gid, ppem, wa(look)), `strike U+${code.toString(16)} ${ppem}px`);
        const g = w.fixture_glyph(face, gid, ppem) >>> 0;
        assert(g);
        assert.strictEqual(w.test_tt_entry_width(g), w.guest_read32(look), 'strike width');
        assert.strictEqual(w.test_tt_entry_height(g), w.guest_read32(look + 4), 'strike height');
      }
      assert.strictEqual(w.fixture_lookup(data, size, gid, 17, wa(look)), 0, '17px uses outlines');
    }
    let compared = 0;
    if (process.env.FETCHED_REFERENCE) {
      for (const ref of JSON.parse(fs.readFileSync(process.env.FETCHED_REFERENCE, 'utf8'))) {
        const gid = w.test_tt_glyph_index(data, size, ref.code);
        const g = w.fixture_glyph(face, gid, ref.ppem) >>> 0;
        assert.deepStrictEqual([w.test_tt_entry_width(g), w.test_tt_entry_height(g),
          w.test_tt_entry_left(g), w.test_tt_entry_top(g)], [ref.width, ref.height, ref.left, ref.top],
          `U+${ref.code.toString(16)} ${ref.ppem}px metrics`);
        const bits = [];
        for (let y = 0; y < ref.height; y++) for (let x = 0; x < ref.width; x++) bits.push(w.test_tt_entry_pixel(g, x, y));
        assert.deepStrictEqual(bits, ref.pixels, `U+${ref.code.toString(16)} ${ref.ppem}px pixels`);
        compared++;
      }
    }
    console.log(`PASS fetched ${rels[0].file}: ${raw.length} bytes, four names, ` +
      `${sample.length} CJK glyphs with strikes at 11-16 px` +
      (compared ? `, ${compared} strike images match the reference` : ''));
  }
  fs.rmSync(work, { recursive: true, force: true });
})().catch(err => {
  fs.rmSync(work, { recursive: true, force: true });
  console.error(err);
  process.exit(1);
});
