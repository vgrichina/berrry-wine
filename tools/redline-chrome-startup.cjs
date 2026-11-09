'use strict';
const fs = require('node:fs');

// A stderr listener announcement is evidence, never endpoint admission.
function observeStartup(child, exit) {
  const evidence = {pid:child.pid, exit:null, waitError:null, stderrTail:'',stderrAt:null};
  child.stderr?.on('data', b => {
    evidence.stderrTail = (evidence.stderrTail + b.toString()).slice(-8192);
    evidence.stderrAt=Date.now();
  });
  exit.then(value => { evidence.exit=value; }, e => { evidence.waitError=String(e); });
  return evidence;
}

function publicationSnapshot(file) {
  try {
    const size=fs.statSync(file).size;
    return {at:Date.now(),size,...(size<=4096?{text:fs.readFileSync(file,'utf8')}:{error:'publication exceeds 4096 bytes'})};
  } catch(e) { return {at:Date.now(),error:e.code??String(e)}; }
}

async function portPublication({file, exit, evidence, deadline, guard, save,
  wait = ms => new Promise(r => setTimeout(r, ms))}) {
  const started=Date.now(); let polls=0, lastRead='ENOENT';
  const ended=exit.then(value=>({exit:value}), error=>({waitError:String(error)}));
  const record = outcome => save('chrome-startup.json', {outcome,started,elapsedMs:Date.now()-started,
    polls,pollLimit:100,pollMs:100,deadline,file,lastRead,...evidence});
  try {
    for (;;) {
      guard();
      if (evidence.exit || evidence.waitError) throw Error('Chrome child exited before port publication');
      if (Date.now()>=deadline) throw Error('immutable runtime cap before port publication');
      let text;
      try {
        if(fs.statSync(file).size>4096) throw Error('DevToolsActivePort exceeds 4096 bytes');
        text=fs.readFileSync(file,'utf8'); lastRead='read';
      }
      catch(e) { lastRead=e.code??String(e); if(e.code!=='ENOENT') throw e; }
      if (text!==undefined) {
        const [port,path,...extra]=text.trim().split('\n');
        if (!/^\d+$/.test(port)||Number(port)<1||Number(port)>65535||
            !/^\/devtools\/browser\/[^\s]+$/.test(path)||extra.length)
          throw Error('invalid DevToolsActivePort publication');
        guard(); record('published'); return {debugPort:Number(port),browserPath:path};
      }
      if(polls===100) throw Error('DevToolsActivePort unpublished after 100x100ms poll');
      polls++;
      const result=await Promise.race([wait(Math.min(100,Math.max(0,deadline-Date.now()))),ended]);
      if(result?.exit||result?.waitError) throw Error('Chrome child exited before port publication');
    }
  } catch(e) { record(evidence.exit||evidence.waitError?'child-exit':'publication-failure'); throw e; }
}
module.exports={observeStartup,portPublication,publicationSnapshot};
