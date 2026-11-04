#!/usr/bin/env node
'use strict';

// Local, bounded public DD7/D3D7 software pixels. No browser or game loop.
// Run under flock /tmp/wine-build.lock after tools/build.sh.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const vm = require('node:vm');
const {browserFixture, plan: originalPlan} = require('./test-legacy-texture-rendered-contract');
const ROOT = path.resolve(__dirname, '..');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');

// Independent continuous-coordinate oracle. Fold tap CENTERS into the unit
// interval, then select a texel. This does not use the renderer's integer
// remainder/reflection algorithm or any production sampling helpers.
function oracle(texture, uv, filter, addresses) {
  const index = (tap, mode) => {
    const center = (tap + .5) / 2;
    let unit;
    if (mode === 1) unit = center - Math.floor(center);
    else if (mode === 2) {
      const phase = center - 2 * Math.floor(center / 2);
      unit = 1 - Math.abs(1 - phase);
    } else if (mode === 3) unit = Math.max(0, Math.min(1, center));
    else throw Error('unsupported oracle address');
    return Math.min(1, Math.floor(unit * 2));
  };
  const texel = (x,y) => texture[2*index(y,addresses[1])+index(x,addresses[0])];
  if (filter === 1) return texel(Math.floor(2*uv[0]),Math.floor(2*uv[1])).slice();
  const position = uv.map(n => 2*n-.5), base = position.map(Math.floor);
  const weight = position.map((n,i) => n-base[i]);
  return [0,1,2].map(c => {
    let sum = 0;
    for(let y=0;y<2;y++) for(let x=0;x<2;x++)
      sum += texel(base[0]+x,base[1]+y)[c]
        * (x?weight[0]:1-weight[0]) * (y?weight[1]:1-weight[1]);
    assertInteger(sum);
    return sum;
  });
  function assertInteger(n) { if(!Number.isInteger(n)) throw Error('ambiguous pixel rounding'); }
}

function plan() {
  const texture = originalPlan().texture;
  const samples = [
    [-17/8,9/8],[-9/8,-1/8],[-1/8,9/8],[1/8,-9/8],
    [7/8,17/8],[9/8,-17/8],[15/8,25/8],[17/8,7/8],[25/8,15/8],
    [0,1],[1,0],[-1,2],[2,-1],[-2,3],[3,-2],[3/8,5/8],
  ].map((uv,i)=>({name:'uv-'+i,uv}));
  // Adjacent rows change one axis only, then restore it; cover every pair
  // under both filters. Every row runs on the same device/texture.
  const pairs = [[1,1],[2,1],[2,2],[1,2],[3,2],[3,1],[3,3],[2,3],[1,3],[1,1]];
  const states = [1,2,1].flatMap((filter,pass)=>pairs.map(([u,v],i)=>
    ({label:`pass-${pass}-${i}-filter${filter}-u${u}-v${v}`,filter,u,v})));
  const expected = states.map(s=>samples.map(t=>oracle(texture,t.uv,s.filter,[s.u,s.v])));
  assert.deepEqual(oracle(texture,[-1/8,9/8],1,[2,2]),[64,192,32]);
  assert.deepEqual(oracle(texture,[-1/8,9/8],1,[1,1]),[160,32,64]);
  assert.deepEqual(oracle(texture,[3/8,5/8],2,[2,2]),[94,146,70]);
  assert.deepEqual(oracle(texture,[9/8,-17/8],1,[2,1]),[224,128,160]);
  assert.deepEqual(expected[0],expected[9],'point state restored');
  assert.deepEqual(expected[10],expected[19],'linear state restored');
  assert.deepEqual(expected.slice(0,10),expected.slice(20),'filter and all addresses restored');
  // The unchanged oracle distinguishes each deliberate broken setter policy.
  for(const policy of ['wrap-for-mirror','stale-u','stale-v','coupled-u','coupled-v']) {
    let last=[1,1], discriminating=0;
    for(const s of states) {
      const actual=mutate(s,last,policy); last=actual;
      for(const t of samples) if(JSON.stringify(oracle(texture,t.uv,s.filter,actual)) !==
        JSON.stringify(oracle(texture,t.uv,s.filter,[s.u,s.v]))) discriminating++;
    }
    assert(discriminating>0,policy+' must have discriminating pixels');
  }
  return {texture,samples,states,expected};
}

function mutate(state, previous, negative) {
  let {u,v}=state;
  if(negative==='wrap-for-mirror') {if(u===2)u=1;if(v===2)v=1;}
  if(negative==='stale-u')u=previous[0];
  if(negative==='stale-v')v=previous[1];
  if(negative==='coupled-u')v=u;
  if(negative==='coupled-v')u=v;
  return [u,v];
}

// Reuse the exported real x86 public-COM fixture without copying its ABI or
// editing its owned source. Fail closed if an upstream seam changes. Only
// sampler policy, its oracle argument, and stronger caps assertions change.
function fixtureSource() {
  let source=browserFixture.toString();
  const replace=(from,to)=>{
    assert.equal(source.split(from).length,2,'unique public fixture adaptation seam');
    source=source.replace(from,to);
  };
  const begin=source.indexOf('    const setState=async state=>{');
  const end=source.indexOf('    const describe=async()=>{',begin);
  assert(begin>0&&end>begin,'public sampler block boundaries');
  replace(source.slice(begin,end),`    await tss(13,1);await tss(14,1);
    let previous=[1,1];
    const setState=async state=>{
      const [u,v]=(${mutate.toString()})(state,previous,negative);
      for(const id of [16,17])await tss(id,state.filter);
      const roundTrip=async(expected)=>{
        for(const [axis,id] of [13,14].entries()){
          const out=await guard(4);
          await ok(com('GetTextureStageState7',device,36,0,id,out.p));
          await out.check();eq(await read(out.p),expected[axis],'independent public address readback');
        }
      };
      await tss(13,u);await roundTrip([u,previous[1]]);
      await tss(14,v);await roundTrip([u,v]);previous=[u,v];
    };
`);
  replace("const expectedAddress=state.address===4?(mode==='software'?1:3):state.address;",
    'const expectedAddress=[state.u,state.v];');
  replace("eq((await read(caps.p+offset))&5,5,'advertised wrap and clamp');",
    "eq(await read(caps.p+offset),0xf7,'exact advertised address mask includes independent UV and MIRROR');");
  replace("eq((await read(caps.p+offset))&0x800,0,'unsupported cube remains unadvertised');",
    "eq(await read(caps.p+offset),0xf7df,'exact texture mask keeps cube unadvertised');");
  return source;
}

async function execute(wasm,config,negative) {
  const routes=new Map([
    ['/legacy-render.wasm',wasm],
    ['/lib/host-import-sigs.generated.json',fs.readFileSync(path.join(ROOT,'lib/host-import-sigs.generated.json'))],
    ['/test/binaries/calc.exe',fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'))],
  ]);
  // Canvas is presentation only: the fixture still obtains every asserted
  // pixel by public Surface7 Lock/Unlock after actual WAT software rasterizing.
  const context=vm.createContext({WebAssembly,performance,setTimeout,
    fetch:async url=>{
      assert(routes.has(url),'only local fixture inputs allowed: '+url);
      const b=routes.get(url);
      return {arrayBuffer:async()=>Uint8Array.from(b).buffer,json:async()=>JSON.parse(b.toString())};
    },
    document:{createElement:()=>({style:{},getContext:()=>({putImageData(){}})}),body:{append(){}}},
    ImageData:class {constructor(data,width,height){this.data=data;this.width=width;this.height=height;}},
  });
  const fixture=vm.runInContext('('+fixtureSource()+')',context);
  let failure, result;
  try {result=await fixture('software',config,oracle.toString(),negative);}
  catch(error) {failure=error.stack||String(error);}
  const partial=JSON.parse(JSON.stringify(context.legacyTextureEvidence));
  if(!negative) {
    if(failure) {const error=new Error(failure);error.partial=partial;throw error;}
    assert.equal(result.status,'PASS');
  }
  else {
    assert(failure?.includes('PIXEL ORACLE'),'negative must reach a pixel failure: '+failure);
    assert(partial.observations.some(o=>JSON.stringify(o.actual)!==JSON.stringify(o.expected)),
      'negative must observe a wrong rendered pixel');
    assert(partial.calls.some(c=>c.label==='DrawPrimitive7'&&c.result===0),'successful public draw');
  }
  return {negative,failure:failure||null,...partial};
}

async function main() {
  const p=plan();
  if(process.argv.includes('--plan')) {console.log(JSON.stringify(p,null,2));return;}
  const dir=process.env.LEGACY_MIRROR_EVIDENCE;
  assert(dir,'set LEGACY_MIRROR_EVIDENCE to an ignored run directory');
  fs.mkdirSync(dir,{recursive:true});
  const name=process.argv.includes('--compat')?'wine-assembly.compat.wasm':'wine-assembly.wasm';
  const modulePath=path.resolve(process.env.LEGACY_MIRROR_MODULE_DIR||path.join(ROOT,'build'),name);
  const wasm=fs.readFileSync(modulePath),pe=fs.readFileSync(path.join(ROOT,'test/binaries/calc.exe'));
  const evidence={status:'RUNNING',source:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),
    node:process.version,module:{path:modulePath,bytes:wasm.length,sha256:sha(wasm)},
    fixtureSha256:sha(fs.readFileSync(__filename)),
    publicFixtureSha256:sha(fs.readFileSync(path.join(ROOT,'test/test-legacy-texture-rendered-contract.js'))),
    adaptedFixtureSha256:sha(fixtureSource()),calc:{path:'test/binaries/calc.exe',sha256:sha(pe)},
    backends:{software:'executing',webgl:'UNKNOWN / unexecuted',queued:'UNKNOWN / unexecuted'},
    plan:p,results:[],negativeControls:[]};
  const config={...p,thunkBase:require('../lib/region-map.generated').BASE.THUNK_BASE,
    factoryId:require('../src/api_table.json').find(x=>x.name==='DirectDrawCreateEx').id,
    imageBase:pe.readUInt32LE(pe.readUInt32LE(0x3c)+52)};
  fs.writeFileSync(path.join(dir,name),wasm); // Preserve actual tested module only.
  try {
    evidence.results.push(await execute(wasm,config,null));
    console.log('PASS '+name+' public software exact pixels: '+p.states.length*p.samples.length);
    for(const filter of [1,2])
      for(const negative of ['wrap-for-mirror','stale-u','stale-v','coupled-u','coupled-v']) {
        const negativeConfig={...config,states:config.states.filter(s=>s.filter===filter)};
        evidence.negativeControls.push({filter,...await execute(wasm,negativeConfig,negative)});
        console.log('PASS rendered negative rejected: '+negative+' filter='+filter);
      }
    evidence.status='PASS';evidence.backends.software='PASS';
  } catch(error) {evidence.status='FAIL';evidence.error=error.stack;evidence.partial=error.partial;throw error;}
  finally {
    fs.writeFileSync(path.join(dir,'result.json.tmp'),JSON.stringify(evidence,null,2)+'\n');
    fs.renameSync(path.join(dir,'result.json.tmp'),path.join(dir,'result.json'));
  }
}

if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={oracle,plan,fixtureSource};
