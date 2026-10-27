'use strict';
// Portable differential test of real production CLIs. No scanner/compiler mocks.
const fs=require('fs'), path=require('path'), cp=require('child_process'), assert=require('assert');
const repo=path.resolve(__dirname,'../../..');
const {stage}=require(path.join(repo,'test/helpers/region-census-cli-fixture'));
const out=path.resolve(process.argv[2]); fs.mkdirSync(out,{recursive:true});
const fixture=path.join(repo,'test/fixtures/region-census-build-gates');
const roots=['original','candidate'].map(x=>path.join(out,x));
const gates=['js-copies','embedded-wat','dup-payloads','hand-rolled'];
const resume=process.argv.includes('--resume');
const records=resume?JSON.parse(fs.readFileSync(path.join(out,'invocations.json'))):[];let serial=records.length;
const write=(r,f,s)=>fs.writeFileSync(path.join(r,f),s);
const append=(r,f,s)=>fs.appendFileSync(path.join(r,f),'\n'+s+'\n');
function reset(setup=()=>{}) {
  roots.forEach((r,i)=>{
    fs.rmSync(r,{force:true,recursive:true});
    stage(repo,r,i?undefined:path.join(fixture,'original-region-census.js.txt'));
    if(!i) for(const [a,b] of [['original-region-layout.js.txt','region-layout.js'],['original-check-region-decls.js.txt','check-region-decls.js']])
      fs.copyFileSync(path.join(fixture,a),path.join(r,'tools',b));
    if(i && process.argv.includes('--stale-declarations')) {
      const p=path.join(r,'tools/region-census.js');
      write(r,'tools/region-census.js',fs.readFileSync(p,'utf8').replace('() => collectDeclarations(undefined, undefined, cache)', '() => cache.stale || (cache.stale = collectDeclarations())'));
    }
    if(i && process.argv.includes('--stale-layout')) {
      const p=path.join(r,'tools/region-layout.js');
      write(r,'tools/region-layout.js',fs.readFileSync(p,'utf8').replace('previous.input === input','true'));
    }
    if(i && process.argv.includes('--stale-targets')) {
      const p=path.join(r,'tools/region-census.js');
      write(r,'tools/region-census.js',fs.readFileSync(p,'utf8').replace("if (gate !== 'js-copies') shared[BUILD_SETUP].files = require('../lib/wat-manifest').readManifest();",''));
    }
    setup(r);
  });
}
function run(root,args,preload) {
  const argv=['--max-old-space-size=512',...(preload?['--require',preload]:[]),path.join(root,'tools/region-census.js'),...args];
  const r=cp.spawnSync(process.execPath,argv,{cwd:root,encoding:'utf8',maxBuffer:2*1024**2,timeout:15000});
  const id=String(++serial).padStart(3,'0');
  for(const k of ['stdout','stderr'])fs.writeFileSync(path.join(out,id+'.'+k),r[k]||'');
  assert.ifError(r.error);assert.notStrictEqual(r.status,null);
  records.push({id,root:path.basename(root),argv,status:r.status});
  fs.writeFileSync(path.join(out,'invocations.json'),JSON.stringify(records,null,2)+'\n');
  return {status:r.status,stdout:r.stdout,stderr:r.stderr};
}
function separate(preload) {
  const a={status:0,stdout:'',stderr:''};
  for(const g of gates) {const r=run(roots[0],['--'+g],preload);Object.assign(a,{status:r.status,stdout:a.stdout+r.stdout,stderr:a.stderr+r.stderr});if(r.status)break;}
  return a;
}
function semantic(r) {
  // Preserve compiler diagnostic, exception type/message and output order.
  // Paths, source excerpts and stack line numbers differ between implementations.
  return {status:r.status,stdout:r.stdout,errors:r.stderr.split('\n').filter(l=>/^\[watx\]|^Error:|^TypeError:|^region-census:|^\s+[^ ]+:\d+/.test(l)).map(l=>l.replaceAll(roots[0],'<ROOT>').replaceAll(roots[1],'<ROOT>')
    // Fresh processes wrap manifest parse errors in compile-wat's loader error.
    // The combined path has already loaded it. Compare the same manifest cause.
    .replace(/^Error: compile-wat: no source list\..*?itself\. \((.*)$/,(all,cause)=>'Error: '+(cause.endsWith(')')?cause.slice(0,-1):cause)))};
}
const results=resume?JSON.parse(fs.readFileSync(path.join(out,'results.json'))):[];
function compare(name,setup,mutation,trigger='host',expected) {
  const only=process.argv.find(x=>x.startsWith('--only='));
  if(only && name!==only.slice(7)) return;
  if(results.some(r=>r.name===name&&r.pass)) return;
  reset(setup);
  const preload=path.join(out,name+'-'+(serial+1)+'.cjs');
  fs.writeFileSync(preload,`const fs=require('fs'),path=require('path');const root=process.cwd();let once=fs.existsSync('mutation-fired');
function mutate(){if(once)return;once=true;(${mutation.toString()})(root);fs.writeFileSync('mutation-fired',${JSON.stringify(name)});}
const read=fs.readFileSync;fs.readFileSync=function(f,...args){const text=read.call(this,f,...args);if(${JSON.stringify(trigger)}==='host'&&path.basename(String(f))==='host.js')mutate();return text;};
const log=console.log;console.log=function(...args){log.apply(this,args);if(String(args[0]).includes(${JSON.stringify(trigger)}))mutate();};\n`);
  const a=separate(preload),b=run(roots[1],['--build-gates'],preload);
  assert.deepStrictEqual(semantic(b),semantic(a),name);
  if(expected!==undefined) assert.strictEqual(a.status,expected,name);
  roots.forEach(r=>assert(fs.existsSync(path.join(r,'mutation-fired')),name+' fired'));
  results.push({name,pass:true,original:semantic(a),candidate:semantic(b)});
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2)+'\n');
}
// FIRST repaired behavioral checkpoint: unchanged independent attack and trigger.
compare('unchanged-invalid-align',()=>{},root=>{fs.appendFileSync(path.join(root,'src/00-regions.wat'),'\n(region.declare $INDEPENDENT_INVALID (size 0x1000) (align 3))\n');},'host',1);
compare('added-valid-declaration',()=>{},root=>{fs.appendFileSync(path.join(root,'src/00-regions.wat'),'\n(region.declare $BETWEEN (size 0x1000) (align 16))\n');},'host',0);
const extra=r=>append(r,'src/00-regions.wat','(region.declare $BETWEEN (size 0x1000) (align 16))');
compare('changed-size',extra,root=>{const p=path.join(root,'src/00-regions.wat');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('$BETWEEN (size 0x1000)','$BETWEEN (size 0x2000)'));},'host',0);
compare('removed-declaration',extra,root=>{const p=path.join(root,'src/00-regions.wat');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/\(region.declare \$BETWEEN[^\n]+/g,''));},'host',0);
compare('malformed-declaration',()=>{},root=>{fs.appendFileSync(path.join(root,'src/00-regions.wat'),'\n(region.declare $BROKEN (size no_number) (align 16))\n');},'host',1);
compare('removed-declaration-file',()=>{},root=>{fs.unlinkSync(path.join(root,'src/00-regions.wat'));},'host',1);
compare('law-global-changed',()=>{},root=>{const p=path.join(root,'src/01-header.wat');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/(global \$CLASS_EXTRA_STRIDE i32 \(i32.const )[^)]+/,'$1'+'3'));},'host',1);
compare('law-provider-removed',()=>{},root=>{fs.unlinkSync(path.join(root,'src/01-header.wat'));},'host',1);
const moveLaw=r=>{const p=path.join(r,'src/01-header.wat');const s=fs.readFileSync(p,'utf8');const re=/\(global \$CLASS_EXTRA_STRIDE i32 \(i32.const [^)]+\)\)/;const m=s.match(re);assert(m);write(r,'src/00-law.wat',m[0]);write(r,'src/01-header.wat',s.replace(re,''));};
compare('newly-discovered-law-provider',moveLaw,root=>{fs.writeFileSync(path.join(root,'src/00-a-new-law.wat'),'(global $CLASS_EXTRA_STRIDE i32 (i32.const 3))\n');},'host',1);
compare('new-js-target',r=>{const l=require(path.join(r,'tools/region-layout')).layout({fresh:true});write(r,'.victim',String(l.regions.find(x=>x.kind==='alloc'&&x.base>=0x20000).base+1));},root=>{const v=fs.readFileSync(path.join(root,'.victim'),'utf8');fs.writeFileSync(path.join(root,'test/new-between.js'),'const extraWat = `(func (i32.load (i32.const '+v+')))`;\n');},'host',1);
compare('new-manifest-target',()=>{},root=>{fs.writeFileSync(path.join(root,'src/99-between.wat'),'(data (region.addr $CLASS_EXTRA 0) "between")\n(data (region.addr $CLASS_EXTRA 16) "between")\n');fs.appendFileSync(path.join(root,'src/main.watx'),'\n(include "99-between.wat")\n');},'no embedded WAT fragment',1);
compare('removed-manifest-target',r=>{write(r,'src/99-between.wat',';; present initially\n');append(r,'src/main.watx','(include "99-between.wat")');},root=>{fs.unlinkSync(path.join(root,'src/99-between.wat'));const p=path.join(root,'src/main.watx');fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('(include "99-between.wat")',''));},'no embedded WAT fragment',0);
compare('malformed-manifest',()=>{},root=>{fs.appendFileSync(path.join(root,'src/main.watx'),'\nNOT_AN_INCLUDE\n');},'no embedded WAT fragment',1);
compare('late-invalid-layout',()=>{},root=>{fs.appendFileSync(path.join(root,'src/00-regions.wat'),'\n(region.declare $LATE_BAD (size 0x1000) (align 3))\n');},'within-region duplicate payload(s)',1);
compare('same-stat-alignment',r=>append(r,'src/00-regions.wat','(region.declare $SAMESTAT (size 0x1000) (align 4))'),root=>{const p=path.join(root,'src/00-regions.wat');const s=fs.statSync(p);fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace('$SAMESTAT (size 0x1000) (align 4)','$SAMESTAT (size 0x1000) (align 3)'));fs.utimesSync(p,s.atime,s.mtime);},'host',1);
compare('early-malformed-manifest',()=>{},root=>{fs.appendFileSync(path.join(root,'src/main.watx'),'\nNOT_AN_INCLUDE\n');},'host',1);
compare('removed-manifest',()=>{},root=>{fs.unlinkSync(path.join(root,'src/main.watx'));},'host',1);
// A deliberately restored stale declaration/layout cache must fail this suite.
console.log(JSON.stringify({pass:true,cases:results.length,invocations:serial}));
