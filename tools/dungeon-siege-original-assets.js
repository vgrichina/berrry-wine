'use strict';
// Read-only original CLI data closure. No module compilation or guest execution.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const rel = 'test/binaries/win98-games-a-d/DungeonSiege demo-D3D/extracted';
const manifestSha = 'c3bc130395222c451a9341d48f6dd00cc2660961c3c7ef69299c97c4604d8eef';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function audit(root, source) {
  assert(/^[a-f0-9]{40}$/.test(source));
  const { files } = require('./runner-boot-assets').auditBoot(root, source);
  const mp = rel + '/.wine-assembly-browser.json', bytes = fs.readFileSync(path.join(root, mp));
  assert.equal(sha(bytes), manifestSha, 'Original registered app mount manifest');
  const original = JSON.parse(fs.readFileSync(path.join(root, rel, '.original-package.json')));
  const originals = new Map(original.files.map(f => [f.path, f]));
  const mounts = JSON.parse(bytes).files;
  assert.equal(mounts.length, originals.size); // EXE is loaded directly, metadata is mounted instead.
  const seen = new Set();
  for (const f of mounts) {
    assert(!seen.has(f.url)); seen.add(f.url);
    assert(f.url === '.original-package.json' || originals.has(f.url), 'Unexpected mounted original');
    const data = fs.readFileSync(path.join(root, rel, f.url));
    assert.equal(data.length, f.size, f.url);
    if (originals.has(f.url)) assert.equal(sha(data), originals.get(f.url).sha256, f.url);
  }
  for (const p of originals.keys()) if (p !== 'DungeonSiegeDemo.exe') assert(seen.has(p), 'Missing original mount: ' + p);
  files.push({ path: mp, bytes: bytes.length, sha256: manifestSha, provenance: 'Existing original app manifest; no registry/guest edits' });
  return { sourceOnly: true, source, files, mountCount: mounts.length, bytes: files.reduce((n, f) => n + f.bytes, 0) };
}
module.exports = { audit };
if (require.main === module) console.log(JSON.stringify(audit(path.resolve(process.argv[2]), process.argv[3]), null, 2));
