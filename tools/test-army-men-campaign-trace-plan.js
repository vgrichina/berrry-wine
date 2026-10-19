'use strict';
// Pure JS protocol test: actual ctl client, mock HTTP server; no emulator.
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process');
const plan=require('./army-men-campaign-trace-plan');
const runtime=process.argv[2];assert(runtime);
const source=fs.readFileSync(path.join(runtime,'test/run.js'),'utf8');
assert(source.includes("const [name, arg, len] = spec.split(':')"));
assert(source.includes("if (cmd.action === 'trace-api')"));
assert(source.includes('set_api_log(on ? 1 : 0)'));
assert(plan.flags.includes('--trace-api-paused'));
assert(!plan.flags.some(s=>/break|skip|trace-host/.test(s)));
for(const s of plan.memorySpecs){const [n,a,l]=s.split(':');assert(plan.apiNames.includes(n));assert(+a>=0&&+l<=128);}
const seen=[];
const server=http.createServer((req,res)=>{let raw='';req.on('data',x=>raw+=x);req.on('end',()=>{seen.push(JSON.parse(raw));res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,value:{batch:123}}));});});
server.listen(0,'127.0.0.1',()=>{
 const child=cp.spawn(process.execPath,[path.join(runtime,'tools/ctl.js'),'-s',':'+server.address().port,'pipe'],{stdio:['pipe','pipe','pipe']});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 child.stdin.end([...plan.reviewedMenuCommands,...plan.pauseCommands].map(c=>JSON.stringify(c)).join('\n')+'\n');
 child.on('close',code=>{server.close();assert.equal(code,0,output);assert.deepEqual(seen,[...plan.reviewedMenuCommands,...plan.pauseCommands]);assert.equal(output.trim().split('\n').length,3);console.log('PASS actual ctl ordered trace-on / click / trace-off protocol against mock; no guest executed');});
});
