'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),vm=require('vm');
const assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(process.argv[2]);
const file=path.join(root,'tools/maelstrom-breakpoint-boundary-audit.cjs');
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
  'd0f2ccd205be29c38598137f0c894486dc694f9de91b855852721b85f998b606');
const a=require(file),dir=path.join(root,'docs/re-notes/maelstrom-breakpoint-boundary-audit-20261024');
const read=n=>zlib.gunzipSync(fs.readFileSync(path.join(dir,n))).toString();
const s=a.transform(read('historical-runner.js.gz'),{enabled:true,exportsSource:read('historical-13-exports.wat.gz')});
const watch=s.slice(s.indexOf('  let watchActive = false;'),s.indexOf('\n  // Arm shadow call-stack',s.indexOf('  let watchActive = false;')));
const init=s.slice(s.indexOf('  const maelstromBoundaryAudit = '),s.indexOf(a.anchors.init));
let reads=0,runs=0,error=null;
const ctx={Buffer,watchAddr:0x1000,watchSize:4,watchPrevVal:0,WATCH_JS_ONLY:true,WATCH_START_BATCH:0,
  readGuestSized:()=>{reads++;return 0;},instance:{exports:{run:()=>runs++}},
  countAddrs:[],traceAtAddrs:[0x7a3366],TRACE_AT_START_BATCH:36163,TRACE_AT_LIMIT:1,
  getArg:()=> 'eax:4,esp+0x124:12',process:{stderr:{write:()=>assert.fail('unexpected audit output')}}};
try{vm.runInNewContext(watch+'\n'+init,ctx,{timeout:1000});}catch(e){error=e.message;}
assert.match(error,/watchpoint configuration conflicts/);assert.equal(runs,0);
console.log(JSON.stringify({candidate:'9fcd3188383b18756232580026840522a454358b',readsBeforeRejection:reads,mainRuns:runs,error,expectedReads:0,guestInstantiated:false}));
if(process.argv.includes('--acceptance-oracle'))assert.equal(reads,0,'JS-only conflict must reject BEFORE memory read');
else assert.equal(reads,1,'reproduce exactly one pre-rejection memory read');
