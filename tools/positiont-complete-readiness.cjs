#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert');
const {root,evidence,admit}=require('./positiont-complete-resource.cjs');
const blob=b=>crypto.createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const receipt={candidate:'7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6',acceptance:'aea185d3dfc1b772cea00ca1a4aed14b9553dfed',argv:process.argv,canonical:[],fullCompile:'UNEXECUTED',runtime:'UNEXECUTED'};
let stage='complete input identities';
try{
 assert(JSON.parse(fs.readFileSync(path.join(evidence,'admission.json'))).admitted);
 admit('driver');
 const rows=JSON.parse(fs.readFileSync(path.join(evidence,'manifest.json'))),review=JSON.parse(fs.readFileSync(path.join(evidence,'closure.json')));
 for(const [f,h,n,d,life,start] of rows){
  if(start==='initial')assert.equal(blob(fs.readFileSync(path.join(root,f))),h,'exact materialized input '+f);
  else {const b=d.includes(':object:')?cp.execFileSync('git',['-C',d.split(':object:')[0],'cat-file','blob',h],{env:{...process.env,GIT_NO_LAZY_FETCH:'1'},maxBuffer:8*1048576}):fs.readFileSync(path.join(d,f));assert.equal(blob(b),h,'available deferred input '+f);}
 }
 const actual=[];
 function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){if(e.name.startsWith('.')||e.name==='node_modules')continue;const f=dir?dir+'/'+e.name:e.name;if(e.isDirectory()&&dir)walk(f);else if(e.isFile()&&f.endsWith('.js'))actual.push(f);}}
 walk('');for(const dir of ['lib','tools','test'])walk(dir);
 assert.deepEqual(actual.sort(),[...review.universes.rootJS,...review.universes.recursiveJS].sort(),'whole exact scanner JS set equality');
 assert.deepEqual(fs.readdirSync(path.join(root,'src')).filter(f=>/\.watx?$/.test(f)).map(f=>'src/'+f).sort(),review.universes['WAT-WATX']);
 const pins=require('../test/support/positiont-com-source-pins.json'),byPath=new Map(rows.map(r=>[r[0],r[1]]));
 for(const [f,h] of Object.entries(pins))assert.equal(byPath.get(f),h);
 receipt.pinCount=Object.keys(pins).length;
 if(process.argv.includes('--verify-only')){console.log('INPUTS COMPLETE');process.exit(0);}
 stage='canonical boundary';
 const build=fs.readFileSync(path.join(root,'tools/build.sh'),'utf8'),boundary='node tools/build-compile-wat.js\n';
 assert.equal(blob(Buffer.from(build)),'5407cb296ee6cdab2e30a226d1188206beb852af');assert.equal(build.split(boundary).length,2);
 const prefix=build.slice(0,build.indexOf(boundary));
 receipt.prefix={blob:blob(Buffer.from(build)),sha256:sha(prefix),firstExcluded:boundary.trim(),unaltered:true};
 const script=path.join(root,'tools/.positiont-complete-prefix.sh'),log=path.join(evidence,'canonical.log');
 fs.writeFileSync(script,prefix+'\nexit 0 # separately authorized readiness boundary\n',{flag:'wx'});
 const fd=fs.openSync(log,'wx');
 const env={...process.env,GIT_NO_LAZY_FETCH:'1',NODE_OPTIONS:'--max-old-space-size=512 --require='+path.join(__dirname,'positiont-complete-guard.cjs'),PS4:'+READINESS ${LINENO}: '};
 const argv=['--signal=TERM','--kill-after=5s','600s','/usr/bin/prlimit','--cpu=600','--fsize=524288','--','/bin/bash','-x',script];
 receipt.launch={command:'/usr/bin/timeout',argv,nodeOptions:env.NODE_OPTIONS,stdoutAndStderrLimit:524288};
 stage='canonical prerequisites';
 let result;try{result=cp.spawnSync('/usr/bin/timeout',argv,{cwd:root,env,stdio:['ignore',fd,fd]});}finally{fs.closeSync(fd);fs.unlinkSync(script);}
 receipt.shellExit=result.status;receipt.signal=result.signal;
 const transcript=fs.readFileSync(log,'utf8'),processes=new Map();
 for(const line of transcript.split('\n')){
  if(line.startsWith('READINESS_ARGV ')){const r=JSON.parse(line.slice(15));processes.set(r.pid,r);}
  if(line.startsWith('READINESS_EXIT ')){const r=JSON.parse(line.slice(15));if(processes.has(r.pid))processes.get(r.pid).exit=r.exit;}
 }
 receipt.canonical=[...processes.values()];receipt.firstCanonicalFailure=receipt.canonical.find(r=>r.exit!==0);
 receipt.decoder=transcript.split('\n').filter(s=>s.startsWith('READINESS_DECODER_')).map(s=>({kind:s.split(' ')[0],...JSON.parse(s.slice(s.indexOf(' ')+1))}));
 assert.equal(result.status,0,'first canonical gate failure; stop without retry');
 stage='final exact pins';
 require('../test/support/positiont-com-module').verifySources();
 admit('final');receipt.verdict='READY';receipt.exit=0;
}catch(error){receipt.verdict='BLOCKED';receipt.exit=1;receipt.firstFailure={stage,message:error.message};}
if(process.argv.includes('--verify-only')){console.log(JSON.stringify(receipt.firstFailure));process.exit(receipt.exit);}
fs.writeFileSync(path.join(evidence,'readiness.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({verdict:receipt.verdict,firstFailure:receipt.firstFailure}));process.exitCode=receipt.exit;
