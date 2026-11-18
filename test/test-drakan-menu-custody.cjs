'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const c=require('../tools/native-supervisor-common.cjs');
async function run(root){
 root=path.resolve(root);fs.mkdirSync(root,{recursive:true});
 for(const mode of ['old','new']){
  const out=path.join(root,mode);fs.mkdirSync(out);
  let fixture;
  if(mode==='old'){
   // Reproduce the retired helper's two changed deadline constants from
   // tracked source; no retained run or source-tree snapshot is required.
   let source=fs.readFileSync(require.resolve('../tools/blood2-durable-launcher.cjs'),'utf8');
   source=source.replaceAll('cfg.deadline + 1','cfg.deadline + 20').replace('deadline: cfg.deadline + 3','deadline: cfg.deadline');
   source=source.replace(/require\('\.\/([^']+)'\)/g,(_,name)=>'require('+JSON.stringify(path.resolve(__dirname,'../tools',name))+')');
   fixture=path.join(out,'old-custody-fixture.cjs');fs.writeFileSync(fixture,source);
  }
  const at=c.now(),module=mode==='old'?fixture:'../tools/drakan-menu-custody.cjs';
  // Real child ignores TERM; finite custody must escalate and actually wait.
  require(module).launch({run:out,command:[process.execPath,'-e',"process.on('SIGTERM',()=>{});console.log('native stdout');console.error('native stderr');setInterval(()=>{},25)"],deadline:at+2,cleanupDeadline:at+40});
  const end=at+42;while(!fs.existsSync(path.join(out,'owner-complete.json'))){assert(c.now()<end);await c.sleep(25);}
  const result=c.readJSON(path.join(out,'owner-complete.json'));assert.equal(result.receipt.leaked,false);
  if(fixture)fs.unlinkSync(fixture);
  if(mode==='old')assert.equal(result.retainedActualWaits,false);
  else{assert.equal(result.retainedActualWaits,true);for(const name of ['native','watchdog']){const w=c.readJSON(path.join(out,name+'-wait.json'));assert(w.actualWait&&w.stdoutEOF&&w.stderrEOF);assert.equal(w.drainErrors.length,0);}const watch=c.readJSON(path.join(out,'watchdog-armed.json'));assert.equal(watch.deadline,at+22);}
 }
 c.save(root,'assertions.json',{pass:true,oldDeadlineLostPipeWaits:true,newGuestDeadlineAndIndependentWatchWithActualBothEOF:true});
}
if(require.main===module)run(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1});module.exports={run};
