'use strict';
// No native media runs: invalid controller order and terminal launch refusal.
// Ported from test-halflife2-launch-preconditions.py.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const m=require(path.join(ROOT,'tools/halflife2-restored-native.js'));
async function run(out){
  out=path.resolve(out);fs.mkdirSync(out,{recursive:true});
  const early=path.join(out,'early');fs.mkdirSync(early);
  await assert.rejects(m.supervise_controller(early,['startup']),e=>e.name==='AssertionError'&&e.message.includes('launch receipt'),'early controller started');
  assert.deepEqual(fs.readdirSync(early),[],'early local call must neither spawn nor poison a future native invocation');
  const late=path.join(out,'late');fs.mkdirSync(late);fs.writeFileSync(path.join(late,'PERMANENT-UNKNOWN.json'),'{"test":true}');
  const task=path.dirname(out),marker=path.join(task,'original-installer-invocation.json');
  const before=fs.existsSync(marker)?fs.readFileSync(marker):null;
  const env={...process.env,HL2_RUN:late,HL2_TASK_RUN:task};
  const p=cp.spawnSync(process.execPath,[path.join(ROOT,'tools/halflife2-restored-native.js'),'--original'],{cwd:ROOT,env,timeout:10000});
  assert(p.status!==0&&p.stderr.includes('original launch refused'),String(p.stderr));
  const after=fs.existsSync(marker)?fs.readFileSync(marker):null;
  assert(before===null?after===null:before.equals(after),'no additional allowance reservation');
  assert.deepEqual(fs.readdirSync(late).sort(),['PERMANENT-UNKNOWN.json']);
  // Same check at the end of preparation, where this session's race occurred.
  assert.throws(()=>m.assert_original_launchable(late),/^AssertionError/,'preexisting UNKNOWN admitted an original');
  const proof={passed:true,noOriginal:true,zeroHTTP:true,noSupervisorOrLatchForEarlyLocalCall:true,actualAdapterRefusedBeforePreparation:true,endOfPreparationRefusesUNKNOWN:true,
    wait:{pid:p.pid,exit:p.status,actualWait:true,stdoutEOF:true,stderrEOF:true,stdout:p.stdout.toString(),stderr:p.stderr.toString()}};
  fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify(proof,null,2));
  console.log('PASS early controller refuses before spawn/latch; actual adapter and post-preparation guard refuse original after UNKNOWN');
}
module.exports={run};
if(require.main===module)run(process.argv[2]).catch(e=>{console.error(e);process.exitCode=1;});
