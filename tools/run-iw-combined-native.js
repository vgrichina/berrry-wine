'use strict';
// Source preparation is safe; execution requires root's sole-lane grant.
// Launch: setsid timeout --kill-after=10s 1500s node tools/run-iw-combined-native.js
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=fs.realpathSync(path.resolve(__dirname,'..'));
const commit=process.env.WA_IW_COMMIT, out=process.env.WA_IW_EVIDENCE;
const postflight=process.argv.includes('--postflight');
assert.match(commit||'',/^[a-f0-9]{40}$/);
assert(out && path.isAbsolute(out) && !out.startsWith(root+'/'));
assert.equal(root,'/home/user/wa-iw-combined-native','dedicated disposable checkout only');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const hash=p=>sha(fs.readFileSync(p));
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});
assert.equal(git('rev-parse','HEAD').trim(),commit);
const save=(name,value)=>fs.writeFileSync(path.join(out,name+'.json'),JSON.stringify(value,null,2));
const wasm=path.join(root,'build/wine-assembly.wasm');
const fixed=[
 {path:'/home/user/jedi-knight-checkout/build/wine-assembly.wasm',sha256:'937466db3545b9d016fb90dfd8a414eb82653b5ebbf7cc2db7c53d8cc87d49eb'},
 {path:'/home/user/wa-iw-native-validation/build/wine-assembly.wasm',sha256:'a948a826f71c1935c4d00f7054decdaf4d1e8115314d8779727b7e30069f5b48'}
];
function inventory(label) {
 const output=cp.execFileSync('ps',['-eo','pid,ppid,pgid,stat,comm'],{encoding:'utf8'});
 fs.writeFileSync(path.join(out,label+'-processes.txt'),output);
 const active=output.split('\n').filter(line=>{
  const m=line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)$/);
  return m && +m[1]!==process.pid && !m[4].startsWith('Z') &&
   /^(node|MainThread|chrome|chromium|firefox|wat2wasm)$/.test(m[5]);
 });
 assert.deepEqual(active,[],'sole runtime lane must be idle');
}
function sourceRecords() {
 assert.equal(git('rev-parse','HEAD').trim(),commit);
 const rows=git('ls-tree','-r',commit).trim().split('\n')
  .map(line=>line.match(/^\d+ blob ([a-f0-9]+)\t(.+)$/)).filter(Boolean)
  .filter(m=>!m[2].includes('/') || /^(?:src|lib|tools|test|docs|fonts)\//.test(m[2]));
 assert(rows.length>4000,'complete normal build closure including binary fonts');
 assert(rows.some(m=>m[2]==='fonts/Terminal.fon'),'font closure');
 return rows.map(([,blob,file])=>{
  const physical=path.join(root,file);
  assert(!fs.lstatSync(physical).isSymbolicLink(),'tracked source must be a private physical file: '+file);
  const bytes=fs.readFileSync(physical);
  const object=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
  assert.equal(object,blob,'physical tracked source '+file);
  return {path:file,sha256:sha(bytes)};
 });
}
function checkFiles(rows) {
 for(const row of rows) {
  assert(path.isAbsolute(row.path));assert.match(row.sha256,/^[a-f0-9]{64}$/);
  assert.equal(hash(row.path),row.sha256,'immutable input '+row.path);
 }
}
function donorRecords() {
 const records=[...fixed];
 // Preserve each physically present tracked file in both donor checkouts,
 // including their historical source maps; absent sparse paths stay absent.
 for(const dir of ['/home/user/jedi-knight-checkout','/home/user/wa-iw-native-validation']) {
  const files=cp.execFileSync('git',['ls-files','-z'],{cwd:dir,encoding:'utf8',maxBuffer:32*1024*1024}).split('\0').filter(Boolean);
  for(const file of files) {
   const physical=path.join(dir,file);
   if(fs.existsSync(physical) && fs.statSync(physical).isFile())
    records.push({path:physical,sha256:hash(physical)});
  }
 }
 checkFiles(records);return records;
}
let immutable, moduleHash=null;
function sources(label) {
 const records=sourceRecords();
 checkFiles(immutable.donors);checkFiles(immutable.dependencies);
 if(moduleHash)assert.equal(hash(wasm),moduleHash,'same combined module in every arm');
 save(label+'-sources',{at:new Date().toISOString(),commit,node:process.version,moduleHash,
  observedModuleHash:fs.existsSync(wasm)?hash(wasm):null,records});
}
if(postflight) {
 immutable=JSON.parse(fs.readFileSync(path.join(out,'immutable-inputs.json'),'utf8'));
 const built=path.join(out,'built-module.json');
 if(fs.existsSync(built))moduleHash=JSON.parse(fs.readFileSync(built,'utf8')).sha256;
 inventory('independent-postflight');sources('independent-postflight');
 save('independent-postflight-result',{invariantsPassed:true,at:new Date().toISOString(),commit,moduleHash});
} else {
 assert.equal(process.env.WA_IW_RUNTIME_GRANTED,'yes','root runtime grant required');
 // Enforce the hard outer kill independently of each child timeout. No
 // in-process timer can interrupt spawnSync or a blocked build.
 const parent=fs.readFileSync('/proc/'+process.ppid+'/cmdline','utf8').split('\0');
 assert.equal(path.basename(parent[0]),'timeout','required outer GNU timeout');
 assert(parent.includes('1500s') && parent.includes('--kill-after=10s'),'required 1500s outer bound');
 assert(!fs.existsSync(wasm),'fresh checkout must not contain a preexisting module');
 fs.mkdirSync(out,{recursive:false});
 const dependencyFile=process.env.WA_IW_DEPENDENCY_MANIFEST;
 assert(dependencyFile && path.isAbsolute(dependencyFile));
 assert.match(process.env.WA_IW_DEPENDENCY_MANIFEST_SHA256||'',/^[a-f0-9]{64}$/);
 assert.equal(hash(dependencyFile),process.env.WA_IW_DEPENDENCY_MANIFEST_SHA256);
 const dependencies=JSON.parse(fs.readFileSync(dependencyFile,'utf8'));
 assert(Array.isArray(dependencies) && dependencies.length,'explicit preflight dependency inventory');
 // Pin every physical node_modules input, not only its package.json. Root's
 // staging recipe inventories the installed dependency closure before grant.
 const depRoot=fs.realpathSync(path.join(root,'node_modules'));
 const physical=[];
 function walk(dir) { for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
  const file=path.join(dir,entry.name);
  if(entry.isDirectory())walk(file);
  else if(entry.isFile())physical.push(fs.realpathSync(file));
  else if(entry.isSymbolicLink())assert(fs.statSync(file).isFile(),'no directory symlink in dependencies');
 }}
 walk(depRoot);
 assert.deepEqual([...new Set(dependencies.map(r=>r.path))].sort(),[...new Set(physical)].sort(),
  'dependency manifest covers installed physical closure exactly');
 immutable={donors:donorRecords(),dependencies};checkFiles(dependencies);
 save('immutable-inputs',immutable);
 const statuses=[];
 function arm(label,seconds,args,extra={},expected=0,pattern=null) {
  sources(label+'-before');inventory(label+'-before');
  const fd=fs.openSync(path.join(out,label+'.log'),'wx'),started=Date.now();
  let result;
  try { result=cp.spawnSync('timeout',['--kill-after=5s',seconds+'s',...args],{
   cwd:root,env:{...process.env,NODE_OPTIONS:'',WINE_WAT_COMPILER:'watx',WINE_REGION_MAP:'',
    WA_THREAD_MANAGER_SOURCE:'',WA_BROKER_SOURCE:'',WA_TEST_BROKER_SOURCE:'',WA_TEST_WASM:wasm,
    WA_TEST_WASM_SHA256:moduleHash||'',...extra},stdio:['ignore',fd,fd]});
  } finally {fs.closeSync(fd);}
  const row={label,status:result.status,signal:result.signal,error:result.error?.message,elapsedMs:Date.now()-started};
  statuses.push(row);save(label+'-status',row);
  inventory(label+'-after');sources(label+'-after');
  assert.equal(result.status,expected,label+': stop at first unexpected failure');
  if(pattern)assert.match(fs.readFileSync(path.join(out,label+'.log'),'utf8'),pattern,label+' exact expected assertion');
 }
 let passed=false;
 try {
  inventory('preflight');sources('staged');
  arm('normal-build',600,['bash','tools/build.sh']);
  moduleHash=hash(wasm);save('built-module',{commit,sha256:moduleHash,bytes:fs.statSync(wasm).size});
  sources('built');
  const tests=[
   ['cross-process-wat','test/test-process-send-runtime.js'],
   ['scoped-lifecycle','test/test-scoped-dll-native.js'],
   ['scoped-endpoints','test/test-scoped-dll-endpoints-candidate.js'],
   ['owner-retirement','test/test-retirement-native-candidate.js'],
   ['admission','test/test-admission-native-candidate.js'],
   ['receiver-retirement','test/test-receiver-retirement-native.js']
  ];
  for(const [label,file]of tests)arm(label,90,[process.execPath,file]);
  // Controlled omission in an evidence-only copy of CURRENT broker source.
  // No old production source is substituted, and the compiled module stays
  // identical. Require the exact receiver cancellation failure, not any exit1.
  const broker=fs.readFileSync(path.join(root,'lib/process-send-broker.js'),'utf8');
  const begin=broker.indexOf('      request.unsubscribeReceiverRetiring = link?.onRetiring?.(() => {');
  const end=broker.indexOf('\n      if (request.settled) { request.unsubscribeReceiverRetiring?.(); return; }',begin);
  assert(begin>=0 && end>begin);
  const negative=broker.slice(0,begin)+
   '      request.unsubscribeReceiverRetiring = undefined; // controlled omission\n'+broker.slice(end);
  const control=path.join(out,'receiver-subscription-disabled.js');
  fs.writeFileSync(control,negative,{flag:'wx'});
  save('negative-control',{sourceSha256:sha(broker),controlSha256:sha(negative),moduleHash,
   change:'remove only receiver onRetiring subscription in current broker copy'});
  arm('receiver-negative',90,[process.execPath,'test/test-receiver-retirement-native.js'],
   {WA_TEST_BROKER_SOURCE:control},1,/RECEIVER_RETIREMENT_DID_NOT_SETTLE/);
  arm('receiver-restored',90,[process.execPath,'test/test-receiver-retirement-native.js']);
  passed=true;
 } finally {
  // Persist failure status first; independent postflight must still be run by
  // root after exit/timeout, even if this best-effort finally cannot complete.
  save('summary',{passed:false,armsPassed:passed,commit,moduleHash,statuses,at:new Date().toISOString()});
  inventory('final');sources('final');
  save('summary',{passed,commit,moduleHash,statuses,at:new Date().toISOString()});
 }
}
