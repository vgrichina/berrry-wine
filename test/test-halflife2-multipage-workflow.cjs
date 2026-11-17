'use strict';
// Real authored DLGPROC replaces its Next BUTTON on every ordinary WM_COMMAND.
// The full released CLI controller must inspect each new captured HWND.
const fs=require('node:fs'),assert=require('node:assert/strict');
function fixture(){
 const b=require('./test-halflife2-native-wizard.cjs').dialogFixture(),raw=r=>r-0x1000+0x200;
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 for(const [slot,r,name]of [[0x1964,0x1e00,'DestroyWindow'],[0x1968,0x1e30,'CreateWindowExA'],[0x196c,0x1e60,'SetFocus'],
  [0x1970,0x1e90,'GetAsyncKeyState'],[0x1974,0x1ec0,'SetTimer'],[0x1978,0x1ee0,'KillTimer']]){
  b.writeUInt32LE(r,raw(slot));b.write(name+'\0',raw(r+2));
 }
 b.writeUInt32LE(0,raw(0x197c));
 b.write('Wizard: Internet Required\0',raw(0x2580));
 b.write('Authored page two: current Next has a new HWND.\0',raw(0x25c0));
 b.write('Wizard: SubscriberAgreement\0',raw(0x2700));
 b.write('BUTTON\0',raw(0x2740));b.write('Next >\0',raw(0x2760));
 b.write('Authored wizard owner\0',raw(0x2780));
 // Wise has a normal top-level main before opening its native modal pages.
 // Match that topology rather than the borrowed pre-main dialog fixture.
 const entry=[],ep=n=>entry.push(0x68,...u32(n)),ec=slot=>entry.push(0xff,0x15,...u32(0x400000+slot));
 entry.push(0xa1,...u32(0x401944),0xa3,...u32(0x402604));ep(0x402600);ec(0x1940);
 for(const n of [0,0x400000,0,0,360,640,40,40,0x10cf0000,0x402780,0x402500,0])ep(n);
 ec(0x1948);entry.push(0x89,0xc6);
 ep(0);ep(0x402300);entry.push(0x56);ep(1);ep(0x400000);ec(0x1950);
 ep(0);ec(0x1900);
 b.fill(0,raw(0x2000),raw(0x2300));Buffer.from(entry).copy(b,raw(0x2000));
 const a=[],labels={},fix=[],e=(...v)=>a.push(...v),push=n=>e(0x68,...u32(n));
 const call=slot=>e(0xff,0x15,...u32(0x400000+slot));
 const label=n=>labels[n]=a.length,j=(n,op)=>{e(...op);fix.push([a.length,n]);e(0,0,0,0);};
 e(0x55,0x89,0xe5);
 e(0x81,0x7d,12,...u32(0x10));j('cancel',[0x0f,0x84]); // WM_CLOSE
 e(0x81,0x7d,12,...u32(0x113));j('timer',[0x0f,0x84]);
 e(0x81,0x7d,12,...u32(0x111));j('done',[0x0f,0x85]);
 e(0x83,0x7d,16,2);j('cancel',[0x0f,0x84]);
 e(0x83,0x7d,16,1);j('done',[0x0f,0x85]);
 e(0xff,0x05,...u32(0x4026a0));
 e(0x83,0x3d,...u32(0x4026a0),1);j('third',[0x0f,0x85]);
 push(0x402580);j('title',[0xe9]);label('third');push(0x402700);
 label('title');e(0xff,0x75,8);call(0x195c);
 push(1);e(0xff,0x75,8);call(0x1960);e(0x50);call(0x1964);
 // A fresh native BUTTON with the same ordinary dialog id, caption and rect.
 for(const n of [0,0x400000,1])push(n);e(0xff,0x75,8);
 for(const n of [30,120,130,140,0x50010000,0x402760,0x402740,0])push(n);
 call(0x1968);e(0x50);call(0x196c);
 j('done',[0xe9]);
 // Return from the real Cancel BUTTON callback before waiting for UP, so
 // its native dispatch fence can acknowledge DOWN. A real guest timer then
 // observes physical release through USER32, as in the proven 9acca gate.
 label('cancel');e(0xc7,0x05,...u32(0x4026a4),...u32(1));
 push(0);push(10);push(1);e(0xff,0x75,8);call(0x1974);j('done',[0xe9]);
 label('timer');e(0x83,0x3d,...u32(0x4026a4),0);j('done',[0x0f,0x84]);
 for(const key of [1,13]){push(key);call(0x1970);e(0xa9,...u32(0x8000));j('done',[0x0f,0x85]);}
 push(1);e(0xff,0x75,8);call(0x1978);
 push(0);e(0xff,0x75,8);call(0x1954); // EndDialog -> ordinary entry ExitProcess
 label('done');e(0xb8,1,0,0,0,0xc9,0xc2,16,0);
 assert(a.length<0x200);const out=Buffer.from(a);
 for(const [o,n]of fix)out.writeInt32LE(labels[n]-o-4,o);
 b.fill(0,raw(0x2300),raw(0x2500));out.copy(b,raw(0x2300));return b;
}
function verify(dir){
 const path=require('node:path'),read=n=>JSON.parse(fs.readFileSync(path.join(dir,n+'.json')));
 const targets=[];
 assert(read('startup-ready').ready&&read('startup-ready').passive);
 for(const [scene,intent,title]of [['welcome','welcome-next','Wizard: Welcome'],['internet-required','internet-next','Wizard: Internet Required']]){
  const capture=read(scene),review=read(scene+'-review'),down=read(intent+'-down'),up=read(intent+'-up'),start=read(intent+'-intent');
  assert(capture.snapshot.windows.some(w=>w.title===title));
  const button=capture.snapshot.windows.find(w=>w.hwnd===review.targetHwnd);
  assert(button&&button.title==='Next >'&&button.controlClass===1);
  assert(capture.at<=review.at&&review.at<=start.at&&start.at-capture.at<30);
  assert.equal(down.receipt.receiptBoundary,'native-button-dispatch-return');
  assert(down.receipt.consumed&&down.at<start.confirmationDeadline);
  assert(up.physicalUpACK&&up.at<start.physicalUpDeadline);
  assert(read(intent+'-release-wait').actualWait&&read(intent+'-release-wait').stdoutEOF&&read(intent+'-release-wait').stderrEOF);
  assert(read(intent+'-completion').elapsedMs<3000);targets.push(button.hwnd);
 }
 const last=read('subscriber-agreement');assert(last.snapshot.windows.some(w=>w.title==='Wizard: SubscriberAgreement'));
 targets.push(last.snapshot.windows.find(w=>w.title==='Next >').hwnd);
 assert.equal(new Set(targets).size,3,'every page must create a different Next HWND');
 assert(!fs.existsSync(path.join(dir,'PERMANENT-UNKNOWN.json')));
 const requests=fs.readFileSync(path.join(dir,'requests.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
 assert.equal(requests.filter(r=>r.action==='guarded-bind').length,1,'one permanent binding across pages');
 assert.equal(requests.filter(r=>r.action==='guarded-input').length,3);
 const cancel=read('cancel-down'),up=read('cancel-up'),intent=read('cancel-intent');
 assert(cancel.receipt.consumed&&cancel.receipt.receiptBoundary==='native-button-dispatch-return');
 assert(cancel.at<intent.confirmationDeadline&&up.physicalUpACK&&up.at<intent.physicalUpDeadline);
 const release=read('cancel-release-wait');assert(release.actualWait&&release.stdoutEOF&&release.stderrEOF);
 assert(read('cancel-completion').elapsedMs<3000);
 const observation=read('cancel-observation');assert(observation.outcome==='process-exited'&&observation.noPostExitRequest);
 const wait=read('native-wait');assert(wait.actualWait&&wait.stdoutEOF&&wait.stderrEOF&&!wait.hostCleanup&&wait.exit===0&&wait.disposition==='normal');
 assert(read('native-exit').exitCode===0);
 console.log(JSON.stringify({passed:true,actualCompleteCLIWorkflow:true,changingNextHWNDs:targets,oneBinding:true,nativeACK500:true,independentUP1750:true,capture3000:true,reviewAge30:true,nativeQuit:true,hostCleanup:false,noOriginal:true}));
}
module.exports={fixture,verify};
if(require.main===module){if(process.argv[2]==='--verify')verify(process.argv[3]);else fs.writeFileSync(process.argv[2],fixture(),{flag:'wx'});}
