'use strict';
// Independent semantic oracle: real pinned CLI processes, portable fixture.
// Success means either clean equivalence or a preserved causal rejection.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const assert = require('assert'), crypto = require('crypto');
const repo = path.resolve(__dirname, '../../..');
const { stage } = require(path.join(repo, 'test/helpers/region-census-cli-fixture'));
const gates = ['js-copies', 'embedded-wat', 'dup-payloads', 'hand-rolled'];
const out = path.resolve(process.argv[2]); fs.mkdirSync(out, {recursive:true});
const roots = ['original', 'candidate'].map(n => path.join(out, n));
const original = path.join(repo,'test/fixtures/region-census-build-gates/original-region-census.js.txt');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.strictEqual(sha(original), '58bf809d531f908341874bb72b2a6faed37903dc2f34e98bb288bb1e5fa781a2');
assert.strictEqual(sha(path.join(repo, 'tools/region-census.js')), '7fc8f6fa42485b1d0973708ff9ebe61c0bcaf074b47e97f6847fdb9e940acc8b');
const build = fs.readFileSync(path.join(repo, 'tools/build.sh'), 'utf8');
const commands = build.split('\n').filter(l => /^node tools\/(region-census|gen-region-map)\.js/.test(l));
assert.deepStrictEqual(commands, ['node tools/region-census.js --gate', 'node tools/gen-region-map.js --check', 'node tools/region-census.js --build-gates']);
function reset() { roots.forEach((r,i) => {fs.rmSync(r,{recursive:true,force:true}); stage(repo,r,i ? undefined : original); if(!i) for(const [a,b] of [['original-region-layout.js.txt','region-layout.js'],['original-check-region-decls.js.txt','check-region-decls.js']]) fs.copyFileSync(path.join(repo,'test/fixtures/region-census-build-gates',a),path.join(r,'tools',b));}); }
const results = []; let serial=0;
function run(root,args,preload) {
  const label=String(++serial).padStart(3,'0');
  const argv=['--max-old-space-size=512', ...(preload ? ['--require',preload]:[]),path.join(root,'tools/region-census.js'),...args];
  const r=cp.spawnSync(process.execPath,argv,{cwd:out,encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024});
  fs.writeFileSync(path.join(out,label+'.stdout'),r.stdout||'');fs.writeFileSync(path.join(out,label+'.stderr'),r.stderr||'');
  assert.ifError(r.error); assert.notStrictEqual(r.status,null);
  const v={status:r.status,stdout:r.stdout,stderr:r.stderr};
  results.push({label,root:path.basename(root),command:[process.execPath,...argv],...v});
  fs.writeFileSync(path.join(out,'invocations.json'),JSON.stringify(results,null,2)+'\n');
  return v;
}
function separate(root,preload){let a={status:0,stdout:'',stderr:''};for(const g of gates){let r=run(root,['--'+g],preload);a.status=r.status;a.stdout+=r.stdout;a.stderr+=r.stderr;if(r.status)break;}return a;}
// FIRST behavioral checkpoint: exact production entrypoint and unchanged fixture.
reset();
const cleanOriginal=separate(roots[0]);
const cleanCandidate=run(roots[1],['--build-gates']);
assert.strictEqual(cleanOriginal.status,0);assert.deepStrictEqual(cleanCandidate,cleanOriginal);
fs.writeFileSync(path.join(out,'production-first.json'),JSON.stringify({pass:true,commands,original:cleanOriginal,candidate:cleanCandidate,sourceSHA256:sha(path.join(repo,'tools/region-census.js'))},null,2)+'\n');
// The first adversarial checkpoint changes declarations after JS scanning.
// No scanner, compiler, layout, result, baseline or candidate code is modified.
const preload=path.join(out,'change-declarations.cjs');
const mutation='\n(region.declare $INDEPENDENT_INVALID (size 0x1000) (align 3))\n';
fs.writeFileSync(preload,`'use strict';
const fs=require('fs'),path=require('path'),read=fs.readFileSync;
let once=false;
fs.readFileSync=function(file,...args){
 const text=read.call(this,file,...args);
 if(!once && path.basename(String(file))==='host.js'){
  once=true;const target=path.join(path.dirname(String(file)),'src/00-regions.wat');
  fs.appendFileSync(target,${JSON.stringify(mutation)});
  fs.writeFileSync(path.join(path.dirname(String(file)),'mutation-fired.json'),JSON.stringify({trigger:'host.js read after declarations/layout',target,mutation:${JSON.stringify(mutation)}}));
 }
 return text;
};\n`);
reset();
const before=roots.map(r=>sha(path.join(r,'src/00-regions.wat')));
const changedOriginal=separate(roots[0],preload);
const changedCandidate=run(roots[1],['--build-gates'],preload);
const after=roots.map(r=>sha(path.join(r,'src/00-regions.wat')));
assert.strictEqual(before[0],before[1]);assert.strictEqual(after[0],after[1]);assert.notStrictEqual(before[0],after[0]);
roots.forEach(r=>assert(fs.existsSync(path.join(r,'mutation-fired.json'))));
assert.strictEqual(changedOriginal.status,1,'original must reject invalid declaration');
assert.match(changedOriginal.stderr,/align|power|compile/i);
const rejected=changedCandidate.status!==changedOriginal.status;
const receipt={verdict:rejected?'REJECT':'PASS',sourceSHA256:sha(path.join(repo,'tools/region-census.js')),before,after,mutation,original:changedOriginal,candidate:changedCandidate,firstFailureOriginal:'embedded-wat',productionFirstPassed:true,invocations:results.length,scope:'Production boundary only; follow freshness tests separately.'};
fs.writeFileSync(path.join(out,'verdict.json'),JSON.stringify(receipt,null,2)+'\n');
assert.strictEqual(changedCandidate.status,changedOriginal.status,'production boundary regression');
assert.strictEqual(changedCandidate.stdout,changedOriginal.stdout); assert.strictEqual(changedCandidate.stderr.split('\n')[0],changedOriginal.stderr.split('\n')[0]);
console.log(JSON.stringify({pass:true,invocations:results.length}));
