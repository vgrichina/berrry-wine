#!/usr/bin/env node
'use strict';
// Serial factorial driver. The runner must match the frozen WASM revision.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert'),os=require('os');
const [mode,modulesArg,runnerArg,outArg]=process.argv.slice(2);
assert(outArg,'native|kernel|tiered|games MODULES FROZEN_RUNNER OUT');
const modules=path.resolve(modulesArg),runner=path.resolve(runnerArg),out=path.resolve(outArg);
const arms=['control','p','c','pc','d','pd','cd','pcd'];
fs.mkdirSync(out,{recursive:true});
const node=(args,extra={})=>cp.execFileSync(process.execPath,args,{cwd:runner,stdio:'inherit',...extra});
const wasm=v=>path.join(modules,v,'candidate.wasm'),named=v=>path.join(modules,v,'candidate.named.wasm');
for(const v of arms)assert(fs.existsSync(wasm(v)),v);
fs.writeFileSync(out+'/host.json',JSON.stringify({node:process.version,v8:process.versions.v8,arch:process.arch,cpu:os.cpus()[0].model,load:os.loadavg(),command:process.argv},null,2));
if(mode==='native'){
  for(const v of arms)for(const e of ['node','sm'])node([path.join(__dirname,'bench-fp-native.js'),e,wasm(v),named(v),path.join(out,e,v)]);
}else if(mode==='kernel'||mode==='tiered'){
  for(const v of arms){
    const dir=path.join(out,v);fs.mkdirSync(dir,{recursive:true});
    const fd=fs.openSync(dir+'/kernel.json','w');
    const flags=mode==='tiered'?['--prof','--perf-prof','--no-wasm-async-compilation',`--logfile=${dir}/v8.log`,`--perf-prof-path=${dir}`]:[];
    try{node([...flags,path.join(runner,'tools/bench-mw3-mixed-kernel.js'),wasm(mode==='tiered'?v:'control'),wasm(v)],
      {env:{...process.env,MIXED_CONTROL:'1',MIXED_VERTICES:'500000',MIXED_ROUNDS:mode==='tiered'?'6':'10'},stdio:['ignore',fd,'inherit']});}
    finally{fs.closeSync(fd);}
    const result=JSON.parse(fs.readFileSync(dir+'/kernel.json'));
    console.log(v,result.summary);
    if(mode==='tiered'){
      node([path.join(__dirname,'bench-mw3-mixed-native.js'),'decode',wasm(v),named(v),dir],
        {env:{...process.env,NATIVE_FUNCS:'x87_island_fast,x87_island_fast_mixed',OBJDUMP:process.env.OBJDUMP||(process.platform==='darwin'?'/opt/homebrew/opt/binutils/bin/objdump':'/usr/bin/objdump')}});
      fs.writeFileSync(dir+'/ticks.json',cp.execFileSync(process.execPath,[path.join(__dirname,'bench-fp-native-ticks.js'),dir],{maxBuffer:16<<20}));
    }
  }
}else if(mode==='games'){
  const order=[...arms,...arms.slice().reverse().map(v=>v+'2')];
  node([path.join(runner,'tools/uop-game-ab.js'),'--no-build','--games=mh3,q2,h3,h2',`--arms=${order.join(',')}`,
    ...arms.map(v=>`--arm=${v}=--wasm=${wasm(v)}`),'--jobs=1','--extra=--max-seconds=600 --no-threads --x87-fusion',`--out=${out}/corpus`]);
}else throw Error('unknown mode '+mode);
