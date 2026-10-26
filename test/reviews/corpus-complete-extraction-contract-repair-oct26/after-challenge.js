'use strict';
// Replay the byte-identical independent case/probe program against pinned repair
// bytes. Only the old source-SHA assertion changes in memory; cases are untouched.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Module = require('module');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const challenge = path.join(__dirname, 'challenge.js');
const source = fs.readFileSync(challenge, 'utf8');
const oldPin = 'e8046f77b7fad166c81d48f43fe3b2ea5f2e3643e8dd905de364ac53081206b0';
const repairPin = '7a99c19b56531a46cae5ec09e0589d227ca60979dbd5f23eb4dd699eff97642e';
assert.strictEqual(sha(source), '87b4d8240283ac98ad87c04aa613db42d515958ea290077f2d93cb7e599fea38');
assert.strictEqual(sha(fs.readFileSync(path.resolve(__dirname, '../../test-cli-candidate-corpus.js'))), repairPin);
assert.strictEqual(source.split(oldPin).length, 2);
const replay = new Module(challenge, module);
replay.filename = challenge;
replay.paths = Module._nodeModulePaths(__dirname);
replay._compile(source.replace(oldPin, repairPin), challenge);
