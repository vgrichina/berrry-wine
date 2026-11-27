'use strict';
// lib/app-files.js applyIniSet: the registry's `iniSet` edits to a mounted INI
// (Deus Ex's renderer choice). Keys are replaced in place, case-insensitively,
// missing keys and sections are appended, and every other byte survives.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { applyIniSet } = require('../lib/app-files');

const bytes = text => Uint8Array.from(text, c => c.charCodeAt(0));
const text = arr => String.fromCharCode(...arr);

const ini = '[URL]\r\nProtocol=unreal\r\n\r\n[Engine.Engine]\r\n' +
  'GameRenderDevice=SoftDrv.SoftwareRenderDevice\r\nAudioDevice=Galaxy\r\n' +
  'renderdevice=SoftDrv.SoftwareRenderDevice\r\n\r\n[Core.System]\r\nPurgeCacheDays=30\xe9\r\n';
const out = text(applyIniSet(bytes(ini), {
  'Engine.Engine': {
    GameRenderDevice: 'D3DDrv.D3DRenderDevice',
    RenderDevice: 'D3DDrv.D3DRenderDevice',
    WindowedRenderDevice: 'D3DDrv.D3DRenderDevice',
  },
  'D3DDrv.D3DRenderDevice': { UseFullscreen: 'False' },
}));
assert.strictEqual(out,
  '[URL]\r\nProtocol=unreal\r\n\r\n[Engine.Engine]\r\n' +
  'GameRenderDevice=D3DDrv.D3DRenderDevice\r\nAudioDevice=Galaxy\r\n' +
  'RenderDevice=D3DDrv.D3DRenderDevice\r\nWindowedRenderDevice=D3DDrv.D3DRenderDevice\r\n\r\n' +
  '[Core.System]\r\nPurgeCacheDays=30\xe9\r\n\r\n[D3DDrv.D3DRenderDevice]\r\nUseFullscreen=False\r\n');

// An empty edit is the identity, byte for byte (Latin-1 included).
assert.strictEqual(text(applyIniSet(bytes(ini), {})), ini);
// LF-only files stay LF-only.
assert.strictEqual(text(applyIniSet(bytes('[A]\nk=1\n'), { A: { k: '2' } })), '[A]\nk=2\n');

// Literal byte expectations through the public export: no newline normalization,
// including in untouched sections. New lines use CRLF when present, else LF.
const delimiterCases = [
  ['mixed case-insensitive edit', ';caf\xe9\r\n[VIDEO]\r\nHW_TYPE=1\n\r\n[Other]\nName=\xff\xe9\n',
    { video: { hw_type: '0' } }, ';caf\xe9\r\n[VIDEO]\r\nhw_type=0\n\r\n[Other]\nName=\xff\xe9\n'],
  ['mixed identity', '[A]\r\nk=\xe9\n[Other]\nName=\xff\r\n', {}, '[A]\r\nk=\xe9\n[Other]\nName=\xff\r\n'],
  ['CRLF identity', '[A]\r\nk=\xe9\r\n', {}, '[A]\r\nk=\xe9\r\n'],
  ['LF identity', '[A]\nk=\xe9\n', {}, '[A]\nk=\xe9\n'],
  ['CRLF case-insensitive edit', '[A]\r\nK=1\r\n', { a: { k: '2' } }, '[A]\r\nk=2\r\n'],
  ['LF case-insensitive edit', '[A]\nK=1\n', { a: { k: '2' } }, '[A]\nk=2\n'],
  ['mixed insertion before blanks', '[A]\r\nx=\xe9\n\r\n \n[Other]\nName=\xff',
    { a: { k: '2', j: '3' } }, '[A]\r\nx=\xe9\nk=2\r\nj=3\r\n\r\n \n[Other]\nName=\xff'],
  ['CRLF insertion before blanks', '[A]\r\nx=1\r\n\r\n[Other]\r\ny=2\r\n',
    { A: { k: '2' } }, '[A]\r\nx=1\r\nk=2\r\n\r\n[Other]\r\ny=2\r\n'],
  ['LF insertion before blanks', '[A]\nx=1\n\n[Other]\ny=2\n',
    { A: { k: '2' } }, '[A]\nx=1\nk=2\n\n[Other]\ny=2\n'],
  ['mixed missing section', '[Other]\r\nName=\xe9\n', { A: { k: '2' } },
    '[Other]\r\nName=\xe9\n\r\n[A]\r\nk=2\r\n'],
  ['CRLF missing section', '[Other]\r\nName=\xe9\r\n', { A: { k: '2' } },
    '[Other]\r\nName=\xe9\r\n\r\n[A]\r\nk=2\r\n'],
  ['LF missing section', '[Other]\nName=\xe9\n', { A: { k: '2' } },
    '[Other]\nName=\xe9\n\n[A]\nk=2\n'],
  ['unterminated identity', '[A]\r\nk=\xe9\n[Other]', {}, '[A]\r\nk=\xe9\n[Other]'],
  ['unterminated replacement', '[A]\r\nK=1', { a: { k: '2' } }, '[A]\r\nk=2'],
  ['unterminated key append', '[A]\nx=1', { A: { k: '2', j: '3' } }, '[A]\nx=1\nk=2\nj=3'],
  ['unterminated section key append', '[A]', { A: { k: '2' } }, '[A]\nk=2'],
  ['unterminated section append', '[Other]\nx=1', { A: { k: '2' } }, '[Other]\nx=1\n\n[A]\nk=2\n'],
  ['empty identity', '', {}, ''],
  ['empty file section append', '', { A: { k: '2' } }, '\n[A]\nk=2\n'],
];
for (const [name, inputText, edits, expectedText] of delimiterCases) {
  const input = bytes(inputText);
  const original = input.slice();
  const originalEdits = JSON.stringify(edits);
  assert.deepStrictEqual(applyIniSet(input, edits), bytes(expectedText), name);
  assert.deepStrictEqual(input, original, name + ': input unchanged');
  assert.strictEqual(JSON.stringify(edits), originalEdits, name + ': edits unchanged');
}

// Both hosts apply it, and the Deus Ex entry uses it.
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
assert(/applyIniSet\(/.test(read('host.js')), 'host.js applies iniSet');
assert(/applyIniSet\(/.test(read('test/run.js')), 'run.js applies iniSet');
const apps = require('../lib/apps');
const deus = (apps.APPS || apps.apps || apps).deus_ex_demo;
assert(deus, 'deus_ex_demo is registered');
const iniEntry = deus.files.find(f => typeof f === 'object' && f.iniSet);
assert(iniEntry && /deusex\.ini$/.test(iniEntry.url), 'DeusEx.ini carries the renderer and fullscreen edits');
assert.strictEqual(iniEntry.iniSet['Engine.Engine'].GameRenderDevice, 'SoftDrv.SoftwareRenderDevice');
assert.strictEqual(iniEntry.iniSet['WinDrv.WindowsClient'].StartupFullscreen, 'True');
assert(deus.dlls.some(d => /d3ddrv\.dll$/.test(d)), 'D3DDrv.dll is mounted');

// A registry entry with a guest path replaces the local media manifest's entry
// for that path (Tachyon's Tachyon.cfg carries the D3D renderer choice; the
// generated manifest mounts the shipped one), compared case-insensitively.
const { mergeLocalManifestFiles } = require('../lib/app-files');
const registry = [
  { url: 'r/Tachyon.cfg', vfsPath: 'c:\\tachyon\\Tachyon.cfg', iniSet: { VIDEO: { HW_TYPE: '0' } } },
  'r/plain.dll',
];
const manifest = [
  { url: 'm/Exile.sbf', vfsPath: 'c:\\tachyon\\Exile.sbf' },
  { url: 'm/Tachyon.cfg', vfsPath: 'C:\\TACHYON\\TACHYON.CFG' },
  { url: 'm/alias.cfg', vfsPaths: ['c:\\other.cfg', 'c:\\tachyon\\tachyon.cfg'] },
];
const merged = mergeLocalManifestFiles(registry, manifest);
assert.deepStrictEqual(merged.map(f => (typeof f === 'string' ? f : f.url)),
  ['r/Tachyon.cfg', 'r/plain.dll', 'm/Exile.sbf'], 'the registry entry wins its path, aliases included');
assert.deepStrictEqual(mergeLocalManifestFiles(undefined, manifest).map(f => f.url),
  manifest.map(f => f.url), 'no registry files keeps the manifest whole');
assert(/mergeLocalManifestFiles\(/.test(read('test/run.js')), 'run.js merges through mergeLocalManifestFiles');
assert(/mergeLocalManifestFiles\(/.test(read('lib/browser-shell.js')), 'the page merges through mergeLocalManifestFiles');

console.log('PASS applyIniSet: in-place, case-insensitive key edits; appended keys and sections; bytes preserved; registry files override the local manifest');
