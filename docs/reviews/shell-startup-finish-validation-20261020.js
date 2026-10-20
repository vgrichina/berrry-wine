'use strict';
// Sparse object-backed reader: execute unchanged production tools without
// materializing the rest of the tree. No full compiler closure or guest runs.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process');
const assert=require('assert/strict'),crypto=require('crypto');
const root=process.cwd(),base='8bcd437fa4852417b13d375e54e07280621a161a';
const result={inputs:{},checks:[],controls:[],adapters:[]};
function gate(){
  const s=fs.statfsSync(root),available=s.bavail*s.bsize,required=2285895680;
  console.log(JSON.stringify({available,required}));assert(available>=required,'RESOURCE BLOCKER; no cleanup/retry');
}
function source(p){
  const rel=path.relative(root,path.resolve(root,p));
  const s=fs.existsSync(path.join(root,rel))?fs.readFileSync(path.join(root,rel),'utf8'):
    cp.execFileSync('git',['show',`${base}:${rel}`],{encoding:'utf8',maxBuffer:32*1024*1024});
  result.inputs[rel]=crypto.createHash('sha256').update(s).digest('hex');return s;
}
const tree=cp.execFileSync('git',['ls-tree','-r','--name-only',base],{encoding:'utf8'}).trim().split('\n');
const virtualFs={...fs,
  readFileSync:(p,enc)=>{const s=source(p);return enc?s:Buffer.from(s);},
  existsSync:p=>fs.existsSync(p)||tree.includes(path.relative(root,p)),
  readdirSync:p=>[...new Set(tree.filter(f=>f.startsWith(path.relative(root,p)+'/')).map(f=>f.slice(path.relative(root,p).length+1).split('/')[0]))],
};
const cache=new Map();
function load(p){
  p=path.resolve(root,p);if(!path.extname(p))p+='.js';
  if(cache.has(p))return cache.get(p).exports;
  const m={exports:{}};cache.set(p,m);
  const req=n=>n==='fs'?virtualFs:n.startsWith('.')||path.isAbsolute(n)?load(path.resolve(path.dirname(p),n)):require(n);
  const fn=vm.runInThisContext('(function(require,module,exports,__dirname,__filename){\n'+source(p).replace(/^#![^\n]*/,'')+'\n})',{filename:p});
  fn(req,m,m.exports,path.dirname(p),p);return m.exports;
}
function check(name,fn){fn();result.checks.push(name);}
function reject(name,fn){assert.throws(fn,undefined,name);result.controls.push(name);}
function section(s,start,end){const a=s.indexOf(start);assert(a>=0,start);const b=s.indexOf(end,a)+end.length;assert(b>a,end);return s.slice(a,b);}
async function main(){
  gate();
  const boot=load('lib/process-boot.js'),cli=source('test/run.js'),host=source('host.js'),browser=source('lib/browser-shell.js');
  for(const value of [undefined,null,-1,0,1,2,7]){
    const calls=[];boot.applyStartupShow({set_startup_show:n=>calls.push(n)},value);
    const want=value===undefined||value===null||value===-1?undefined:value;
    check('boot absence/zero '+String(value),()=>assert.deepEqual(calls,want===undefined?[]:[want]));
    check('CLI serialization '+String(value),()=>assert.deepEqual(boot.startupShowArgs(value),want===undefined?[]:[`--startup-show=${want}`]));
  }
  for(const value of [10,12,-2,'bad',1.5])check('reject invalid startup '+value,()=>assert.throws(()=>boot.startupShowCommand(value)));
  const browserCall=section(browser,'      const ok = await wine.loadExe(app.exe, {','\n      });');
  async function browserTest(text,showCmd){
    let observed;
    const fn=new Function('wine','app','launchArgs','dynamicExeBytes','launchOpts',`return (async()=>{${text};return ok})()`);
    assert.equal(await fn({loadExe:async(exe,opts)=>{observed=opts;return true;}},{exe:'child.exe',exeGuestPath:'C:\\child.exe'},'/arg',null,{showCmd}),true);
    assert.equal(observed.showCmd,showCmd);assert.equal(observed.args,'/arg');
  }
  for(const n of [undefined,0,1,2,7]){await browserTest(browserCall,n);result.checks.push('browser PE handoff '+n);}
  await assert.rejects(()=>browserTest(browserCall.replace('showCmd: launchOpts.showCmd,',''),0));result.controls.push('lost browser show option');
  const vfsBody=section(cli,'  const spawnVfsChild = (','\n  };');
  const spawnBody=section(cli,'  h.process_spawn = (','\n  };');
  function transport(text,showCmd,count){
    const seen=[], child={stdout:{on(){}},stderr:{on(){}},on(){},kill(){}};
    class ParentHub {addChild(){}}
    const guest='c:\\child.exe',files=new Map([[guest,new Uint8Array()]]);
    const c={console:{log(){}},h:{},threadSnapshotSystemIncomplete:false,
      ctx:{getMemory:()=>new ArrayBuffer(1024),vfs:{files,_resolvePath:x=>x.toLowerCase(),getCurrentDirectory:()=> 'c:\\'}},
      SPAWN_PROCESSES_FLAG:true,APP_ENTRY:null,EXE_GUEST_PATH:guest,EXE_PATH:'/fixtures/child.exe',
      parseShellLaunchCommand:()=>({file:'child.exe',params:'/arg'}),path,
      fs:{mkdtempSync:()=>'/fake',writeFileSync(){},existsSync:()=>true,readdirSync:()=>['child.exe']},
      saveVfsToHost:()=>[{guestPath:guest,outputPath:'/fixtures/child.exe'}],
      ASSET_ENTRY:null,DLL_SEED:[],appAsset:x=>x,PIPE_CHILD_ARGS:[],WASM_PATH:'/unused',MAX_SECONDS:1,
      startupShowArgs:boot.startupShowArgs,nextChildPid:()=>123,relayChild(){},pipeChildren:[],pipeChildByPid:new Map(),
      __filename:'/fixture/run.js',process:{on(){}},readStr:()=> 'child.exe',APP_ID:null,TRACE_NET:false,
      memory:{buffer:new ArrayBuffer(1024)},VLAN_IP:0x0A000001,canonicalPath:x=>x,instance:{exports:{}},
      require:n=>n==='child_process'?{fork:(file,args)=>{seen.push(args);return child;}}:
        n==='os'?{tmpdir:()=>'/fake'}:n==='../lib/storage'?{exportStore:()=>({})}:
        n==='../lib/vlan-wire'?{ParentHub}:require(n)};
    vm.createContext(c);vm.runInContext(text,c);
    assert(c.h.process_spawn(100,200,0x0A000002,0,count,1,showCmd)>0);
    assert.equal(seen.length,1);
    const args=Array.from(seen[0]), getArgText=section(cli,'const getArg = (','\n};');
    const parser={args};vm.createContext(parser);vm.runInContext(getArgText+';globalThis.getArg=getArg',parser);
    let applied;
    // Execute the exact child-side pre-stage statement using the real parser.
    const statement=cli.match(/  applyStartupShow\(instance.exports, getArg\('startup-show', undefined\)\);/)[0];
    vm.runInNewContext(statement,{applyStartupShow:boot.applyStartupShow,instance:{exports:{set_startup_show:n=>applied=n}},getArg:parser.getArg});
    assert.equal(applied,showCmd);
    return args;
  }
  for(const n of [undefined,0,1,2,7])for(const count of [0,1]){
    transport(vfsBody+'\n'+spawnBody,n,count);result.checks.push(`complete CLI ${count?'pipe':'VFS'} callback/argv/child consumer ${n}`);
  }
  reject('lost CLI VFS delegation',()=>transport((vfsBody+'\n'+spawnBody).replace('!!forceSpawn, showCmd','!!forceSpawn'),0,0));
  reject('lost CLI pipe argv',()=>transport((vfsBody+'\n'+spawnBody).replaceAll('...startupShowArgs(showCmd),',''),0,1));
  const prefix=host.slice(host.indexOf('  async loadExe(url, opts = {}) {')+'  async loadExe(url, opts = {}) {'.length,host.indexOf('    this._win16ExtraModules = opts.win16Modules || [];'));
  for(const initialized of [true,false]){
    let applied,init=0;const self={instance:initialized?{exports:{set_startup_show:n=>applied=n}}:null,
      async init(){init++;this.instance={exports:{set_startup_show:n=>applied=n}};}};
    await new Function('ProcessBoot','opts',`return (async()=>{${prefix}})()`).call(self,boot,{showCmd:0});
    assert.equal(applied,0);assert.equal(init,initialized?0:1);result.checks.push('host pre-PE startup publication initialized='+initialized);
  }
  // The unchanged generator and allocator use the sparse overlay plus exact
  // baseline object reads. This compiles region declarations, not a full VM.
  const rendered=load('tools/gen-region-map.js').render();
  if(process.argv.includes('--generate')){gate();fs.writeFileSync('lib/region-map.generated.js',rendered.text);}
  check('generated mapping freshness',()=>assert.equal(source('lib/region-map.generated.js'),rendered.text));
  const old={module:{exports:{}}},now={module:{exports:{}}};
  vm.runInNewContext(cp.execFileSync('git',['show',`${base}:lib/region-map.generated.js`],{encoding:'utf8'}),old);
  vm.runInNewContext(rendered.text,now);
  for(const key of ['REGIONS','BASE','SIZE','END'])
    for(const [name,value]of Object.entries(old.module.exports[key]))
      assert.equal(JSON.stringify(now.module.exports[key][name]),JSON.stringify(value),'existing mapping '+name);
  result.checks.push('all existing exported region mappings unchanged');
  const changed=cp.execFileSync('git',['diff','--name-only',base],{encoding:'utf8'}).trim().split('\n');
  for(const file of changed.filter(p=>p.endsWith('.wat'))){
    check('fragment balance '+file,()=>assert.deepEqual(load('tools/check-wat-fragments.js').checkFragment(file).errors,[]));
  }
  load('tools/check-wat-logical-and.js');
  result.checks.push('production logical AND gate');
  load('tools/check-silent-stubs.js');
  result.checks.push('production silent-stub gate');
  for(const file of [...changed.filter(p=>p.endsWith('.js')),
    'docs/reviews/shell-startup-complete-path-fix-20261020.js','docs/reviews/shell-startup-finish-validation-20261020.js']){
    cp.execFileSync(process.execPath,['--check',file]);result.checks.push('JS syntax '+file);
  }
  cp.execFileSync('git',['diff','--check']);result.checks.push('git diff whitespace');
  result.adapters=['No browser or actual fork. Complete CLI callbacks run with recording child/fs/VFS transport boundaries; child argument parser and startup setter are actual source.',
    'Host loadExe pre-PE prefix executes, not full PE loader/Worker boot. Complete browser PE option expression executes.',
    'Region generation uses actual production tools, a read-only sparse filesystem overlay, and vendored compiler.'];
  gate();fs.writeFileSync('../validation.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({checks:result.checks.length,controls:result.controls.length}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
