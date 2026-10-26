'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const R=path.resolve(__dirname,'../repo'),D='/tmp/maelstrom-rejection-diagnostics-independent-oct26/repo';
const now=require(R+'/tools/maelstrom-native-errno-latch.cjs'),old=require(D+'/tools/maelstrom-native-errno-latch.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sources=Object.fromEntries(Object.keys(now.PINS).map(p=>[p,fs.readFileSync(path.join(process.env.MNE_SOURCE_ROOT,p),'utf8')]));
const binaries={net:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'SDL_net.dll')),exe:fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT,'Maelstrom.exe')),crt:fs.readFileSync(process.env.MNE_CRT)};
assert.deepEqual(now.PINS,old.PINS);assert.deepEqual(now.BINARY_PINS,old.BINARY_PINS);assert.deepEqual(now.NET_ANCHORS,old.NET_ANCHORS);
assert.deepEqual(now.verifyBinaries(binaries),old.verifyBinaries(binaries));
const options={enabled:true,crtLoadedBase:0x522000,binaries};
const before=old.transform(sources,options),after=now.transform(sources,options);
assert.deepEqual(after,before,'complete generated WAT text remains byte-identical');
const fixtures=['test/maelstrom-native-latch-rejection.test.cjs','test/maelstrom-native-errno-latch.test.cjs','test/maelstrom-native-errno-source-snapshot.test.cjs','test/maelstrom-original-errno-adapter.cjs','test/maelstrom-select-hook-model.cjs','docs/reviews/maelstrom-rejection-diagnostics-independent-oct26/independent.cjs','docs/reviews/maelstrom-rejection-diagnostics-independent-oct26/independent-results.json'];
const pins={};for(const p of fixtures){const current=fs.readFileSync(path.join(R,p)),donor=fs.readFileSync(path.join(D,p));assert.equal(sha(current),sha(donor),p);pins[p]=sha(current);}
assert.equal(pins[fixtures[5]],'8483dd85879c25d32c78125251741db6fd53248ed5d14b4f632e07777f19a401');
const report={passed:1,completeTransformByteIdentical:true,originalPinsAndOraclesIdentical:true,pins,generated:Object.fromEntries(Object.entries(after).map(([p,s])=>[p,sha(s)]))};
fs.writeFileSync(path.join(__dirname,'preservation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:1,completeTransformByteIdentical:true,originalPinsAndOraclesIdentical:true,fixtures:fixtures.length}));
