'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..');
function fixture({transition=true}={}) {
const b=require(root+'/test/test-cli-native-capture-refusal-details.cjs').largeEditFixture({length:453207});
const owner=require(root+'/test/test-halflife2-multipage-workflow.cjs').fixture();
const raw=r=>r-0x1000+0x200;
// Ordinary main before the modal, as in the retained Wise invocation.
owner.copy(b,raw(0x2000),raw(0x2000),raw(0x2300));
owner.copy(b,raw(0x2780),raw(0x2780),raw(0x27c0));
// Match the late genuine modal's screen dimensions, readonly multiline Edit,
// scrollbar and sibling controls. Text is authored prose, never original media.
let at=raw(0x1500);const start=at;
const w=n=>{b.writeUInt16LE(n,at);at+=2;},d=n=>{b.writeUInt32LE(n>>>0,at);at+=4;},s=t=>{for(const c of t)w(c.charCodeAt(0));w(0);};
const align=()=>at=(at+3)&~3;
d(0x80c80000);d(0);w(5);w(49);w(29);w(316);w(198);w(0);w(0);s('Authored subscriber agreement workload');
for(const [style,x,y,width,height,id,cls,title] of [
 [0x50200804,10,10,254,95,100,0x81,''],
 [0x50010000,116,181,50,14,1,0x80,'Next >'],
 [0x50010000,170,181,42,14,2,0x80,'Cancel'],
 [0x50010000,220,181,42,14,3,0x80,'Back'],
 [0x50000010,10,173,254,1,101,0x82,''],
]) {align();d(style);d(0);w(x);w(y);w(width);w(height);w(id);w(0xffff);w(cls);s(title);w(0);}
assert(at<raw(0x1900));b.writeUInt32LE(at-start,raw(0x12a4));
const paragraph='Authored subscriber terms. This agreement describes registration and activation for this native capture workload. Read each provision before continuing. The software requires ordinary installation and the user reviews the terms on the current page.\r\n\r\n';
const text=('AUTHORED SUBSCRIBER AGREEMENT\r\n\r\n'+paragraph.repeat(3000)).slice(0,453207);assert.equal(text.length,453207);
b.write(text+'\0',raw(0x3000));
if(transition) {
 const secondProc=require(root+'/test/test-vb5-native-dialog-identity.cjs').fixture({simpleButton:true});
 secondProc.copy(b,raw(0x2400),raw(0x2400),raw(0x2480));
 at=raw(0x1700);const initial=at;
 d(0x80c80000);d(0);w(3);w(49);w(29);w(316);w(198);w(0);w(0);s('Authored Internet Required');
 for(const [style,x,y,width,height,id,cls,title] of [
  [0x50000000,10,10,254,95,100,0x82,'Next opens the authored native agreement.'],
  [0x50010000,116,181,50,14,1,0x80,'Next >'],
  [0x50010000,170,181,42,14,2,0x80,'Cancel'],
 ]) {align();d(style);d(0);w(x);w(y);w(width);w(height);w(id);w(0xffff);w(cls);s(title);w(0);}
 assert(at<raw(0x1900));b.writeUInt32LE(at-initial,raw(0x12b4));
 const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
 const entry=[],ep=n=>entry.push(0x68,...u32(n)),ec=slot=>entry.push(0xff,0x15,...u32(0x400000+slot));
 entry.push(0xa1,...u32(0x401944),0xa3,...u32(0x402604));ep(0x402600);ec(0x1940);
 for(const n of [0,0x400000,0,0,360,640,40,40,0x10cf0000,0x402780,0x402500,0])ep(n);
 ec(0x1948);entry.push(0x89,0xc6);
 for(const [resource,proc] of [[2,0x402400],[1,0x402300]]){
  ep(0);ep(proc);entry.push(0x56);ep(resource);ep(0x400000);ec(0x1950);
 }
 ep(0);ec(0x1900);b.fill(0,raw(0x2000),raw(0x2300));Buffer.from(entry).copy(b,raw(0x2000));
}
return b;
}
async function layout(modulePath) {
 const {createHostImports}=require('../lib/host-imports');
 const {mountBundledFonts}=require('./render-helper');
 const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={getMemory:()=>memory.buffer,renderer:null,resourceJson:{menus:{},dialogs:{},strings:{},bitmaps:{}},onExit:()=>{}};
 const imports=createHostImports(ctx);mountBundledFonts(ctx);imports.host.memory=memory;
 for(const name of ['create_thread','exit_thread','terminate_thread','create_event','set_event','reset_event','wait_single','wait_multiple'])imports.host[name]=()=>0;
 imports.host.com_create_instance=()=>0x80004002;
 const bytes=fs.readFileSync(modulePath),{instance}=await WebAssembly.instantiate(bytes,imports);ctx.exports=instance.exports;
 const e=instance.exports,pe=fixture(),raw=r=>r-0x1000+0x200,text=pe.subarray(raw(0x3000),raw(0x3000)+453207);
 const g=e.guest_alloc(text.length+1),wa=require('../lib/region-map.generated').g2w(g,e.get_image_base());
 new Uint8Array(memory.buffer).set(text,wa);new Uint8Array(memory.buffer)[wa+text.length]=0;
 const began=performance.now(),edit=e.test_create_edit(0,0,381,154,0x50200804,g),total=e.test_edit_visual_line_count(edit),elapsedMs=performance.now()-began;
 assert.equal(e.get_edit_text_len(edit),453207);assert.equal(total,10792);
 assert.equal(e.native_edit_viewport(edit,0,0),1);
 // Direct harness uses its default stock font; native dialogs select their resource font.
 const starts=[0,31,33,85,137,190,243,283,285,337],lengths=[29,0,51,51,52,52,38,0,51,51];
 for(let i=0;i<starts.length;i++){assert.equal(e.native_edit_viewport(edit,9,i),starts[i]);assert.equal(e.native_edit_viewport(edit,10,i),lengths[i]);}
 e.send_message(edit,0xb1,text.length,text.length);e.send_message(edit,0xb7,0,0);
 assert(e.send_message(edit,0xce,0,0)>384);assert.equal(e.native_edit_viewport(edit,5,0),total);
 console.log(JSON.stringify({passed:true,moduleSHA256:require('node:crypto').createHash('sha256').update(bytes).digest('hex'),documentBytes:text.length,total,starts,lengths,elapsedMs,tailNavigable:true}));
}
module.exports={fixture,layout};
if(require.main===module){
 if(process.argv[2]==='--layout')layout(process.argv[3]).catch(e=>{console.error(e);process.exitCode=1;});
 else fs.writeFileSync(process.argv[2],fixture({transition:!process.argv.includes('--steady')}),{flag:'wx'});
}
