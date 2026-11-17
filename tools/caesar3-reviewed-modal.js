#!/usr/bin/env node
'use strict';
// Explicit native MessageBox BUTTON route after Caesar's game scene.
//
// Uses the same published reviewed controller and existing permanent input owner.
// No game-state access, modal-as-main substitution, or readiness override.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const git=(...args)=>cp.execFileSync('git',args,{cwd:ROOT,maxBuffer:1<<30});

function preflight(s,target,x,y,label){
  const rows=s.windows;
  function one(hwnd){
    const matches=rows.filter(w=>w.hwnd===hwnd);
    assert(matches.length===1);
    return matches[0];
  }
  const main=one(s.mainHwnd),modal=one(s.modalHwnd),button=one(target);
  const actor=s.focusWindow;
  for(const w of [main,modal,button,actor]){
    assert(w.live&&!['0','',null,undefined].includes(w.generation));
    assert(w.processId===main.processId&&w.threadId===main.threadId);
  }
  assert(main.visible&&!main.isChild&&main.controlClass===0);
  assert(modal.visible&&!modal.isChild&&modal.owner===main.hwnd);
  assert(modal.controlClass===16&&modal.hwnd!==main.hwnd);
  const box=s.nativeMessageBox;
  assert(box&&['hwnd','generation','processId','threadId','controlClass'].every(k=>box[k]===modal[k]));
  assert(s.nativeDialogBox===null&&s.focusTopLevel===modal.hwnd);
  assert(actor.hwnd===s.focus&&one(s.focus).parent===modal.hwnd);
  assert(s.physicalUp&&s.capture==='0x0');
  assert(button.visible&&button.isChild&&button.controlClass===1);
  assert(button.parent===modal.hwnd&&!(button.style&0x08000000));
  assert(button.nativeTextAvailable&&button.title===label);
  assert(Number.isInteger(x)&&Number.isInteger(y));
  const mapping=s.pointerMapping;
  assert.deepStrictEqual(mapping.canvas,s.screen);
  if(mapping.transform!==null)assert(mapping.sourceHwnd===parseInt(main.hwnd,16));
  // Use the public production mapper, including bars, cursor clip and every
  // native ancestor client rectangle. The reviewed point is in whole-image
  // canvas units, never assumed to be a native desktop coordinate. The JSON
  // round trip keeps the original's subprocess boundary: the mapper sees data only.
  const data=JSON.parse(JSON.stringify({s,target,x,y}));
  const w=data.s.windows.find(v=>v.hwnd===data.target);
  // A mapper refusal was a nonzero child exit, i.e. an AssertionError.
  let native;
  try{native=JSON.parse(JSON.stringify(require('../lib/cli-native-pointer-coordinates').containsPointer(data.s,w,{x:data.x,y:data.y})));}
  catch(e){throw new assert.AssertionError({message:String(e&&e.stack||e)});}
  return {target,generation:button.generation,processId:button.processId,
    threadId:button.threadId,main:main.hwnd,modal:modal.hwnd,
    modalGeneration:modal.generation,x,y,label,
    nativeX:native.x,nativeY:native.y};
}

function validate_receipt(receipt,guard,expected){
  assert(receipt.state==='CONSUMED'&&receipt.consumed===true);
  assert(receipt.receiptBoundary==='native-button-dispatch-return');
  assert(['owner','epoch','nonce','deadline'].every(k=>receipt[k]===guard[k]));
  assert(receipt.consumedAt<guard.deadline);
  const p=receipt.nativeMessage;
  assert(p.msg===0x201&&p.hwnd===parseInt(guard.intent.review.targetHwnd,16));
  assert(['processId','threadId','generation'].every(k=>String(p[k])===String(expected[k])));
  assert(p.parent===parseInt(expected.modal,16)&&(p.wParam&1));
  assert(parseInt(p.nativeSequence,10)>0);
  return p;
}

// CONVENTIONS 9: the original exec'd `git show <pinned>:tools/vb5cce-reviewed-control.py`.
// The JS port loads a fresh working-tree instance only when its bytes are that
// pinned, hashed Git object.
function load(run,working=false){
  const pins=JSON.parse(fs.readFileSync(path.join(run,'runtime-inputs.json'),'utf8'));
  const name='tools/vb5cce-reviewed-control.js';
  const body=git('show',pins.gitSHA+':'+name);
  assert.equal(sha(body),pins.sources[name]);
  const file=path.join(ROOT,name);
  assert(fs.readFileSync(file).equals(body),'published controller differs from working tree: '+name);
  delete require.cache[require.resolve(file)];
  const m=require(file);delete require.cache[require.resolve(file)];
  m.R=run;m.PORT=m.read('launch.json').rootPort;
  const own=fs.readFileSync(__filename);
  if(working){
    assert(m.read('launch.json').authoredFixture===true);
  }else{
    const pin=m.read('modal-controller-pin.json');
    assert.equal(pin.sha256,sha(own));
    assert(git('show',pin.gitSHA+':tools/caesar3-reviewed-modal.js').equals(own));
    git('merge-base','--is-ancestor',pin.gitSHA,'origin/main');
  }
  m.sourcecheck=function(){
    assert(fs.readFileSync(__filename).equals(own));
    assert.equal(sha(body),pins.sources[name]);
    assert.equal(sha(fs.readFileSync(path.join(ROOT,'tools/caesar3-current-native.js'))),pins.sources['tools/caesar3-current-native.js']);
    const mapping_name='lib/cli-native-pointer-coordinates.js';
    assert.equal(sha(fs.readFileSync(path.join(ROOT,mapping_name))),pins.sources[mapping_name]);
  };
  const reviewed=m.reviewed;
  function checked(scene){
    const [rr,r]=reviewed(scene),p=m.read(scene+'-button.json');
    assert.deepStrictEqual(preflight(rr.snapshot,r.targetHwnd,p.x,p.y,r.visibleLabel),p);
    return [rr,{...r,buttonPreflight:p}];
  }
  const expected={};
  m.reviewed=function remember(scene){
    const [rr,r]=checked(scene);
    expected[r.targetHwnd]=r.buttonPreflight;
    return [rr,r];
  };
  const call=m.call;
  m.call=async function checked_call(command,...rest){
    let target;
    if(command.action==='guarded-input'){
      target=command.guard.intent.review.targetHwnd;
      assert(target in expected);
    }
    const reply=await call(command,...rest);
    if(command.action==='guarded-input'){
      assert(command.cmd.startsWith('mousedown:'));
      try{validate_receipt(reply,command.guard,expected[target]);}
      catch(e){m.save('rejected-native-button.json',reply);throw e;}
    }
    return reply;
  };
  return m;
}

async function command(m,args){
  const mode=args[0];
  try{
    if(mode==='capture')await m.capture(args[1]);
    else if(mode==='review'){
      const [scene,description,label,kind,target,x,y]=args.slice(1);
      assert(args.length===8&&['install','quit'].includes(kind));
      const rr=m.read(scene+'.json'),p=preflight(rr.snapshot,target,int(x),int(y),label);
      m.review(scene,description,label,kind,target);
      // Review is immutable; preflight is a separate immutable operand.
      // checked() joins it without rewriting the original review.
      m.save(scene+'-button.json',p);
    }else if(mode==='intent'){
      assert(args.length===6);
      const [name,scene,xs,ys,kind]=args.slice(1),x=int(xs),y=int(ys);
      const [,r]=m.reviewed(scene);
      assert(x===r.buttonPreflight.x&&y===r.buttonPreflight.y);
      await m.intent(name,scene,x,y,kind);
    }else throw new assert.AssertionError({message:'unsupported native modal operation'});
  }catch(e){m.fail('native-modal-'+mode,e);throw e;}
}
// Python int(): a decimal integer string or a ValueError.
function int(v){const s=String(v).trim();if(!/^[+-]?\d+$/.test(s))throw new Error('invalid literal for int(): '+v);return Number(s);}

module.exports={ROOT,preflight,validate_receipt,load,command};
if(require.main===module){
  let args=process.argv.slice(2);const working=args.includes('--working-fixture');
  if(working)args=args.filter((a,i)=>i!==args.indexOf('--working-fixture'));
  (async()=>{const m=load(process.env.CAESAR3_RUN,working);await command(m,args);})()
    .catch(e=>{console.error(e&&e.stack||e);process.exitCode=1;});
}
