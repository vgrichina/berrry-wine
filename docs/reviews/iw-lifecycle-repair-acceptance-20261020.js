'use strict';
// Independent assertions over exact submitted actual-source slices. No full VM.
const fs=require('fs'), cp=require('child_process'), path=require('path'), assert=require('assert/strict');
const repo=path.resolve(process.argv[2]||'.');
const candidate='ac72debe7522d4d57034627712b8ec000f8e1d92';
const original=cp.execFileSync('git',['show',candidate+':docs/reviews/iw-lookup-lifecycle-corrections-20261020.js'],{cwd:repo,encoding:'utf8'});
function independent(){
 const replay={checks:results.length,controls:results.filter(x=>x.rejected).length,modules:modules.length};
 assert.equal(replay.checks,89);assert.equal(replay.controls,5);
 const independentStart=results.length, defects=[];
 function defect(label,actual,expected){assert.notEqual(actual,expected,label+' must reproduce');defects.push({label,actual,expected});}
 // Actual allocation/removal, a different HWND in the same slot, and neighbor isolation.
 {
  const f=lifetimeFixture(),e=f.ex;
  e.wnd_table_set(41,1);e.wnd_table_set(42,2);e.wnd_lookup_retire(41);
  eq('independent retirement preserves neighbor',e.wnd_lookup_live(42),1);
  e.wnd_table_remove(41);e.wnd_table_set(43,3);
  eq('independent different HWND slot reuse live',e.wnd_lookup_live(43),1);
  eq('independent old HWND absent after slot reuse',e.wnd_lookup_live(41),0);
  e.wnd_lookup_retire(41);eq('independent stale retirement does not retire new HWND',e.wnd_lookup_live(43),1);
  e.wnd_table_remove(43);e.wnd_table_set(41,4);eq('independent original HWND later reuse live',e.wnd_lookup_live(41),1);
 }
 // Replacements exercise the real W/ExW adapters and table copying, publication and lookup.
 for(const initial of [0,1]){
  const f=fixture(),c=f.add(51,'ReplaceClass',0,true,initial);
  for(const [encoding,extended]of [[1,true],[0,false],[1,false],[0,false]]){
   const r=f.register('ReplaceClass',encoding,extended);
   eq('replacement retains atom '+initial+encoding+extended,r.atom,c.atom);
   eq('replacement encoding byte '+initial+encoding+extended,new Uint8Array(f.ctx.getMemory())[8192+c.slot],encoding);
   eq('replacement owns current original pointer '+initial+encoding+extended,f.dv.getUint32(4096+c.slot*48+44,true),r.p);
   f.ex.publish(51,c.atom);eq('replacement publication '+initial+encoding+extended,f.ctx.renderer.windows[51].className,'ReplaceClass');
   for(const w of [0,1])eq('replacement atom query '+initial+encoding+extended+w,f.ex.find(0,0,c.atom,f.put('Title',!!w),w),51);
  }
 }
 // Separate owner memories, deliberately equal numeric HWNDs: owner-directed retirement.
 {
  const a=fixture(),b=fixture();a.add(61,'Caller');b.add(61,'Owner');
  a.ctx.renderer.windows[61]=b.ctx.renderer.windows[61];
  eq('foreign collision uses owner host string',a.ex.find(0,0,a.put('Owner'),0,0),61);
  eq('foreign collision cannot match caller string',a.ex.find(0,0,a.put('Caller'),0,0),0);
  a.host.destroy_window(61);
  eq('foreign collision retires owner only',b.ex.wnd_lookup_live(61),0);
  eq('foreign collision preserves caller memory',a.ex.wnd_lookup_live(61),1);
 }
 {
  const a=fixture(),b=fixture();a.add(71,'Parent');a.add(72,'CallerChild',71,false);b.add(72,'OwnerChild',71,true);
  a.ctx.renderer.windows[72]=b.ctx.renderer.windows[72];a.host.destroy_window(71);
  eq('direct rendered child retires foreign owner',b.ex.wnd_lookup_live(72),0);
  eq('direct rendered child does not retire colliding caller',a.ex.wnd_lookup_live(72),1);
 }
 // A common renderer is exactly the existing shared desktop boundary.
 {
  const a=fixture(),b=fixture();b.add(81,'ForeignParent');a.ctx.renderer=b.ctx.renderer;
  const h=b.ex.child(81,2,7,0,0,80,20,0,0);
  eq('foreign native child owner can find',b.ex.find(81,0,0x81,0,0),h);
  defect('D1 foreign production-created unpublished child hidden',a.ex.find(81,0,0x81,0,0),h);
  b.add(82,'NextChild',81,true);b.row(h).z=10000;
  eq('foreign unpublished after valid for owner',b.ex.find(81,h,0,0,0),82);
  defect('D1 foreign unpublished after rejected',a.ex.find(81,h,0,0,0),82);
 }
 {
  const a=fixture(),b=fixture();b.add(91,'UnpublishedParent',0,false);b.add(92,'PublishedChild',91,true);a.ctx.renderer=b.ctx.renderer;
  eq('owner unpublished parent valid',b.ex.find(91,0,0,0,0),92);
  defect('D1 foreign unpublished parent hides published child',a.ex.find(91,0,0,0,0),92);
 }
 // Wire real WND lifecycle exports to publication owner; do not model removal.
 {
  const actualLifetime=eval('('+lifetimeFixture.toString().replace("'wnd_lookup_live','wnd_lookup_retire'", "'wnd_lookup_live','wnd_lookup_retire','wnd_lookup_retired'")+')');
  const a=fixture(),life=actualLifetime();a.add(101,'OldPublication');
  life.ex.wnd_table_set(101,1);a.ctx.renderer.windows[101].wasm={exports:life.ex};
  life.ex.wnd_lookup_retire(101);
  eq('actual owner retirement suppresses retained publication',a.ex.find(0,0,a.put('OldPublication'),0,0),0);
  life.ex.wnd_table_remove(101);
  defect('D1 removed owner row stale publication remains searchable',a.ex.find(0,0,a.put('OldPublication'),0,0),0);
  life.ex.wnd_table_set(102,2);
  defect('D1 different HWND slot reuse leaves stale publication searchable',a.ex.find(0,0,a.put('OldPublication'),0,0),0);
  life.ex.wnd_table_set(101,3);
  defect('D1 same HWND new lifetime still matches old publication metadata',a.ex.find(0,0,a.put('OldPublication'),0,0),0);
 }
 // Retired foreign records are correctly suppressed while the row still exists.
 {
  const a=fixture(),b=fixture();b.add(111,'RetiredForeign');a.ctx.renderer=b.ctx.renderer;b.ex.wnd_lookup_retire(111);
  eq('foreign explicitly retired publication excluded',a.ex.find(0,0,a.put('RetiredForeign'),0,0),0);
 }
 const previous=eval('('+cp.execFileSync('git',['show',base+':lib/region-map.generated.js'],{cwd:repo,encoding:'utf8'}).match(/const REGIONS = ([\s\S]*?);/)[1]+')');
 const current=sourceModule('lib/region-map.generated.js');
 assert.deepEqual(Object.keys(current.REGIONS).filter(k=>!previous[k]).sort(),['CLASS_NAME_WIDE','WND_LOOKUP_RETIRED']);
 eq('appended region total bytes',current.REGIONS.CLASS_NAME_WIDE.size+current.REGIONS.WND_LOOKUP_RETIRED.size,320);
 eq('candidate layout hash',current.LAYOUT_HASH,'466744875737f2d2');
 for(const [name,value]of Object.entries(previous))assert.deepEqual(current.REGIONS[name],value,'existing region '+name);
 results.push({label:'all previous region declarations retain generated addresses and sizes',count:Object.keys(previous).length});
 return {candidate:'ac72debe7522d4d57034627712b8ec000f8e1d92',base,replay,independentChecks:results.length-independentStart,defects,results,modules,seals,limits:'Compiled production slices with controlled boundaries; no full VM or runtime qualification.'};
}
const run=new Function('require','process',original+'\nreturn ('+independent.toString()+')();');
const output=run(require,{...process,argv:['node','submitted',repo]});
if(process.argv[3]){const s=fs.statfsSync(repo);assert(s.bavail*s.bsize>=2277507072,'CAPACITY BLOCKER');fs.writeFileSync(process.argv[3],JSON.stringify(output,null,2)+'\n');}
console.log(JSON.stringify({replay:output.replay,independentChecks:output.independentChecks,defects:output.defects}));
