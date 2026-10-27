'use strict';
// Run after the unchanged portable frontend fixture, with --baseline=DIR --fixture=FILE --evidence=DIR.
// In preload mode this replaces only the source-closure supplier and observes real calls.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const arg=n=>process.argv.find(x=>x.startsWith(`--${n}=`))?.slice(n.length+3);
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
if(arg('isolation-config')){
  const cfg=JSON.parse(fs.readFileSync(arg('isolation-config'))),root=path.resolve(path.dirname(process.argv[1]),'..');
  const watx=require(path.join(root,'tools/watx.js')),closure=require(path.join(root,'tools/watx-closure.js'));
  const scopes=[],calls=[];let invocation=0;
  closure.watxSourceClosure=()=>({...cfg.fixture,source:cfg.fixture.source+(invocation?'\n(func $added (export "added") (result i32) (i32.const 9))':''),vfs:new Map(cfg.fixture.vfs)});
  const create=watx.createFrontendReuse;
  if(create)watx.createFrontendReuse=()=>{const scope=create();scopes.push(scope);return scope;};
  const compile=closure.compileClosure;
  closure.compileClosure=(c,opts)=>{
    const s=opts.frontendReuse,call={invocation,sourceSHA256:sha(c.source),vfs:[...c.vfs].map(([f,t])=>[f,sha(t)]),tailCalls:opts.tailCalls,nameSection:opts.nameSection||null,regionShake:opts.regionShake,scopeIndex:s?scopes.indexOf(s):-1,before:s?.stats()};
    const result=compile(c,opts);call.after=s?.stats();call.success=result.success;calls.push(call);return result;
  };
  if(cfg.repeat)process.once('beforeExit',()=>{
    invocation=1;delete require.cache[process.argv[1]];
    process.argv=process.argv.map(x=>x.startsWith('--out=')?'--out='+cfg.secondOut:x);
    require(process.argv[1]);
  });
  process.on('exit',()=>fs.writeFileSync(cfg.trace,JSON.stringify({scopes:scopes.map(s=>s.stats()),distinct:new Set(scopes).size,calls},null,2)));
}else{
  const {spawnSync}=require('child_process'),out=path.resolve(arg('evidence')),baseline=path.resolve(arg('baseline')),root=path.resolve(__dirname,'..');
  fs.mkdirSync(out,{recursive:true});const fixture=JSON.parse(fs.readFileSync(arg('fixture')));
  const results=[];
  function run(label,runnerRoot,setting,{repeat=true,names=true,shake=false,error=false}={}){
    const stem=path.join(out,label),config=stem+'.config.json';
    fs.writeFileSync(config,JSON.stringify({fixture:{...fixture,source:fixture.source+(error?'\n(include "missing")':'')+(shake?'\n(region.declare $MOVABLE (size 32))':'')},repeat,secondOut:stem+'-second.wasm',trace:stem+'.trace.json'}));
    const env={...process.env};delete env.WINE_WAT_FRONTEND_REUSE;
    if(setting!==undefined)env.WINE_WAT_FRONTEND_REUSE=setting;
    const argv=['--max-old-space-size=512','--require',__filename,path.join(runnerRoot,'tools/build-compile-wat.js'),'--isolation-config='+config,'--out='+stem+'.wasm'];
    if(names)argv.push('--names');if(shake)argv.push('--region-shake=reverse');
    const r=spawnSync(process.execPath,argv,{cwd:runnerRoot,env,encoding:'utf8',maxBuffer:1024*1024});
    fs.writeFileSync(stem+'.stdout',r.stdout||'');fs.writeFileSync(stem+'.stderr',r.stderr||'');
    fs.writeFileSync(stem+'.status.json',JSON.stringify({status:r.status,signal:r.signal,error:r.error?.message}));
    assert.strictEqual(r.status,error?1:0,r.stderr);assert.strictEqual(r.signal,null);
    const trace=JSON.parse(fs.readFileSync(stem+'.trace.json'));results.push({label,status:r.status,trace});return {stem,trace,stderr:r.stderr};
  }
  function eq(a,b,repeat,names){for(const inv of repeat?['','-second']:[''])for(const ext of names?['.wasm','.compat.wasm','.named.wasm']:['.wasm','.compat.wasm'])assert.deepStrictEqual(fs.readFileSync(a.stem+inv+ext),fs.readFileSync(b.stem+inv+ext));}
  // Reverse baseline/control/default order between optional-name configurations.
  for(const names of arg('remaining')?[]:[true,false]){
    const mode=names?'named':'plain';let a,b,c;
    if(names){a=run(mode+'-baseline',baseline);b=run(mode+'-off',root,'0');c=run(mode+'-default',root);}
    else{c=run(mode+'-default',root,undefined,{names});b=run(mode+'-off',root,'0',{names});a=run(mode+'-baseline',baseline,undefined,{names});}
    eq(a,b,true,names);eq(a,c,true,names);
    assert.strictEqual(c.trace.scopes.length,2);assert.strictEqual(c.trace.distinct,2);
    assert.strictEqual(b.trace.scopes.length,0);assert.strictEqual(a.trace.scopes.length,0);
    for(const inv of [0,1]){
      const calls=c.trace.calls.filter(x=>x.invocation===inv);assert.strictEqual(calls.length,names?3:2);
      assert(calls.every(x=>x.scopeIndex===inv));assert(calls.at(-1).after.hits>0);
      assert.strictEqual(calls[0].before.scans,0);assert.strictEqual(calls[0].before.entries,0);
    }
    assert.notStrictEqual(c.trace.calls[0].sourceSHA256,c.trace.calls.find(x=>x.invocation===1).sourceSHA256);
    assert.notDeepStrictEqual(fs.readFileSync(c.stem+'.wasm'),fs.readFileSync(c.stem+'-second.wasm'));
    if(!names)assert(!fs.existsSync(c.stem+'.named.wasm'));
  }
  const a=run('shake-baseline',baseline,undefined,{repeat:false,shake:true}),b=run('shake-default',root,undefined,{repeat:false,shake:true});eq(a,b,false,true);
  const ea=run('error-baseline',baseline,undefined,{repeat:false,error:true}),eb=run('error-default',root,undefined,{repeat:false,error:true});assert.strictEqual(ea.stderr,eb.stderr);
  fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify({pass:true,invocations:results,contract:'actual pinned production CLI, baseline bytes/errors, default/off, names/shake, repeated invocation creates new scopes'},null,2));
  console.log(JSON.stringify({pass:true,cliProcesses:results.length,repeatedInvocationScopes:'distinct and empty at invocation entry'}));
}
