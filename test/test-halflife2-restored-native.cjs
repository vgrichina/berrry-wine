'use strict';
// Observe the real adapter's actual subprocess cleanup and exact trigger.
// Ported from test-halflife2-restored-native.py. The Python test replaced
// os.statvfs; the JS adapter reads free space through its free_bytes seam.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
if(process.argv[2]==='--authored-child'){
  process.stdout.write('authored stdout\n');setTimeout(()=>{},100);
}else (async()=>{
  const m=require('../tools/halflife2-current-native.js');
  const out=process.argv[2];fs.mkdirSync(out,{recursive:true});
  const waitExit=p=>p.exitCode!==null||p.signalCode!==null?Promise.resolve(p.exitCode??-require('node:os').constants.signals[p.signalCode]):new Promise(r=>p.once('exit',(c,s)=>r(c??-require('node:os').constants.signals[s])));
  for(const [kase,free] of [['floor',1499999744],['stop',2000000000],['unknown',2000000000],['normal',2000000000]]){
    m.RUN=path.join(out,kase);fs.mkdirSync(m.RUN);
    if(kase==='stop')fs.writeFileSync(path.join(m.RUN,'stop-native.json'),'{}');
    if(kase==='unknown')fs.writeFileSync(path.join(m.RUN,'PERMANENT-UNKNOWN.json'),'{}');
    const saved=m.free_bytes;m.free_bytes=()=>free;
    const helper={native_identity:p=>({pid:p.pid}),terminate_owned:p=>Promise.race([waitExit(p),new Promise((_,j)=>setTimeout(()=>j(new Error('timeout')),10000))])};
    try{
      try{await m.execute_native([process.execPath,__filename,'--authored-child'],process.env,[],helper,'fixture');}
      catch(e){if(e.name!=='SystemExit')throw e;assert(kase!=='normal'&&e.exitCode===143,kase+' exit '+e.exitCode);}
    }finally{m.free_bytes=saved;}
    const w=JSON.parse(fs.readFileSync(path.join(m.RUN,'native-wait.json')));assert(w.actualWait&&w.stdoutEOF&&w.stderrEOF);
    if(kase==='normal')assert(!w.hostCleanup&&!fs.existsSync(path.join(m.RUN,'native-cleanup-trigger.json')));
    else{
      const t=JSON.parse(fs.readFileSync(path.join(m.RUN,'native-cleanup-trigger.json')));
      assert(t.freeBytes===free&&t.diskFloor===(kase==='floor'));
      assert.equal(t.reason,{floor:'disk-floor',stop:'stop-requested',unknown:'permanent-unknown'}[kase]);
      assert(w.hostCleanup&&!w.nativeQuit);
    }
  }
  console.log('PASS exact disk/stop/UNKNOWN trigger, native actual wait and both EOF; normal closure distinct');
})().catch(e=>{console.error(e);process.exitCode=1;});
