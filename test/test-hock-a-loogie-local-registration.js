#!/usr/bin/env node
'use strict';
// Static/local-only regression. Never invokes the fetcher's network entrypoint or a guest.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const vm = require('vm');
const {createRequire} = require('module');
const root = path.resolve(__dirname, '..');
const manifest = require('./candidate-corpus/manifest.json');
const candidate = manifest.candidates.find(c => c.id === 'hock-a-loogie-1995');
const pins = {
  "69.AIF": {
    "size": 46134,
    "sha256": "41978e0f09e456227ce161b77aaee44dc3f91c3b1f5b4227311aa3877e981ce2"
  },
  "BBLOOGIE.000": {
    "size": 324416,
    "sha256": "1c1f12e0358cad5043e963f492a4b22e12b0073cd4d336b10966a3366b7b23f0"
  },
  "BBLOOGIE.EXE": {
    "size": 223744,
    "sha256": "974f1b5ff82cfdb87f05b9840ae03cd2ed6ceebe2c8ed547253dadaf1a871ef4"
  },
  "BING.AIF": {
    "size": 3522,
    "sha256": "07216e03482a6249471811a432bf700aa8fa2db01c3e4e440930630dff04e7cc"
  },
  "HOCKER1.AIF": {
    "size": 13878,
    "sha256": "0ee70b11eed315985759e7889f32b8f3d428ddbae0c1f16ebf4658d03bf451a4"
  },
  "LOOG1.AIF": {
    "size": 67529,
    "sha256": "2369226607e2bd8addd987d26a9df0d7d52976fb69b13ff8e6f1828e2dcfe9e7"
  },
  "LOOG10.AIF": {
    "size": 47849,
    "sha256": "ef9a0780f02b6fbda58dea321ada7d325ef239dc9df2c63801731ae7895ab545"
  },
  "LOOG11.AIF": {
    "size": 37290,
    "sha256": "43acea1553d15d3e5773f73078ca968cdd1ac5a26bde839a3becb3e3cda00a13"
  },
  "LOOG12.AIF": {
    "size": 50072,
    "sha256": "7f7decac6cc321ccbad79334392cdf268894e2d3c1d05218d547695eb21ff718"
  },
  "LOOG13.AIF": {
    "size": 19506,
    "sha256": "1871421a387d208599ad8e7158f0713fff67aff03a1c7a94808bea99da0feb6e"
  },
  "LOOG14.AIF": {
    "size": 70635,
    "sha256": "d771737dcfed44983bb0dd83942694782b20b356257e44b0da7f53ca61617c6f"
  },
  "LOOG15.AIF": {
    "size": 25063,
    "sha256": "03fc5764e3e7742ecfbd3af4775b42840bb418116d4822dbfa79628c0edab503"
  },
  "LOOG16.AIF": {
    "size": 50072,
    "sha256": "ff7a88afa5532566c2f77d307babf46932fd555e2b6a58e886645dd23ae84cf5"
  },
  "LOOG17.AIF": {
    "size": 33955,
    "sha256": "b6848cc2c7b12aa7413073f9fa6775f84235f977b043994df0cb742738eaf882"
  },
  "LOOG18.AIF": {
    "size": 65078,
    "sha256": "af2e26de845a0dc2e744fa9a4a70675b6251c6cb8aa809720fbdc836f36b5acf"
  },
  "LOOG19.AIF": {
    "size": 27842,
    "sha256": "2ab307544ce79720efd2d46cf99d6f49655f52794ee99912b8f99b6149e1b96a"
  },
  "LOOG2.AIF": {
    "size": 55737,
    "sha256": "e8351b1ca82989dacdbd2272756c12baafdfebe7b2dadf513edfbc83cc1c0d08"
  },
  "LOOG20.AIF": {
    "size": 48405,
    "sha256": "d0872d16ef05a01d630472aed0282e46fa31f8ec3b9dcc3e31c550d11755ff4b"
  },
  "LOOG21.AIF": {
    "size": 26730,
    "sha256": "4eb50872790809741044351bad9ff7ffe9cdd45f2674f77c82aed0034363efd8"
  },
  "LOOG22.AIF": {
    "size": 25063,
    "sha256": "9bd4f6c27eea47e2a161c13187f6cf7ce501d8afc9e65b1ee8afe60f501bf07d"
  },
  "LOOG23.AIF": {
    "size": 25619,
    "sha256": "f3c5ff3da101d725852c458ba8fa1fb7992f1fa5b62b67f48d408e5289bece3c"
  },
  "LOOG24.AIF": {
    "size": 50628,
    "sha256": "ae7d6bff29b98addd0c1c5b540f6495a7452754c9a02d959ed3cf89ac10e6506"
  },
  "LOOG25.AIF": {
    "size": 37846,
    "sha256": "393677ae04bd6854690bec0977dea9cd3ce0e0fb08815eb3b812fc2730067151"
  },
  "LOOG26.AIF": {
    "size": 72302,
    "sha256": "d0c0dc415875f56e4c9b5af562e9f49c5542e4179ad0c4a6f20ee6b1ffb3ad94"
  },
  "LOOG27.AIF": {
    "size": 75081,
    "sha256": "d0c2947319d2402415d935fd00a5dbbb0200081b8336ec8435eb36c7acdf2968"
  },
  "LOOG3.AIF": {
    "size": 17087,
    "sha256": "f1e7994de2dbccd79bdbbb603aca2a0af77e6b42906efbedbf8c910b5d8d98f9"
  },
  "LOOG4.AIF": {
    "size": 24293,
    "sha256": "e66696fb08db711c16b0c76fb943d45150ffc34978f11585d32d5242422c9aab"
  },
  "LOOG5.AIF": {
    "size": 24293,
    "sha256": "ef4fba5afc8676daddf32d53162b1126d5277f4c593b445034e8b03d2bb2bd8a"
  },
  "LOOG6.AIF": {
    "size": 98318,
    "sha256": "4eca92358fb3e5c3cbfd80de6225e2861bf3e0d07ec996bad702ae09bd7685c3"
  },
  "LOOG7.AIF": {
    "size": 21672,
    "sha256": "ff9305a096cce73974f3b3abf358f8994a7b165d17a510a16709bf948fd7f63f"
  },
  "LOOG8.AIF": {
    "size": 20362,
    "sha256": "31d5c3e0e5665543c4f551871e23a2010d0ce7f5d55be0dc6548f57894bb68a1"
  },
  "LOOG9.AIF": {
    "size": 17838,
    "sha256": "5f0413b1d548a6d6c07f26ebc0b5e41ec7355d252999b1cfea684c8dcc29999a"
  },
  "MEGALOOG.AIF": {
    "size": 29878,
    "sha256": "f4735e790700fe553e7422942a25643175f68d66cdb5163543c35c3035b264ab"
  },
  "MEGASPIT.AIF": {
    "size": 20003,
    "sha256": "7463c153ffff53c27dc05d819a8aa386c389120ad872cea7155a88df784eccca"
  },
  "MEGHOKER.AIF": {
    "size": 17974,
    "sha256": "0fedcb5991bbc30a43eb602c4b0661034e9c04479e6dbdad2b126d40c2ea833b"
  },
  "ROCKTUNE.AIF": {
    "size": 297864,
    "sha256": "03f9cc5dfa81504c2daa2c8911a5527096856814a3d246601ccd9beee2820381"
  },
  "SOS9502.DLL": {
    "size": 84480,
    "sha256": "a706691cd04bc66fd290977fc5a863b99c004e06f8980b6fc8a04d2bc4f26b7e"
  },
  "SPIT1.AIF": {
    "size": 6454,
    "sha256": "b96c62437581660dbe17c339854b5c90d84b60e185b78ae12a8fdbdd79b2a26c"
  },
  "YES.AIF": {
    "size": 20406,
    "sha256": "e22f4ca7657ea257c2ec96950c02971e786aff404ea1e948bbff5ce9122a3166"
  }
};
const digest = (bytes, algorithm = 'sha256') => crypto.createHash(algorithm).update(bytes).digest('hex');
function validate(c) {
  assert.equal(c.localOnly, true);
  assert.match(c.license, /Proprietary/);
  assert.deepStrictEqual(c.executables, ['game/BBLOOGIE.EXE']);
  assert.deepStrictEqual(c.browser, {fileRoot: 'game', exe: 'game/BBLOOGIE.EXE'});
  assert.deepStrictEqual(c.cli.vfsInclude, ['**/*']);
  assert.deepStrictEqual(c.postExtract, [{type: 'extractArchive', archive: 'distribution/BEAVISLG.ZIP', into: 'game'}]);
  assert.equal(c.packages.length, 1);
  assert.equal(c.packages[0].url, 'https://archive.org/download/Hock-A-Loogie-1995/beavislg.zip');
  assert.equal(c.packages[0].into, 'distribution');
  assert.equal(c.packages[0].type, 'archive');
  assert.equal(c.packages[0].sha1, '68be591b75813f81409314ad1944d64927835be5');
  assert.equal(c.packages[0].sha256, 'e10d150131258641af11609249ac7f1c430e67e4138943d175b0365ba64be00b');
  assert(!c.cli.registry && !c.cli.dlls);
}
validate(candidate);
assert.equal(manifest.candidates.filter(c => c.id === candidate.id).length, 1);
for (const mutate of [c => c.localOnly = false, c => c.postExtract = [],
  c => c.postExtract[0].archive = 'BEAVISLG.ZIP', c => c.postExtract[0].into = 'wrong',
  c => c.browser.fileRoot = 'distribution', c => c.executables = ['BBLOOGIE.EXE'],
  c => c.cli.vfsInclude = ['*.exe'], c => c.packages[0].sha1 = '0'.repeat(40)]) {
  const broken = structuredClone(candidate); mutate(broken);
  assert.throws(() => validate(broken));
}
console.log('PASS registration and 8 negative controls');
const intakeArg = process.argv.find(a => a.startsWith('--intake='));
if (!intakeArg) {
  console.log('SKIP retained-package extraction: pass --intake=/absolute/intake/directory');
  process.exit(0);
}
const intake = path.resolve(intakeArg.slice(9));
const seal = fs.readFileSync(path.join(intake, 'SHA256SUMS'), 'utf8');
assert.equal(digest(seal), '31230f2aa354498853120b39417e1385d5f218e623bdf15e4493b49b9db9dfa7');
for (const line of seal.trim().split('\n')) {
  const [, hash, file] = /^(\w{64})  (.+)$/.exec(line);
  assert.equal(digest(fs.readFileSync(path.join(intake, file))), hash, file);
}
const archive = path.join(intake, 'beavislg.zip');
const bytes = fs.readFileSync(archive);
assert.equal(bytes.length, 1256578);
assert.equal(digest(bytes), candidate.packages[0].sha256);
assert.equal(digest(bytes, 'sha1'), candidate.packages[0].sha1);
const brokenBytes = Buffer.from(bytes); brokenBytes[100] ^= 1;
assert.notEqual(digest(brokenBytes), candidate.packages[0].sha256);
// Evaluate only helper definitions: the network-capable main is deliberately excluded.
const fetcher = path.join(root, 'tools/fetch-candidate-corpus.js');
const source = fs.readFileSync(fetcher, 'utf8');
const boundary = source.indexOf('(async () => {');
assert(boundary > 0);
const context = {require: createRequire(fetcher), __dirname: path.dirname(fetcher),
  process: {argv: ['node', fetcher]}, console, Buffer};
vm.createContext(context);
vm.runInContext(source.slice(0, boundary) + '\nthis.helpers = {extractArchive, runPostExtract, writeBrowserManifest};', context);
const space = fs.statfsSync(os.tmpdir());
assert(space.bavail * space.bsize >= 2285895680 + 16 * 1024 * 1024, 'storage floor plus remaining allocation');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hock-static-'));
try {
  context.helpers.extractArchive(archive, path.join(temp, candidate.packages[0].into));
  assert.equal(digest(fs.readFileSync(path.join(temp, candidate.postExtract[0].archive))),
    '24da14e65b7a5418f9f4099a8ec6dcf6998004c350f365936b8d9ef0b6a3f05e');
  context.helpers.runPostExtract(candidate, temp);
  const game = path.join(temp, 'game');
  assert.deepStrictEqual(fs.readdirSync(game).sort(), Object.keys(pins).sort());
  for (const [file, pin] of Object.entries(pins)) {
    const data = fs.readFileSync(path.join(game, file));
    assert.equal(data.length, pin.size, file);
    assert.equal(digest(data), pin.sha256, file);
  }
  context.helpers.writeBrowserManifest(candidate, temp);
  const inventory = JSON.parse(fs.readFileSync(path.join(temp, '.wine-assembly-browser.json')));
  function closure(files) {
    assert.equal(files.length, 38);
    for (const name of Object.keys(pins).filter(n => n !== 'BBLOOGIE.EXE')) {
      const row = files.find(f => f.url === 'game/' + name);
      assert(row, name); assert.equal(row.vfsPath, 'c:\\' + name);
      assert.equal(row.size, pins[name].size);
    }
  }
  closure(inventory.files);
  for (const row of inventory.files) assert.throws(() => closure(inventory.files.filter(f => f !== row)));
  const wrongPath = structuredClone(inventory.files); wrongPath[0].vfsPath = 'c:\\wrong\\asset';
  assert.throws(() => closure(wrongPath));
  console.log('PASS sealed intake, actual two-layer extraction, 39 file hashes, 38 companion VFS paths; corruption, 38 missing-companion and wrong-VFS controls');
} finally { fs.rmSync(temp, {recursive: true, force: true}); }
