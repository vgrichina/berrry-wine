#!/usr/bin/env node
// Per-edition compat fields (testedOn / notTested / facts / version / source):
// the generator rejects unknown keys and wrong types, and renders null facts as
// "—" plus a legend, never as a guess.
'use strict';
const assert = require('assert');
const { validateCompat, validateCompatEdition, compatTableMd } = require('../tools/gen-site-pages.js');

const ok = {
  edition: 'Demo', appIds: ['x'], status: 'playable', statusDate: '2026-11-16',
  works: 'Plays.', issues: null, notTested: 'Sound.', version: '1.0', source: 'shareware',
  testedOn: { build: 'abc1234', browser: 'Chrome 157', device: 'iPhone', os: 'iOS 17', date: '2026-11-16', evidence: 'scratch/runs/x' },
  facts: { installs: null, audio: true, saves: null, multiplayer: 'untested', touchPlayable: null, phoneFps: 12.5 },
};
validateCompatEdition(ok, 't[0]');
validateCompatEdition({ ...ok, testedOn: [ok.testedOn, { device: 'desktop Chrome' }] }, 't[0]');
validateCompatEdition({ edition: 'Bare', status: 'playable', statusDate: '' }, 't[0]');

const bad = {
  'unknown top-level key': { ...ok, fps: 30 },
  'unknown facts key': { ...ok, facts: { ...ok.facts, x: true } },
  'unknown testedOn key': { ...ok, testedOn: { ...ok.testedOn, gpu: 'M1' } },
  'audio as string': { ...ok, facts: { ...ok.facts, audio: 'yes' } },
  'negative phoneFps': { ...ok, facts: { ...ok.facts, phoneFps: -1 } },
  'bad multiplayer enum': { ...ok, facts: { ...ok.facts, multiplayer: 'maybe' } },
  'bad testedOn date': { ...ok, testedOn: { ...ok.testedOn, date: '16/11/2026' } },
  'bad statusDate': { ...ok, statusDate: 'Nov 2026' },
  'empty testedOn array': { ...ok, testedOn: [] },
  'notTested as array': { ...ok, notTested: ['sound'] },
  'missing edition': { status: 'playable' },
};
for (const [name, e] of Object.entries(bad)) {
  assert.throws(() => validateCompatEdition(e, 't[0]'), /site-compat\.json: t\[0\]/, `should reject: ${name}`);
}
assert.throws(() => validateCompat({ titles: [{ slug: 't', editions: [bad['unknown facts key']] }] }), /t\.editions\[0\]/);

const md = compatTableMd({ slug: 't', title: 'T', editions: [{ ...ok, facts: { installs: null, audio: null, saves: null, multiplayer: null, touchPlayable: null, phoneFps: null } }] }).join('\n');
assert.match(md, /on iPhone, Chrome 157/, 'Tested cell names the device');
assert.match(md, /Sound <b>—<\/b>|Sound:? —/, 'null audio renders as an em dash');
assert.match(md, /Phone FPS:? (<b>)?—/, 'null phoneFps renders as an em dash');
assert.match(md, /means not tested yet/, 'legend line present');
assert.doesNotMatch(md, /scratch\/runs/, 'evidence path is stored, not printed');

const real = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../tools/site-compat.json'), 'utf8'));
validateCompat(real);
console.log(`PASS site-compat fields: ${Object.keys(bad).length} rejections, ${real.titles.length} titles validate`);
