'use strict';
// Provenance/pins/hash check only. No native Module, Memory, Instance or compiler.
const fs=require('fs'),assert=require('assert'),crypto=require('crypto');
const helper=require('../test/support/positiont-com-module');
const bytes=fs.readFileSync('build/positiont-com-diagnostic.wasm');
const provenanceBytes=fs.readFileSync('build/positiont-com-diagnostic.provenance.json');
assert(bytes.length<=8388608);assert(provenanceBytes.length<=65536);
const provenance=JSON.parse(provenanceBytes);
helper.validateProvenance(provenance,bytes);helper.verifySources();
console.log(JSON.stringify({result:'PASS guarded diagnostic provenance and all pins',moduleBytes:bytes.length,
 moduleSha256:helper.sha256(bytes),provenanceSha256:helper.sha256(provenanceBytes),
 sourcePins:286,extraWatSha256:helper.sha256(helper.extraWat),qualification:'GUARDED_DIAGNOSTIC',native:false}));
