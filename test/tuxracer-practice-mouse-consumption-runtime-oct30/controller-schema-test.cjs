'use strict';
// Execute the exact retained runner's two control functions without a guest.
const fs = require('fs'), vm = require('vm'), crypto = require('crypto');
const source = fs.readFileSync('test/run.js', 'utf8');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
if (sha(source) !== 'f96e9bb924700ee571e2904e097f80742ff55638399898ae1dc32454af05b02d') throw Error('runner identity');
function extract(name) {
  const start = source.indexOf('  const ' + name + ' =');
  if (start < 0 || source.indexOf('  const ' + name + ' =', start + 1) >= 0) throw Error('marker identity');
  const end = source.indexOf('\n  };', start);
  if (end < 0) throw Error('function boundary');
  return source.slice(start, end + 5);
}
const parser = extract('parseInputEntries'), handler = extract('handleControlCommand');
const context = vm.createContext({});
vm.runInContext('let scheduledInput=[], tickState={batch:7}, controlFrozen=true;\n' + parser + '\n' + handler + '\nglobalThis.handle=handleControlCommand; globalThis.queued=()=>scheduledInput;', context);
for (const cmd of ['keydown:13', 'keyup:13', 'mousemove:320:260', 'mousedown:320:260', 'mouseup:320:260']) {
  if (!context.handle({cmd}).queued) throw Error('ordinary command was not queued');
}
let rejected = 0;
for (const command of [{action: 'keydown', code: 13}, {action: 'keyup', code: 13}, {cmd: 'misspelled:13'}]) {
  try { context.handle(command); } catch (_) { rejected++; }
}
if (rejected !== 3) throw Error('invalid schema accepted');
const events = context.queued();
if (events.length !== 5 || events[0].action !== 'keydown' || events[0].code !== 13 || events[1].action !== 'keyup' || events[2].action !== 'mousemove' || events[3].action !== 'mousedown' || events[4].action !== 'mouseup' || events[2].x !== 320 || events[2].y !== 260) throw Error('native event mismatch');
console.log(JSON.stringify({PASS:true,guest:false,runner:sha(source),parser:sha(parser),handler:sha(handler),positive:5,rejected,events}));

if(process.argv.includes('--pipe')) {
 require('readline').createInterface({input:process.stdin}).on('line',line=>{
  const c=JSON.parse(line),result=context.handle(c);
  console.log(JSON.stringify({id:c.id,result,events:context.queued()}));
 });
} else {
 const cp=require('child_process').spawnSync(process.execPath,['--max-old-space-size=256',__filename,'--pipe'],{input:JSON.stringify({id:'pipe-practice',cmd:'mousemove:320:260'})+'\n',encoding:'utf8',timeout:3000,maxBuffer:8192});
 if(cp.status!==0)throw Error(cp.stderr);
 const v=JSON.parse(cp.stdout.trim().split('\n').pop());
 if(v.id!=='pipe-practice'||!v.result.queued||v.events.at(-1).x!==320)throw Error('pipe transport');
 console.log(JSON.stringify({pipe:true,productionParser:true,PASS:true}));
}
