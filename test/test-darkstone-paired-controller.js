const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const {validateConfig,routeCommand,PRESERVED,runChild,cleanEnvironment,immutableSources}=require(root+'/tools/darkstone-paired-validation');
const c={root:'/home/user/wa-darkstone-paired',out:'/home/user/darkstone-paired-evidence',baseline:'/home/user/darkstone-town-2-evidence/preflight.json',dependencyReference:'/home/user/wa-darkstone-validation',commit:'a'.repeat(40),baselineSha256:'b'.repeat(64),archiveAfter:'2026-10-15T19:00:00Z'};
assert.equal(validateConfig(c),c);assert.equal(PRESERVED.length,7);
for(const patch of [{root:c.dependencyReference},{root:'/home/user/wa-ne-context-native'},{commit:'HEAD'},{baselineSha256:'mutable'},{out:c.root+'/evidence'},{archiveAfter:'no'},{baseline:'relative'}])assert.throws(()=>validateConfig({...c,...patch}));
const source=fs.readFileSync(root+'/tools/web-input-probe.js','utf8');const text=source.slice(source.indexOf('function validateQueuedSteps('),source.indexOf('async function* probeSteps'));
const validate=vm.runInNewContext('('+text.trim()+')',{path,fs,ROOT:root});const capture=c.out+'/software/capture';
for(const name of ['name','create','select','slot','accept'])validate(routeCommand(name,capture),capture+'/commands');
assert.throws(()=>routeCommand('hidden',capture));
assert.throws(()=>validate({steps:['shot:relative.png']},capture+'/commands'));
const collector=fs.readFileSync(root+'/tools/capture-legacy-render-evidence.js','utf8');
const d3d={renderEndpointId:12,completedFenceSequence:3,d3dimSoftwareDrawCallsCompleted:7,d3dimFallbackSoftwareDrawCallsCompleted:0};
const observed=vm.runInNewContext(collector,{wine:{guestWorker:{},_workerLastSlice:{seq:4,d3d},threadManager:{threads:new Map([[1,{tid:2,state:'active'}]])}}});
assert.equal(observed.mainGuestSlice.d3d.renderEndpointId,12);assert.equal(observed.childThreads[0].tid,2);assert(observed.childThreads[0].ownership.includes('no child'));
assert.equal(vm.runInNewContext(collector,{}).available,false);
console.log('PASS config donor/commit/path guards, five exact-validator route commands, basename rejection, owner snapshot and child limitation');

assert.deepEqual(cleanEnvironment({PATH:'/bin',WA_TEST:'x',WINE_TEST:'x',NODE_OPTIONS:'x',NODE_PATH:'x',CHROME:'/chrome'}),{PATH:'/bin',CHROME:'/chrome'});
const cp=require('node:child_process'),os=require('node:os');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'darkstone-controller-'));
const run=(bin,args)=>cp.execFileSync(bin,args,{cwd:temp,encoding:'utf8'});
try {
 run('git',['init','-q']);fs.writeFileSync(path.join(temp,'source.txt'),'immutable\n');fs.symlinkSync('source.txt',path.join(temp,'link'));
 run('git',['add','.']);run('git',['-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture']);
 const commit=run('git',['rev-parse','HEAD']).trim();assert.equal(immutableSources(temp,commit,run).length,2);
 run('git',['update-index','--assume-unchanged','source.txt']);fs.writeFileSync(path.join(temp,'source.txt'),'tampered\n');
 assert.equal(run('git',['status','--porcelain']).trim(),'');assert.throws(()=>immutableSources(temp,commit,run),/immutable source differs/);
 fs.writeFileSync(path.join(temp,'source.txt'),'immutable\n');fs.unlinkSync(path.join(temp,'link'));fs.symlinkSync('other',path.join(temp,'link'));assert.throws(()=>immutableSources(temp,commit,run),/immutable source differs/);
} finally {fs.rmSync(temp,{recursive:true,force:true});}
(async()=>{
 const options={env:cleanEnvironment(),stdio:'ignore'};
 const normal=await runChild(process.execPath,['-e',"require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}).unref()"],options,()=>{},3000,100);
 assert.equal(normal.status,0);assert.equal(normal.remainingGroupProcesses.length,0);
 const timeout=await runChild(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],options,()=>{},150,100);
 assert(timeout.timedOut);assert(timeout.signals.some(s=>s.signal==='SIGKILL'));assert.equal(timeout.remainingGroupProcesses.length,0);
 const missing=await runChild('/nonexistent-darkstone-test',[],options,()=>{},100,100);assert(missing.error);assert.equal(missing.remainingGroupProcesses.length,0);
 console.log('PASS immutable-tree bytes including assume-unchanged and symlink rejection; env filtering; normal orphan, timeout TERM/KILL, spawn error cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
