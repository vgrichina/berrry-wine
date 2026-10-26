'use strict';
// Preserve accepted fixtures byte-for-byte. Adapt their full-host identity guard
// to pinned main, whose parser hardening is outside the identical loadFiles body.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const root = path.resolve(__dirname, '..');
const pins = {
  supplied: ['app-files-empty-alias-fallback-oct26.test.cjs', 'd82afe0a3ccf1fc2c047e2b53a6ff69e94d315985e4772e66d554bd9f6497d1a'],
  independent: ['app-files-empty-alias-independent-oct26.test.cjs', 'f9514b61c98fab770e8791b5458f7d8b9db5f080680cf849b3eb815c052af16e'],
};
assert(pins[process.env.COMPAT_FIXTURE], 'explicit bounded accepted fixture');
const [name, expected] = pins[process.env.COMPAT_FIXTURE];
const filename = path.join(__dirname, name);
const original = fs.readFileSync(filename, 'utf8');
assert.equal(sha(original), expected);
assert.equal(sha(fs.readFileSync(path.join(root, 'lib/app-files.js'))), '4c1ce40b92aa990a4bc689bd98d5c0d92ab3af44dafeb93ca52ccbaf2c6124f7');
const oldHost = '03eb8a7ab8dfae1f6e2a16c7943be2ed582a3f463029ae950043f0b2c0569ee4';
const mainHost = '7154fbbcfb3381cddfecaeb07dbf4301e6a68fc43850b4f085264b6cb412e993';
const host = fs.readFileSync(path.join(root, 'host.js'), 'utf8');
assert.equal(sha(host), mainHost);
const header = '  async loadFiles(urls, options = {}) {';
const start = host.indexOf(header);
const end = host.indexOf('\n  async loadDlls(', start);
assert(start >= 0 && end > start && host.indexOf(header, start + 1) === -1);
assert.equal(Buffer.byteLength(host.slice(start, end)), 16464);
assert.equal(sha(host.slice(start, end)), '5fbb544b0f29130c90f2c14685e979bdfa40caaf43dfeb4d6181a26e62933659');
assert.equal(original.split(oldHost).length, 2, 'exactly one full-host identity guard');
const adapted = original.replace(oldHost, mainHost);
assert.equal(adapted.replace(mainHost, oldHost), original);
const fixture = new Module(filename, module);
fixture.filename = filename;
fixture.paths = Module._nodeModulePaths(path.dirname(filename));
fixture._compile(adapted, filename);
