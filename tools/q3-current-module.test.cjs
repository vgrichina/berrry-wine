'use strict';
// The default module deliberately refuses today's prelaunch provider. The
// explicit current route and its positive/corruption controls live in
// q3-current-foreign-closure.test.cjs; do not expect the retired route to pass.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const current=require('./q3-current-module.cjs');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]);
assert(out.startsWith(root+'/scratch/runs/')&&!fs.existsSync(out));
fs.mkdirSync(out,{recursive:true});
for(const [label,options,pattern] of [
 ['default',{},/Q3 migration provider: tools\/q3-native-prelaunch.py/],
 ['retired-checkpoint',{checkpointObserverVersion:current.checkpointObserverVersion},/Q3 migration provider: tools\/q3-native-prelaunch.py/],
 ['unknown-option',{skipValidation:true},/explicit supported/],
 ['unknown-foreign',{foreignClosureVersion:'unknown'},/explicit Q3 foreign closure version/]
]){
 const dest=path.join(out,label);
 assert.throws(()=>current.prepare(dest,options),pattern);
 assert(!fs.existsSync(dest),'refuse before output creation');
}
console.log(JSON.stringify({passed:true,obsoleteDefaultRefused:true,negativeControls:4,browserStarted:false}));
