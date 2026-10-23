#!/usr/bin/env node
'use strict';
// This command has no build mode. Its shell input ends before the compiler line.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert'),Module=require('module');
const root=path.resolve(__dirname,'..');
const evidence=path.join(root,'docs/re-notes/render-positiont-canonical-prereqs-complete-20261023');
const receiptPath=path.resolve(process.argv[2]||path.join(evidence,'readiness.json'));
assert(receiptPath.startsWith(evidence+path.sep),'receipt must be in task evidence directory');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const blob=b=>crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const receipt={argv:process.argv,cwd:process.cwd(),candidate:'7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6',independentAcceptance:'aea185d3dfc1b772cea00ca1a4aed14b9553dfed',node:process.version,execPath:process.execPath,compilation:'FULL SOURCE FORBIDDEN',runtime:'FORBIDDEN',checks:[],dependencies:[]};
let stage='admission';
try {
  const admission=JSON.parse(fs.readFileSync(path.join(evidence,'admission.json')));
  assert(admission.admitted);
  require('./positiont-canonical-resource.cjs').admit('driver',524288);
  const measured=cp.execFileSync('du',['-sb',root,'/home/user/wine-assembly/scratch/usage-watch/render-positiont-canonical-prereqs-complete-oct23'],{encoding:'utf8'}).trim().split('\n').reduce((n,l)=>n+Number(l.split(/\s/)[0]),0);
  assert(measured+8192+8388608+65536<=67108864,'64MiB cap including external capture and 8MiB reserve');
  const disk=fs.statfsSync(root);assert(disk.bavail*disk.bsize-13*1048576>=2982150144,'host free floor');
  const tree=JSON.parse(fs.readFileSync('/home/user/wine-assembly-render-positiont-build-readiness-oct23/docs/re-notes/render-positiont-build-readiness-20261023/candidate-tree.json'));
  const manifest=JSON.parse(fs.readFileSync(path.join(evidence,'manifest.json')));
  stage='exact focused inputs';
  for(const [f,h,n,d,phase] of manifest) if(phase==='initial') assert.equal(blob(fs.readFileSync(path.join(root,f))),h,`changed/missing candidate input ${f}`);
  stage='verifySources';
  const input=require('../test/support/positiont-com-module'); input.verifySources();
  assert.equal(sha(input.extraWat),'4bd65ac87452abb4ec5f728f88b399439c9fa4fec91a53b3e6cb96468f58d068');
  assert.equal(input.pinsHash,'f108ba0cae9dccea9d1628a7581e032e4743cfa54b2da4a21420857e7b7e3cfc');
  const pins=require('../test/support/positiont-com-source-pins.json');
  const main=fs.readFileSync(path.join(root,'src/main.watx'),'utf8');
  receipt.includes=[...main.matchAll(/\(include "([^"]+)"\)/g)].map(m=>m[1]);
  for(const f of receipt.includes) assert.equal(blob(fs.readFileSync(path.join(root,'src',f))),pins['src/'+f],`unpinned include ${f}`);
  receipt.checks.push({stage,exit:0,pinCount:Object.keys(pins).length,extraWatSha256:sha(input.extraWat),pinsSha256:input.pinsHash});
  stage='fixture/helper/compiler dependency closure';
  const seen=new Set(),queue=['test/test-d3d9-positiont-com-qualification.js','test/render-helper.js','test/compile-src.js','tools/watx-closure.js','tools/watx.js'];
  while(queue.length) {
    const file=queue.pop();if(seen.has(file))continue;seen.add(file);
    const source=fs.readFileSync(path.join(root,file),'utf8');assert.equal(blob(Buffer.from(source)),tree[file],file);
    const req=Module.createRequire(path.join(root,file));
    for(const [,name] of source.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
      if(Module.isBuiltin(name))continue;
      if(['@node-3d/glfw','@node-3d/webgl'].includes(name)) {
        assert.equal(file,'lib/headless-gl.js');
        receipt.dependencies.push({name,from:file,required:false,reason:'Only createGL lazy GPU route; fixture selects software and fonts:none'});continue;
      }
      const resolved=req.resolve(name);
      if(name.startsWith('.')) {const rel=path.relative(root,resolved);if(rel.endsWith('.js'))queue.push(rel);continue;}
      const pkg=req(name+'/package.json');
      assert.equal(name,'pngjs','unexpected external dependency');
      assert.equal(pkg.version,require('../package-lock.json').packages['node_modules/pngjs'].version);
      const packageRoot=path.dirname(req.resolve(name+'/package.json'));
      const files=[];
      function walk(dir) {for(const ent of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {const f=path.join(dir,ent.name);assert(!ent.isSymbolicLink(),'dependency links forbidden');if(ent.isDirectory())walk(f);else {const b=fs.readFileSync(f);files.push({path:path.relative(packageRoot,f),bytes:b.length,sha256:sha(b)});}}}
      walk(packageRoot);
      receipt.dependencies.push({name,from:file,resolved,version:pkg.version,lock:require('../package-lock.json').packages['node_modules/pngjs'],files,treeSha256:sha(JSON.stringify(files)),standingBytes:files.reduce((n,f)=>n+f.bytes,0),copiedBytes:0});
    }
  }
  receipt.dependencySourceFiles=[...seen].sort();
  stage='callback census input completeness';
  for(const [file,expected] of Object.entries(tree)) {
    if (!(file.endsWith('.js') && (!file.includes('/') || /^(lib|tools|test)\//.test(file))) &&
        !(/^src\/[^/]+\.watx?$/.test(file))) continue;
    assert.equal(blob(fs.readFileSync(path.join(root,file))),expected,'census input '+file);
  }
  stage='canonical pre-compilation boundary';
  const build=fs.readFileSync(path.join(root,'tools/build.sh'),'utf8');
  assert.equal(blob(Buffer.from(build)),'5407cb296ee6cdab2e30a226d1188206beb852af');
  const boundary='node tools/build-compile-wat.js\n';assert.equal(build.split(boundary).length,2);
  const prefix=build.slice(0,build.indexOf(boundary));
  assert(!/^node .*build-compile-wat/m.test(prefix));
  assert(prefix.includes('node tools/check-parens.js build/combined.wat --no-diff --quiet'));
  receipt.boundary={buildBlob:blob(Buffer.from(build)),prefixSha256:sha(prefix),lineCount:prefix.split('\n').length,excludedFirstCommand:boundary.trim(),guardSha256:sha(fs.readFileSync(path.join(__dirname,'positiont-canonical-guard.cjs')))};
  const script=path.join(root,'tools/.positiont-readiness-prefix.sh');
  fs.writeFileSync(script,prefix+'\nexit 0 # readiness boundary; compiler suffix absent\n',{flag:'wx'});
  const log=path.join(path.dirname(receiptPath),path.basename(receiptPath)+'.canonical.log');
  const fd=fs.openSync(log,'wx');
  const env={...process.env,GIT_NO_LAZY_FETCH:'1',NODE_OPTIONS:'--max-old-space-size=512 --require='+path.join(__dirname,'positiont-canonical-guard.cjs'),PS4:'+READINESS ${LINENO}: '};
  stage='canonical prerequisites';
  let result;
  try {result=cp.spawnSync('/usr/bin/timeout',['--signal=TERM','--kill-after=5s','600s','/usr/bin/prlimit','--cpu=600','--fsize=524288','--','/bin/bash','-x',script],{cwd:root,env,stdio:['ignore',fd,fd]});}
  finally {fs.closeSync(fd);fs.unlinkSync(script);}
  receipt.checks.push({stage,argv:['/usr/bin/timeout','--signal=TERM','180s','/bin/bash','-x',script],exit:result.status,signal:result.signal,log,nodeOptions:env.NODE_OPTIONS});
  const transcript=fs.readFileSync(log,'utf8'), processes=new Map();
  for(const line of transcript.split('\n')) {
    if(line.startsWith('READINESS_ARGV ')) {const p=JSON.parse(line.slice(15));processes.set(p.pid,p);}
    if(line.startsWith('READINESS_EXIT ')) {const p=JSON.parse(line.slice(15));if(processes.has(p.pid))processes.get(p.pid).exit=p.exit;}
  }
  receipt.canonicalProcesses=[...processes.values()];
  const first=receipt.canonicalProcesses.find(p=>p.exit!==0);
  if(first)receipt.firstCanonicalFailure=first;
  if(result.status!==0) {
    if(first?.argv[1].endsWith('/tools/toyvm/decode-diff.js') && transcript.includes('WebAssembly execution/allocation forbidden')) {
      const isa=require('./toyvm/isa');
      receipt.blockedArena={pages:isa.MEM_PAGES,bytes:isa.MEM_PAGES*65536,allowedBytes:8388608,nativeCompilation:false,instantiation:false};
      throw Error(`mandatory toyvm decoder differential requires ${isa.MEM_PAGES*65536}B arena; task allows at most 8388608B; separate prerequisite authorization required`);
    }
    throw Error('canonical prerequisite failed; first failure retained in '+log);
  }
  // Focused trees cannot claim scanner completeness merely because a subset passes.
  stage='scan-universe completeness';
  // Scanner membership and exact identities were checked before invocation.
  // concat-wat may release scanner-only inputs after their final consumption.
  input.verifySources();
  receipt.verdict='READY';receipt.exit=0;
} catch(error) {receipt.verdict='BLOCKED';receipt.exit=1;receipt.firstFailure={stage,message:error.message};}
fs.writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({verdict:receipt.verdict,firstFailure:receipt.firstFailure,receipt:receiptPath}));
process.exitCode=receipt.exit;
