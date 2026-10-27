'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert');
const O=path.resolve(process.argv[2]),R=path.resolve(__dirname,'../../..');fs.mkdirSync(O,{recursive:true});
const {stage}=require(path.join(R,'test/helpers/region-census-cli-fixture'));
const roots=[path.join(O,'measure-original'),path.join(O,'measure-candidate')];
roots.forEach((r,i)=>{stage(R,r,i?undefined:path.join(R,'test/fixtures/region-census-build-gates/original-region-census.js.txt'));if(!i)for(const [a,b]of [['original-region-layout.js.txt','region-layout.js'],['original-check-region-decls.js.txt','check-region-decls.js']])fs.copyFileSync(path.join(R,'test/fixtures/region-census-build-gates',a),path.join(r,'tools',b));});
const gates=['js-copies','embedded-wat','dup-payloads','hand-rolled'];
const measurements=[];
for(let rep=0;rep<3;rep++) for(const variant of rep%2?['candidate','original']:['original','candidate']) {
 const root=roots[variant==='original'?0:1], flags=variant==='original'?gates:['build-gates'];
 const items=[];
 for(const flag of flags) {
  const command=[process.execPath,'--max-old-space-size=512','--require',path.join(__dirname,'measure-preload.cjs'),'tools/region-census.js','--'+flag];
  const r=cp.spawnSync(command[0],command.slice(1),{cwd:root,encoding:'utf8',timeout:15000,maxBuffer:2*1024**2});
  const label=`measurement-${rep}-${variant}-${flag}`;
  fs.writeFileSync(path.join(O,label+'.stdout'),r.stdout||'');fs.writeFileSync(path.join(O,label+'.stderr'),r.stderr||'');
  assert.ifError(r.error);assert.strictEqual(r.status,0,r.stderr);
  const data=JSON.parse(fs.readFileSync(path.join(root,'measurement.json')));
  fs.writeFileSync(path.join(O,label+'.json'),JSON.stringify({command,...data},null,2)+'\n');items.push(data);
 }
 const sum=key=>items.reduce((n,x)=>n+x.counts[key],0);
 const reads={};for(const x of items)for(const [k,v] of Object.entries(x.counts.reads))reads[k]=(reads[k]||0)+v;
 measurements.push({rep,variant,collectDeclarations:sum('collectDeclarations'),declarationParses:sum('declarationParses'),layoutCalls:sum('layoutCalls'),compilerCalls:sum('compilerCalls'),reads,
 cpuMicroseconds:items.reduce((n,x)=>n+x.usage.userCPUTime+x.usage.systemCPUTime,0),maxSingleProcessRSSKiB:Math.max(...items.map(x=>x.usage.maxRSS))});
}
for(const rep of [0,1,2]) {
 const a=measurements.find(x=>x.rep===rep&&x.variant==='original'),b=measurements.find(x=>x.rep===rep&&x.variant==='candidate');
 assert.strictEqual(a.compilerCalls,3);assert.strictEqual(b.compilerCalls,1);
 assert.strictEqual(a.collectDeclarations,2);assert.strictEqual(b.collectDeclarations,2);assert.strictEqual(a.declarationParses,2);assert.strictEqual(b.declarationParses,1);
 assert(a.reads['src/00-regions.wat']>b.reads['src/00-regions.wat']);
 for(const f of ['compiler-parser.js','compiler-stages.js','compiler-codegen.js','compiler.js']) {
  assert.strictEqual(a.reads['tools/watx-src/'+f],5);assert.strictEqual(b.reads['tools/watx-src/'+f],3);
 }
 assert.strictEqual(a.reads['host.js'],2);assert.strictEqual(b.reads['host.js'],2);
}
fs.writeFileSync(path.join(O,'measurements.json'),JSON.stringify({scope:'3 bounded alternating tiny-fixture repetitions; process.resourceUsage is observational, never replaces trusted supervisor CPU admission; max single-process RSS is not aggregate peak; no full-build extrapolation',measurements},null,2)+'\n');
console.log(JSON.stringify(measurements.map(({reads,...x})=>({...x,regionReads:reads['src/00-regions.wat'],manifestReads:reads['src/main.watx']}))));
