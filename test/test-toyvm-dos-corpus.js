#!/usr/bin/env node
'use strict';
// The original-DOS ToyVM corpus: the static executable scanner and the ToyVM
// assessment rules, on synthetic bytes and file lists (no payload, no
// emulator), plus -- only where the local payloads exist -- that the committed
// manifests are what the generator produces from them.
//   node test/test-toyvm-dos-corpus.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { scanDosExe } = require('../tools/dos-exe-scan');
const { assess, TOYVM_FACTS, applyEvidence } = require('../tools/toyvm-dos-corpus');

let n = 0, failed = 0;
const check = (name, fn) => { n++; try { fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}: ${e.message}`); } };

// An MZ image of `pages` 512-byte pages with optional text in the stub, an
// optional new-header pointer, and `tail` bytes appended past the image.
function mz({ pages = 2, stubText = '', lfanew = 0, sig = '', tail = '' } = {}) {
  const image = Buffer.alloc(pages * 512);
  image.write('MZ', 0, 'latin1'); image.writeUInt16LE(0, 2); image.writeUInt16LE(pages, 4);
  image.writeUInt16LE(lfanew ? 0x40 : 0x1c, 0x18);
  if (lfanew) { image.writeUInt32LE(lfanew, 0x3c); image.write(sig, lfanew, 'latin1'); }
  if (stubText) image.write(stubText, 0x80, 'latin1');
  return Buffer.concat([image, Buffer.from(tail, 'latin1')]);
}

check('a small .COM is real mode', () => {
  const r = scanDosExe(Buffer.from([0xb4, 0x4c, 0xcd, 0x21]), 'ULTIMA.COM');
  assert.strictEqual(r.kind, 'com'); assert.strictEqual(r.mode, 'real'); assert.strictEqual(r.extender, null);
});
check('a plain MZ with no overlay is real mode', () => {
  const r = scanDosExe(mz(), 'AVATAR.EXE');
  assert.strictEqual(r.mode, 'real'); assert.strictEqual(r.overlayBytes, 0);
});
check('the BOUND extender is the one in the stub; later names are mentions only', () => {
  const r = scanDosExe(mz({ stubText: 'CauseWay DOS Extender', tail: 'xx DOS/4G compatible' }), 'FALL.EXE');
  assert.deepStrictEqual([r.extender.id, r.extender.binding], ['causeway', 'bound']);
  assert.deepStrictEqual(r.extenderMentions, ['dos4gw']);
  assert.strictEqual(r.mode, 'protected (DOS extender)');
});
check('DOS/4GW stub mentioning Phar Lap: dos4gw bound, pharlap a mention', () => {
  const r = scanDosExe(mz({ stubText: 'DOS/4G Copyright Rational Systems', tail: 'requires the Phar Lap extender.' }), 'SW.EXE');
  assert.deepStrictEqual([r.extender.id, r.extender.binding, r.extenderMentions.join()], ['dos4gw', 'bound', 'pharlap']);
});
check('an LE program whose stub names no extender loads one externally', () => {
  const r = scanDosExe(mz({ lfanew: 0x200, sig: 'LE', tail: 'DOS/4G runtime text' }), 'K.EXE');
  assert.deepStrictEqual([r.newHeader.signature, r.extender.id, r.extender.binding], ['LE', 'dos4gw', 'external']);
});
check('a Windows PE (the GOG DOSBox.exe wrapper) is not a DOS program', () => {
  const r = scanDosExe(mz({ lfanew: 0x80, sig: 'PE', tail: 'x'.repeat(100) }), 'DOSBox.exe');
  assert.match(r.mode, /^not a DOS program \(PE\)$/);
});
check('a buffer too short for an MZ header is reported, not crashed on', () => {
  assert.strictEqual(scanDosExe(Buffer.from('MZ'), 'X.EXE').kind, 'unknown');
});

const title = (over = {}) => ({ id: 't', entry: { program: 'GAME.EXE' }, devices: {}, ...over });
const file = (p, size = 10) => ({ path: p, size });
const ids = (list) => list.map((b) => b.id);
const real = { name: 'GAME.EXE', mode: 'real', extender: null };
const pm = { name: 'GAME.EXE', mode: 'protected (DOS extender)', extender: { id: 'causeway', binding: 'bound' } };

check('flat real-mode program with no device needs: untested, never "works"', () => {
  const a = assess(title(), [file('GAME.EXE'), file('DATA.DAT')], { entry: real, others: [] });
  assert.strictEqual(a.status, 'untested'); assert.deepStrictEqual(ids(a.blockers), []);
  assert.match(a.verdict, /never been run on ToyVM. Untested; not a claim that it works/);
});
check('extender-bound entry: blocked, citing DPMI/VCPI/paging facts', () => {
  const a = assess(title(), [file('GAME.EXE')], { entry: pm, others: [] });
  assert.strictEqual(a.status, 'blocked'); assert.deepStrictEqual(ids(a.blockers), ['extender']);
  for (const f of ['no-dpmi', 'no-vcpi', 'paging', 'extenders-run']) assert.ok(a.blockers[0].facts.includes(f), f);
  assert.match(a.blockers[0].text, /CauseWay \(bound\)/);
});
check('basename collision across directories: blocked by the flat filesystem', () => {
  const a = assess(title(), [file('GAME.EXE'), file('A/MAP.DAT'), file('B/map.dat')], { entry: real, others: [] });
  assert.deepStrictEqual(ids(a.blockers), ['flat-fs-collision']); assert.deepStrictEqual(a.flatFs.collisions, ['MAP.DAT']);
});
check('subdirectories without collisions: a caution, not a blocker', () => {
  const a = assess(title(), [file('GAME.EXE'), file('SPEECH/A.VOC')], { entry: real, others: [] });
  assert.strictEqual(a.status, 'untested'); assert.ok(ids(a.cautions).includes('flat-fs-subdirs'));
});
check('CD-ROM, VBE 2.0 and MIDI requirements map to their facts', () => {
  const a = assess(title({ devices: { cdrom: true, cdImage: 'GAME.DAT', vbe2Lfb: true, midiMpu401: true } }), [file('GAME.EXE')], { entry: real, others: [] });
  assert.deepStrictEqual(ids(a.blockers), ['cdrom', 'vbe2']);
  assert.ok(ids(a.cautions).includes('midi')); assert.match(a.blockers[0].text, /disc image GAME\.DAT/);
});
check('a large payload is a preload caution (no on-demand reads)', () => {
  const a = assess(title(), [file('GAME.EXE', 100 * 1048576)], { entry: real, others: [] });
  assert.ok(ids(a.cautions).includes('preload-size'));
  assert.deepStrictEqual(a.cautions.find((c) => c.id === 'preload-size').facts, ['sync-reads']);
});
check('a missing entry program blocks', () => {
  assert.deepStrictEqual(ids(assess(title(), [file('OTHER.EXE')], { entry: null, others: [] }).blockers), ['entry-missing']);
});
check('every fact a rule cites exists in TOYVM_FACTS, with a source', () => {
  const a = assess(title({ devices: { cdrom: true, vbe2Lfb: true, midiMpu401: true } }), [file('GAME.EXE', 1e9), file('A/X'), file('B/X')], { entry: pm, others: [] });
  for (const b of [...a.blockers, ...a.cautions]) for (const f of b.facts) { assert.ok(TOYVM_FACTS[f], f); assert.ok(TOYVM_FACTS[f].cite); }
});

check('observed native failure replaces only its dated static hypothesis', () => {
  const base = assess(title(), [file('GAME.EXE'), file('A/X'), file('B/X')], { entry: pm, others: [] });
  const result = applyEvidence({ toyvmEvidence: [{ run: 'actual-run', at: '2026-10-07T09:51:12Z', reached: 'protected-mode-decode-loop', summary: 'Entered PM, repeated decoder failure.', observedBlocker: { replaces: 'extender', id: 'observed-pm-decode-loop', text: 'Exact descriptor cause unresolved.' } }] }, base);
  assert.deepStrictEqual(ids(result.blockers), ['observed-pm-decode-loop', 'flat-fs-collision']);
  assert.strictEqual(result.status, 'blocked'); assert.match(result.verdict, /Entered PM/);
  assert.ok(!/Not attempted/.test(result.verdict)); assert.strictEqual(base.blockers[0].id, 'extender');
  assert.strictEqual(result.blockers[0].sourceRun, 'actual-run');
  assert.deepStrictEqual(result.cautions.find(c => c.id === 'remaining-capabilities-extender').facts, base.blockers[0].facts);
  assert.ok(!base.cautions.some(c => c.id === 'remaining-capabilities-extender'));
});
check('a title screenshot never promotes gameplay or clears independent blockers', () => {
  const t = { toyvmEvidence: [{ run: 'menu-run', at: '2026-10-07', reached: 'main-menu', summary: 'Main menu only.' }] };
  const base = assess(title({ devices: { cdrom: true } }), [file('GAME.EXE')], { entry: real, others: [] });
  assert.strictEqual(applyEvidence(t, base).status, 'blocked');
  assert.deepStrictEqual(ids(applyEvidence(t, base).blockers), ['cdrom']);
  assert.throws(() => applyEvidence({ toyvmEvidence: [{ observedBlocker: {} }] }, base), /invalid observed/);
});

// Freshness, only where every payload is present on this machine.
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'toyvm-dos-corpus', 'manifest.json'), 'utf8'));
check('committed manifest never calls a title playable or working', () => {
  for (const t of manifest.titles) {
    assert.ok(['blocked', 'untested', 'unknown', 'reviewed-gameplay'].includes(t.toyvm.status), `${t.id}: ${t.toyvm.status}`);
    assert.ok(!/\b(playable|works)\b/i.test(t.toyvm.verdict.replace(/not a claim that it works/, '')), `${t.id}: ${t.toyvm.verdict}`);
  }
});
check('no entry program is a Windows DOSBox wrapper', () => {
  for (const t of manifest.titles) assert.ok(!/dosbox/i.test(t.entry.program), t.id);
});
const allPresent = manifest.titles.every((t) => fs.existsSync(path.join(__dirname, '..', t.gameDir)));
if (allPresent) {
  check('committed manifests match the payloads (tools/toyvm-dos-corpus.js --check)', () => {
    const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'toyvm-dos-corpus.js'), '--check'], { encoding: 'utf8', timeout: 300000 });
    assert.strictEqual(r.status, 0, r.stdout + r.stderr);
  });
} else console.log('skip freshness check: local payloads absent');

check('reviewed extender route preserves CD and filesystem blockers and source assessment', () => {
 const base = assess(title({devices:{cdrom:true}}), [file('GAME.EXE'),file('A/X'),file('B/X')], {entry:pm,others:[]});
 const e = {run:'scratch/runs/flight', summary:'Controlled flight.',reviewedGameplay:{reviewer:'root',build:{commit:'reference',runtimeBundleSha256:'a'.repeat(64)},limits:['FPS unknown; audio disabled'],resolves:['extender']}};
 const result = applyEvidence({toyvmEvidence:[e]},base);
 assert.deepStrictEqual(ids(result.blockers),['flat-fs-collision','cdrom']); assert.equal(result.status,'blocked');
 assert.equal(base.blockers[0].id,'extender'); assert.match(result.verdict,/reference/);
 const clear = applyEvidence({toyvmEvidence:[e]},assess(title(),[file('GAME.EXE')],{entry:pm,others:[]}));
 assert.equal(clear.status,'reviewed-gameplay'); assert.match(clear.verdict,/FPS unknown/);
 const startup={run:'new-startup',summary:'Registered startup only.',reached:'registered-startup'};
 assert.equal(applyEvidence({toyvmEvidence:[e,startup]},assess(title(),[file('GAME.EXE')],{entry:pm,others:[]})).status,'reviewed-gameplay');
 assert.throws(()=>applyEvidence({toyvmEvidence:[{...e,reviewedGameplay:{...e.reviewedGameplay,resolves:['cdrom']}}]},base),/invalid reviewed/);
});
check('selected insertion preserves every unrelated row',()=>{
 const {mergeSelectedManifest}=require('../tools/toyvm-dos-corpus');const old={id:'old',payload:{present:true}};
 const row={id:'new'};const result=mergeSelectedManifest({titles:[old]},{titles:[row]},['new']);
 assert.deepStrictEqual(result.titles,[old,row]);assert.equal(result.titles[0],old);
});
check('pinned originals reject byte/hash drift and missing or extra files',()=>{
 const {verifyOriginalFiles}=require('../tools/toyvm-dos-corpus');const f={path:'C3.EXE',size:2,sha256:'a'.repeat(64)};
 const t={id:'c3',originalFiles:[f]};verifyOriginalFiles(t,[f]);
 for(const files of [[],[f,{...f,path:'extra'}],[{...f,sha256:'b'.repeat(64)}],[{...f,size:3}]]) assert.throws(()=>verifyOriginalFiles(t,files),/original payload hash mismatch/);
});
console.log(`${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
