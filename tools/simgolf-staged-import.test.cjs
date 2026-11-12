'use strict';
// Actual generated caller, isolated Node resolution, no browser or game assets.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),run=path.resolve(process.argv[2]);
const h=require('./simgolf-native-hole-driver.cjs');
const call=file=>cp.spawnSync(process.execPath,[file,'--staged-import-check'],{encoding:'utf8',timeout:10000,env:{PATH:process.env.PATH}});
assert.equal(fs.readFileSync(run+'/browser.cjs','utf8'),h.compose(root));
const generated=h.compose(root),gate=generated.slice(0,generated.indexOf('// One native-CDP browser'));
// Any new literal mandatory import must also appear in the early gate.
for(const match of generated.slice(gate.length).matchAll(/require\('([^']+)'\)/g)){
 const name=match[1];if(name.startsWith('node:')||['./generated.cjs','./qualify.cjs'].includes(name))continue;
 assert(gate.includes("require('"+name+"')"),'mandatory import absent from gate: '+name);
}
assert.throws(()=>h.checkImports(()=>require('node:http').createServer().listen(0)),/import attempted effect: listen/);
const local=call(run+'/browser.cjs');assert.equal(local.status,0,local.stderr);
const observed=JSON.parse(local.stdout);assert(observed.passed&&observed.importOnly);assert.deepEqual(observed.effects,[]);
const relative=path.relative(root,run),stage=fs.mkdtempSync(run+'/minimal-stage-');
try {
 const files=[...new Set([...observed.loaded,root+'/tools/simgolf-native-hole-driver.cjs',run+'/browser.cjs'])];
 for(const file of files){const rel=path.relative(root,file);assert(!rel.startsWith('..'));const dst=path.join(stage,rel);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(file,dst);}
 // Package resolution needs the package entry metadata, not a full node_modules.
 for(const name of ['pngjs']){const rel='node_modules/'+name+'/package.json';fs.copyFileSync(root+'/'+rel,stage+'/'+rel);}
 const caller=path.join(stage,relative,'browser.cjs'),helper=stage+'/tools/native-input-pulse.cjs',bytes=fs.readFileSync(helper);
 fs.unlinkSync(helper);const negative=call(caller);assert.notEqual(negative.status,0);assert.match(negative.stderr,/Cannot find module.*native-input-pulse/);
 fs.writeFileSync(run+'/missing-helper.stderr',negative.stderr);
 fs.writeFileSync(helper,bytes);const positive=call(caller);assert.equal(positive.status,0,positive.stderr);assert(JSON.parse(positive.stdout).passed);
 const transitive=stage+'/lib/apps.js',app=fs.readFileSync(transitive);fs.unlinkSync(transitive);
 const missingTransitive=call(caller);assert.notEqual(missingTransitive.status,0);assert.match(missingTransitive.stderr,/Cannot find module.*lib\/apps/);fs.writeFileSync(transitive,app);
 const ready=stage+'/scratch/runs/20261107-boids-visible-flock/readiness.cjs',original=fs.readFileSync(ready);
 fs.appendFileSync(ready,"\nrequire('node:child_process').spawn('/usr/bin/google-chrome',[]);\n");
 const startup=call(caller);assert.notEqual(startup.status,0);assert.match(startup.stderr,/import attempted effect: spawn/);fs.writeFileSync(ready,original);
 fs.appendFileSync(ready,"\nPromise.resolve().then(()=>require('node:child_process').spawn('/usr/bin/google-chrome',[]));\n");
 const deferred=call(caller);assert.notEqual(deferred.status,0);assert.match(deferred.stderr,/import attempted effect: spawn/);fs.writeFileSync(ready,original);
 assert(!fs.existsSync(path.join(stage,relative,'original')),'no browser output directory');
 const result={passed:true,actualGeneratedCaller:true,missingHelper:negative.status,completeClosure:positive.status,missingTransitive:missingTransitive.status,accidentalStartup:startup.status,deferredStartup:deferred.status,files:files.map(f=>path.relative(root,f)),noBrowserOutput:true};
 fs.writeFileSync(run+'/staged-import-tests.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {fs.rmSync(stage,{recursive:true,force:true});}
