'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {installInputHandlers}=require('../lib/renderer-input');
const {createWindowHost}=require('../lib/host-window');
const {releaseFaultInput}=require('../lib/cli-fault-input');
class State{} installInputHandlers(State);
const rows=[];let checks=0;
function eq(actual,expected,label){checks++;assert.deepEqual(actual,expected,label);}
function fixture(){
  const r=new State();r.windows={};r.inputQueue=[];let now=123;r._inputNowMs=()=>now;
  const devices=new Map();const op=(id,code,v=0)=>r.directInputKeyboardBuffer(devices,id,code,v);
  function stage(id,mode,vks,diks,size=32,foreground=0){eq(op(id,mode,size),0,'stage');if(mode!==0){for(const vk of vks)op(id,9,vk);for(const dik of diks)op(id,13,dik);eq(op(id,10,foreground),0,'activate');}}
  const words=id=>Array.from({length:op(id,2)},(_,i)=>op(id,3,i));
  const ctx={renderer:r,processId:71,exports:{},windowLookupLifetime:{exited:false},getMemory:()=>memory};
  const memory=new ArrayBuffer(4096);new Uint8Array(memory).fill(0xa5);
  const host=createWindowHost(ctx,{}).imports;
  return {r,devices,op,stage,words,ctx,host,memory,time:v=>now=v};
}
const word=(vk,dik,down)=>131072+dik*512+(down?256:0)+vk;
const pairs=[[13,'Enter','NumpadEnter',28,156,28,28,0,1],[16,'ShiftLeft','ShiftRight',42,54,42,54,0,0],[17,'ControlLeft','ControlRight',29,157,29,29,0,1],[18,'AltLeft','AltRight',56,184,56,56,0,1]];
function regression(){const {r,host}=fixture();host.queue_keyboard_input(13,28,0,9,111);host.queue_keyboard_input(13,28,1,9,111);host.queue_keyboard_input(13,28,2,9,111);rows.push({name:'Enter overlap original/candidate',actualHigh:r.peekKeyDownState(13),expectedHigh:32768,wm:r.inputQueue});eq(r.peekKeyDownState(13),32768,'main Enter up must leave NumpadEnter held');}

test('independent physical keyboard contract and actual host closure',()=>{
    regression();
    for(const [vk,left,right,ld,rd,ls,rs,lf,rf] of pairs){
      for(const pressReverse of [false,true])for(const releaseReverse of [false,true]){
        const f=fixture(),{r,stage,words,op}=f;stage(1,12,[vk],[ld,rd]);stage(2,8,[vk],[]);stage(3,0,[],[]);
        const press=pressReverse?[[right,rd],[left,ld]]:[[left,ld],[right,rd]],rel=releaseReverse?[...press].reverse():press;
        for(const [code] of press)r.pokeKeyDownState(vk,true,{code});r.pokeKeyDownState(vk,true,{code:press[0][0],repeat:true});
        r.pokeKeyDownState(vk,false,{code:rel[0][0]});eq(r.peekKeyDownState(vk),32768,'overlap high');
        r.pokeKeyDownState(vk,false,{code:rel[1][0]});r.pokeKeyDownState(vk,false,{code:rel[1][0]});
        const expected=[...press.map(([,d])=>word(vk,d,true)),...rel.map(([,d])=>word(vk,d,false))];
        eq(words(1),expected,'exact edges');eq(words(2),[vk+256,vk],'filtered aggregate');eq(words(3),[vk+256,vk],'legacy aggregate');
        eq(words(1),expected,'PEEK');eq(op(1,4,3),123,'timestamp');eq([0,1,2,3].map(i=>op(1,5,i)),[1,2,3,4],'sequence');eq(op(2,5,1),4,'legacy gap');
        op(1,6,2);eq(words(1),expected.slice(2),'partial consume');eq(r.peekKeyDownState(vk),0,'all released');
        rows.push({name:'overlap',vk,pressReverse,releaseReverse,expected});
      }
      // Host scan producer and unchanged WM encoder: press L,R, repeat R, release L,R.
      const f=fixture(),{r,host,words,stage,op}=f;stage(1,12,[vk],[ld,rd]);
      const events=[[ls,lf],[rs,rf],[rs,rf],[ls,lf|2],[rs,rf|2]];
      const wm=[];for(let i=0;i<events.length;i++){
        const [scan,flags]=events[i],up=!!(flags&2),alt=vk===18&&i>0;
        eq(host.queue_keyboard_input(vk,scan,flags,0xdead,0x123),1,'host injection');
        wm.push({msg:up?(vk===18?261:257):(vk===18?260:256),lParam:(1+scan*65536+((flags&1)?16777216:0)+(alt?536870912:0)+(i>0?1073741824:0)+(up?2147483648:0))>>>0});
      }
      eq(words(1),[word(vk,ld,true),word(vk,rd,true),word(vk,ld,false),word(vk,rd,false)],'scan exact');
      eq(r.inputQueue.map(e=>({msg:e.msg,lParam:e.lParam})),wm,'WM scan flags repeat unchanged');
      eq(r.inputQueue.map(e=>[e.hwnd,e.processId,e.extraInfo]),Array(5).fill([291,71,57005]),'WM identity');
      eq(r.inputQueue.map(e=>(e.keyStateSnapshot[vk>>>5]>>>(vk&31))&1),[1,1,1,1,0],'event snapshots');
      eq(host.get_async_key_state(vk),1,'async latch after releases');eq(host.get_async_key_state(vk),0,'low latch consumed');
      eq(new Uint8Array(f.memory),new Uint8Array(4096).fill(0xa5),'memory untouched');
      rows.push({name:'host scan/WM/async',vk,wm});
      // Contradictory metadata and numeric mixing, exact filtering and bounded admission.
      const g=fixture();g.stage(1,12,[vk],[rd],2);
      g.r.pokeKeyDownState(vk,true,{code:left});g.r.pokeKeyDownState(vk,false,{code:left});eq(g.words(1),[],'omitted side');eq(g.op(1,7),0,'filtered no overflow');
      g.r.pokeKeyDownState(vk,true,{code:right});g.r.pokeKeyDownState(vk,false,{code:right});eq(g.words(1),[word(vk,rd,true)],'full drop new');eq(g.op(1,7),1,'sticky overflow');g.op(1,6,0);eq(g.op(1,7),0,'consume0 clears overflow');g.op(1,6,9);
      g.stage(1,12,[vk],[ld,rd]);g.r.pokeKeyDownState(vk,true,{code:'KeyQ',location:2});g.r.pokeKeyDownState(vk,true,{code:right});g.r.pokeKeyDownState(vk,false,{code:right});eq(g.r.peekKeyDownState(vk),32768,'unknown owner retained');
      g.r.pokeKeyDownState(vk,true,{code:left});g.r.pokeKeyDownState(vk,true,{code:right});g.op(1,6,99);g.time(777);g.r.pokeKeyDownState(vk,false);
      eq(g.words(1),[word(vk,ld,false),word(vk,rd,false)],'reset ordered exact only');eq(g.op(1,4,0),777,'reset stamp');eq(g.op(1,4,1),777,'shared reset stamp');eq(g.op(1,5,1),g.op(1,5,0)+1,'reset sequences');
      g.op(1,6,99);g.r.pokeKeyDownState(vk,true,{code:left});g.r._physicalKeys=Object.create(null);g.r._asyncKeys={[vk]:true};g.r.pokeKeyDownState(vk,false,{code:left});eq(g.words(1),[word(vk,ld,true)],'stale known release barred');
      releaseFaultInput({renderer:g.r,inputQueue:[],scheduledInput:[],crossThreadMsgs:[]});eq(g.words(1),[],'fault clears FIFO');g.r.pokeKeyDownState(vk,true,{code:left});eq(g.words(1),[word(vk,ld,true)],'fault forgets owners');
    }
    (({fixture,eq,word,rows,releaseFaultInput,createWindowHost})=>{
  {
    const f=fixture(),{r,op,stage,words}=f;
    eq(op(1,12,4),0,'inactive stage');op(1,9,13);op(1,13,28);r.pokeKeyDownState(13,true,{code:'Enter'});eq(words(1),[],'staged excludes input');eq(op(1,10),0,'activate');
    op(1,13,156);op(1,9,17);r.pokeKeyDownState(13,true,{code:'NumpadEnter'});eq(words(1),[],'active selection immutable');r.pokeKeyDownState(13,false,{code:'Enter'});eq(words(1),[word(13,28,false)],'selected release');
    const client=new Map();const other=(id,c,v=0)=>r.directInputKeyboardBuffer(client,id,c,v);eq(other(1,12,4),0,'same id other client');other(1,9,13);other(1,13,156);other(1,10);
    r.pokeKeyDownState(13,false,{code:'NumpadEnter'});eq(other(1,2),1,'other client exact');eq(words(1),[word(13,28,false)],'first client unaffected');op(1,1);eq(other(1,2),1,'delete isolation');
    const foreign=fixture();foreign.stage(1,12,[13],[28]);r.pokeKeyDownState(13,true,{code:'Enter'});eq(foreign.words(1),[],'renderer isolation');
    rows.push({name:'staging/selection/client/renderer isolation'});
  }
  {
    const f=fixture(),{r,host,ctx}=f,owner=ctx.exports;
    const win={hwnd:321,visible:true,isChild:false,wasm:{exports:owner}};r.windows[321]=win;r._foregroundWindow=win;
    const b=host.di_keyboard_buffer;eq(b(1,12,4),0,'host stage');b(1,9,13);b(1,13,28);eq(b(1,10,321),0,'own foreground');
    host.queue_keyboard_input(13,28,0,0,321);eq(b(1,2),1,'foreground event');r._foregroundWindow=null;r._invalidateDirectInputForeground(null);eq(b(1,2),0,'loss discards');eq(b(1,11),1,'sticky loss');host.queue_keyboard_input(13,28,2,0,321);eq(b(1,2),0,'lost inactive');r._foregroundWindow=win;
    eq(b(2,12,4),0,'second stage');r.windows[321].wasm={exports:{}};eq(b(2,10,321),2,'foreign incarnation refused');
    r.windows[321].wasm={exports:owner};r.windows[321].visible=false;eq(b(2,10,321),2,'invisible refused');r.windows[321].visible=true;
    ctx.windowLookupLifetime.exited=true;eq(b(2,10,321),2,'exited process refused');eq(b(2,11),1,'lifetime loss query');ctx.windowLookupLifetime.exited=false;
    rows.push({name:'foreground/process fences'});
  }
  {
    const f=fixture(),{r,host,stage,words}=f;stage(1,12,[17,18],[29,157,56,184]);
    for(const [vk,scan,flags] of [[17,29,0],[18,56,1],[17,29,2],[18,56,3]])host.queue_keyboard_input(vk,scan,flags,7,500);
    eq(words(1),[word(17,29,true),word(18,184,true),word(17,29,false),word(18,184,false)],'Ctrl Alt independent');
    eq(r.inputQueue.map(e=>e.msg),[256,260,261,261],'Alt context system chord');
    eq(r.inputQueue.map(e=>[(e.keyStateSnapshot[0]>>>17)&1,(e.keyStateSnapshot[0]>>>18)&1]),[[1,0],[1,1],[0,1],[0,0]],'chord snapshots');
    const e=r.takeInput(x=>x.processId===999);eq(e,null,'foreign consume skip');eq(r.inputQueue.length,4,'foreign queue intact');
    eq(r.takeInput(x=>x.processId===71).wParam,17,'owned consume');eq(host.get_key_down_state(17),32768,'message snapshot retained');eq(host.get_async_key_state(17)&32768,0,'physical released');
    rows.push({name:'Ctrl+Alt chord/snapshot/takeInput'});
  }
  {
    const f=fixture(),{r,host,stage,words,op}=f;stage(1,12,[13,16,17,18],[28,156,42,54,29,157,56,184]);
    // Explicit unsupported scans use legacy numeric fallback.
    for(const [vk,scan,flags] of [[13,0,0],[13,0,2],[16,42,1],[16,42,3],[17,56,0],[17,56,2]])host.queue_keyboard_input(vk,scan,flags,0,0);
    eq(words(1),[269,13,272,16,273,17],'unsupported scan untagged');op(1,6,99);
    r.pokeKeyDownState(13,true,{location:0});r.pokeKeyDownState(13,false);r.pokeKeyDownState(13,true,{location:3});r.pokeKeyDownState(13,false,{location:3});
    r.pokeKeyDownState(17,true,{location:2});r.pokeKeyDownState(17,false,{location:2});
    eq(words(1),[269,13,word(13,156,true),word(13,156,false),word(17,157,true),word(17,157,false)],'location fallback');
    rows.push({name:'numeric scan fallback/location'});
  }
  {
    const f=fixture(),{r,op,stage,words}=f;stage(1,12,[13],[28],3);
    r._diKeyboardSequence=0xfffffffe;f.time(0x100000007);r.pokeKeyDownState(13,true,{code:'Enter'});r.pokeKeyDownState(13,false,{code:'Enter'});
    eq([op(1,5,0),op(1,5,1)],[0xffffffff,0],'unsigned sequence wrap');eq(op(1,4,1),7,'timestamp unsigned');op(1,6,1);
    r.pokeKeyDownState(13,true,{code:'Enter'});eq(words(1),[word(13,28,false),word(13,28,true)],'ring wrap FIFO');r.pokeKeyDownState(13,false,{code:'Enter'});eq(op(1,7),1,'overflow sticky');eq(words(1),[word(13,28,false),word(13,28,true)],'drop new');op(1,6,999);eq(words(1),[],'flush prefix');eq(op(1,7),0,'flush overflow');
    stage(1,12,[13],[156],0);r.pokeKeyDownState(13,true,{code:'Enter'});eq(op(1,7),0,'zero filtered no overflow');r.pokeKeyDownState(13,true,{code:'NumpadEnter'});eq(op(1,7),1,'zero admitted overflow');eq(words(1),[],'zero no storage');
    rows.push({name:'PEEK/sequence/timestamp/ring/overflow/zero'});
  }
  {
    const f=fixture(),{r,host,ctx}=f;
    const foreignMemory=new ArrayBuffer(4096);new Uint8Array(foreignMemory).fill(0x5a);
    const secondCtx={renderer:r,processId:72,exports:{},windowLookupLifetime:{exited:false},getMemory:()=>foreignMemory};
    const second=createWindowHost(secondCtx,{}).imports;
    for(const h of [host,second]){eq(h.di_keyboard_buffer(9,12,8),0,'host same device stage');h.di_keyboard_buffer(9,9,13);h.di_keyboard_buffer(9,13,h===host?28:156);eq(h.di_keyboard_buffer(9,10,0),0,'host background activation');}
    host.queue_keyboard_input(13,28,0,4,10);host.queue_keyboard_input(13,28,1,5,11);
    eq(host.di_keyboard_buffer(9,2,0),1,'first host left');eq(second.di_keyboard_buffer(9,2,0),1,'second host right');eq(host.di_keyboard_buffer(9,3,0),word(13,28,true),'host exact left');eq(second.di_keyboard_buffer(9,3,0),word(13,156,true),'host exact right');
    host.di_keyboard_buffer(9,1,0);eq(second.di_keyboard_buffer(9,2,0),1,'host deletion isolated');ctx.windowLookupLifetime.exited=true;eq(host.di_keyboard_buffer(9,11,0),1,'first exited');eq(second.di_keyboard_buffer(9,11,0),0,'other lifetime intact');
    eq(new Uint8Array(f.memory),new Uint8Array(4096).fill(0xa5),'first memory untouched');eq(new Uint8Array(foreignMemory),new Uint8Array(4096).fill(0x5a),'second memory untouched');
    rows.push({name:'actual host client/device/process isolation'});
  }
  {
    const f=fixture(),{r,host,stage,op,words}=f;stage(1,12,[13,17],[28,156,29,157]);
    let signals=0,wakes=0;const published=[];r._directInputEventHandles={1:99};r._directInputSignalEvent=h=>{eq(h,99,'signal handle');signals++;};r._stepWakeHooks=new Set([()=>wakes++]);r._inputPendingPublishers=new Set([(depth,slice)=>published.push([depth,slice])]);
    host.queue_keyboard_input(13,28,0,0,0);host.queue_keyboard_input(13,28,1,0,0);eq(signals,2,'signal every arrival');eq(wakes,2,'wake every arrival');eq(published,[[1,true],[2,true]],'queue publications');
    op(1,6,99);r.pokeKeyDownState(17,true,{code:'ControlLeft',location:2});r.pokeKeyDownState(17,false,{code:'ControlLeft',location:2});eq(words(1),[word(17,29,true),word(17,29,false)],'matching code overrides location');
    rows.push({name:'signal/wake actual hooks/code precedence'});
  }
  {
    const {r,op}=fixture();eq(op(1,12,4097),1,'per device cap');
    for(let i=1;i<=16;i++)eq(op(i,12,4096),0,'total slots allocation');eq(op(17,12,17),0,'total exact65536');eq(op(18,12,2),1,'total exceed');eq(op(1,12,4096),0,'same device replacement excludes own capacity');op(17,1);eq(op(18,12,17),0,'release returns capacity');
    rows.push({name:'capacity bounds 65536'});
  }
})({fixture,eq,word,rows,pairs,releaseFaultInput,createWindowHost});
console.log('independent assertions',checks);
});
