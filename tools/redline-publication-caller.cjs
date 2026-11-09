'use strict';
// Outer launch adapter: the actual Redline consumer still owns its Chrome child.
// Never wrap nativeTrace.launch(): a supervisor PID is not a browser wait receipt.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),version='redline-publication-d0a9965a8-d54aa57e3-f977ebf7c-v1';
const providers=Object.freeze({
 'tools/native_publication_launch.py':'3dc65b811a9b73a85fa5c4f9482d8a063865d397994e8160e08c51985f5f7d89',
 'tools/native_publication_observer.py':'6be7149c7dfd6b190f65c19ebdc8fa1d91c26c2cd13c9a5d15917b08347ba060',
 'tools/native_kernel_custody.py':'3448afd4c5ec4ea691c584a6cfde3a61b72f5c9143458189c1035f374c4c6240',
 'tools/redline-native-trace.cjs':'ece30567fa04b462d18fcf88949b6160328fa6cce5d273fd48cc33c013ee33f0'
});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function verify(){
 for(const [name,digest] of Object.entries(providers))assert.equal(sha(fs.readFileSync(path.join(root,name))),digest,'published provider drift before spawn: '+name);
}
function command({observerVersion,run,argv=[process.execPath,path.join(__dirname,'redline-native-trace.cjs'),'--caller'],python='python3',maxRecords=4096,maxBytes=4*1024*1024}={}){
 assert(Array.isArray(argv)&&argv.length&&argv.every(x=>typeof x==='string'),'literal command argv');
 if(observerVersion===undefined)return {executable:argv[0],argv:argv.slice(1),observerEnabled:false};
 assert.equal(observerVersion,version,'unknown Redline publication version');verify();
 assert(Number.isSafeInteger(maxRecords)&&maxRecords>=2&&maxRecords<=65536,'record bound');
 assert(Number.isSafeInteger(maxBytes)&&maxBytes>=4096&&maxBytes<=64*1024*1024,'byte bound');
 assert(path.isAbsolute(run),'absolute existing custody run');
 const life=JSON.parse(fs.readFileSync(path.join(run,'lifecycle.json')));
 assert(Number.isFinite(life.browserDeadline)&&life.browserDeadline>Date.now(),'original browserDeadline required');
 return {executable:python,argv:[path.join(__dirname,'native_publication_launch.py'),run,'--journal-gzip','--publication-observer=d54aa57e3','--max-records='+maxRecords,'--max-bytes='+maxBytes,'--',...argv],observerEnabled:true};
}
function launch({spawn=cp.spawn,options,...input}={}){
 const selected=command(input);return spawn(selected.executable,selected.argv,options);
}
// No custody or publication inference from Chrome JSON, EOF, or a valid gzip.
// Revalidate raw bounded regular files; never trust publication-validation.json.
function retrieve(run,{maxCustodyBytes=64*1024*1024,python='python3'}={}){
 verify();assert(path.isAbsolute(run));
 assert(Number.isSafeInteger(maxCustodyBytes)&&maxCustodyBytes>0&&maxCustodyBytes<=64*1024*1024);
 const bounds={'kernel-drain.json':4*1024*1024,'publication-launch.json':128*1024,
  'publication-syscalls.ndjson':4*1024*1024,'custody.ndjson.gz':maxCustodyBytes,'kernel-command.log':64*1024*1024};
 const artifacts={},snapshots={};
 for(const [name,limit] of Object.entries(bounds)){
  const file=path.join(run,name);let fd;
  try{
   fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NONBLOCK|fs.constants.O_NOFOLLOW);
   const st=fs.fstatSync(fd);assert(st.isFile()&&(st.size>0||name==='kernel-command.log')&&st.size<=limit,'bounded regular evidence: '+name);
   const buffer=Buffer.alloc(st.size);let offset=0;
   while(offset<buffer.length){const n=fs.readSync(fd,buffer,offset,buffer.length-offset,null);if(!n)break;offset+=n;}
   assert.equal(offset,st.size,'evidence changed during bounded snapshot');
   assert.equal(fs.fstatSync(fd).size,st.size,'evidence grew during retrieval');const bytes=buffer.subarray(0,offset);
   artifacts[name]={bytes:bytes.length,sha256:sha(bytes)};
   snapshots[name]=bytes.toString('base64');
  }finally{if(fd!==undefined)fs.closeSync(fd);}
 }
 // Validation sees only these fd snapshots, never the mutable evidence paths.
 const report=JSON.parse(cp.execFileSync(python,[path.join(__dirname,'redline-publication-snapshots.py'),String(maxCustodyBytes)],{
  input:JSON.stringify(snapshots),encoding:'utf8',timeout:10000,maxBuffer:1024*1024}));
 return {artifacts,...report,publication:'UNKNOWN',readiness:'UNKNOWN',ancestry:'UNKNOWN',atomicity:'UNKNOWN'};
}
// Candidate is exactly the shipped generated consumer, including its launch
// and finalize/retrieve sites. No mutation of shared providers or historical pins.
function candidate(){verify();return require('./redline-native-trace.cjs').integrate();}
module.exports={version,providers,verify,command,launch,retrieve,candidate};
if(require.main===module){
 const args=process.argv.slice(2),mode=args.shift();
 if(mode==='--retrieve'){console.log(JSON.stringify(retrieve(path.resolve(args[0]))));}
 else{
  assert.equal(mode,'--launch','--launch CUSTODY_RUN [--publication-observer=VERSION] -- [actual caller argv]');
  const run=path.resolve(args.shift());let observerVersion,maxRecords,maxBytes;
  while(args[0]?.startsWith('--')&&args[0]!=='--'){
   const [name,value]=args.shift().split('=');
   if(name==='--publication-observer')observerVersion=value;
   else if(name==='--max-records')maxRecords=Number(value);
   else if(name==='--max-bytes')maxBytes=Number(value);
   else assert.fail('unknown adapter option: '+name);
  }
  assert(observerVersion!==undefined||(maxRecords===undefined&&maxBytes===undefined),'bounds require opt-in');
  assert.equal(args.shift(),'--','literal argv separator required');
  const child=launch({run,observerVersion,maxRecords,maxBytes,...(args.length?{argv:args}:{}),options:{stdio:'inherit'}});
  for(const sig of ['SIGTERM','SIGINT','SIGHUP'])process.on(sig,()=>child.kill(sig));
  child.once('error',e=>{console.error(e);process.exitCode=1;});
  child.once('exit',(code,signal)=>{process.exitCode=code??1;if(signal)console.error('actual owner signal '+signal);});
 }
}
