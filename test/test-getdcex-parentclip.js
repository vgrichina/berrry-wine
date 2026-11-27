#!/usr/bin/env node
'use strict';
// Actual USER/GDI thunks. Expected masks are independent literal pixels.
// Ownership: https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getdcex
// Screen-space system regions: https://learn.microsoft.com/en-us/windows/win32/api/wingdi/nf-wingdi-getrandomrgn
const assert = require('assert'), fs = require('fs'), crypto = require('crypto');
const {bootRenderHarness} = require('./render-helper');
const {compileSrcWasm} = require('./compile-src');
const {makeFixture, iat} = require('../tools/kernel32-native-fixture');
const u32 = v => [v,v>>>8,v>>>16,v>>>24].map(b=>b&255);
async function main() {
  const bytes = process.env.GETDCEX_PARENTCLIP_MODULE ? fs.readFileSync(process.env.GETDCEX_PARENTCLIP_MODULE) : compileSrcWasm();
  console.log(JSON.stringify({moduleSha256:crypto.createHash('sha256').update(bytes).digest('hex')}));
  const {exports:e,memory} = await bootRenderHarness({fonts:'none',prebuiltModule:new WebAssembly.Module(bytes)});
  const pe=makeFixture();new Uint8Array(memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));e.set_api_log(0);
  const alloc=n=>e.guest_alloc(n)>>>0,w=(p,v)=>e.guest_write32(p,v),r=p=>e.guest_read32(p)>>>0;
  const code=b=>{const p=alloc(b.length);b.forEach((v,i)=>e.guest_write8(p+i,v));return p;};
  const str=s=>code([...Buffer.from(s),0]),put=(p,a)=>a.forEach((v,i)=>w(p+4*i,v));
  const stack=alloc(32768)+16384;let calls=0,checks=0;
  function call(entry,args) {
    w(stack,0);args.forEach((v,i)=>w(stack+4+i*4,v));e.set_esp(stack);e.clear_yield();e.set_eip(entry);
    for(let i=0;i<256&&e.get_eip();i++)e.run(2048);
    assert.strictEqual(e.get_eip(),0,'public call returned');
    assert.strictEqual(e.get_esp()>>>0,stack+4+args.length*4,'stdcall ESP');
    assert.strictEqual(e.get_sync_msg_depth(),0,'callback context unwound');calls++;return e.get_eax()>>>0;
  }
  const libs={},entries={};
  for(const dll of ['user32.dll','gdi32.dll']){libs[dll]=call(r(iat('LoadLibraryA')),[str(dll)]);assert(libs[dll]);}
  function entry(dll,name){const k=dll+':'+name;entries[k]||=call(r(iat('GetProcAddress')),[libs[dll],str(name)]);assert(entries[k],k);return entries[k];}
  const user=(n,...a)=>call(entry('user32.dll',n),a),gdi=(n,...a)=>call(entry('gdi32.dll',n),a);
  const failures=[],counts={};
  function check(a,b,label){checks++;try{assert.deepStrictEqual(a,b,label);}catch(err){counts[label]=(counts[label]||0)+1;if(failures.length<20)failures.push(err.message);}}
  const eq=(a,b,label)=>{checks++;assert.deepStrictEqual(a,b,label);};
  const rect=alloc(16),point=alloc(8),box=alloc(16),ps=alloc(64),all=alloc(16);put(all,[0,0,12,10]);
  const red=gdi('CreateSolidBrush',0xff),black=gdi('CreateSolidBrush',0);
  const quiet=code([0xb8,...u32(1),0xc2,16,0]);
  function window(parent,x,y,width=72,height=64,style=0) {
    const h=user('CreateWindowExA',0,str('STATIC'),str('GetDCEx clip'),(parent?0x50000000:0x10000000)|style,
      x,y,width,height,parent,0,0x400000,0);assert(h);
    assert(user('SetWindowLongA',h,-4,quiet));assert(user('BeginPaint',h,ps));assert(user('EndPaint',h,ps));
    user('ValidateRect',h,0);return h;
  }


  const root=window(0,23,31,160,140);
  const above=window(root,53,24,3,4),parent=window(root,19,17,40,30,0x00800000|0x02000000);
  const sibling=window(parent,33,6,3,4),target=window(parent,31,6,20,18,0x00800000|0x06000000);
  const kid=window(target,2,2,3,3),hidden=window(parent,0,0,3,3),away=window(parent,70,70,3,3);
  user('ShowWindow',hidden,0);
  function origin(h,whole){if(!h)return[0,0];if(whole){assert(user('GetWindowRect',h,rect));return[r(rect)|0,r(rect+4)|0];}put(point,[0,0]);assert(user('ClientToScreen',h,point));return[r(point)|0,r(point+4)|0];}
  const po=origin(parent,false),pw=origin(parent,true),tw=origin(target,true),tc=origin(target,false);
  eq(po,[pw[0]+1,pw[1]+1],'parent border origin');eq(tc,[tw[0]+1,tw[1]+1],'target border origin');
  const full=Array(10).fill('############'),empty=Array(10).fill('............');
  const edge=Array(10).fill('#######.....'),occluded=[...Array(4).fill('##...##.....'),...Array(6).fill('#######.....')];
  const children=['#######.....','#######.....','#######.....','###...#.....','###...#.....','###...#.....',...Array(4).fill('#######.....')];
  const siblings=[...Array(4).fill('##...##.....'),...Array(6).fill('#######.....')];
  const band=Array(10).fill('####........'),frame=['#######.....','#.....#.....','#.....#.....','#.....#.....','#.....#.....','#.....#.....','#.....#.....','#.....#.....','#.....#.....','#######.....'];
  const and=(a,b)=>a.map((s,y)=>[...s].map((c,x)=>c==='#'&&b[y][x]==='#'?'#':'.').join(''));
  const output=gdi('CreateRectRgn',0,0,0,0),app=gdi('CreateRectRgn',0,0,3,10);
  function mask(label,dc,rows,draw=false){for(let y=0;y<10;y++)for(let x=0;x<12;x++)check(draw?gdi('GetPixel',dc,x,y)===0xff:!!gdi('PtVisible',dc,x,y),rows[y][x]==='#',label);}
  // Read/clear through the root's ordinary client DC so target styles do not
  // contaminate independent pixel observations of the target window origin.
  const rootOrigin=origin(root,false),readRect=alloc(16);
  function background(h){const [x,y]=origin(h,true),dx=x-rootOrigin[0],dy=y-rootOrigin[1];put(readRect,[dx,dy,dx+12,dy+10]);const dc=user('GetDC',root);assert(dc);assert(user('FillRect',dc,readRect,black));assert(user('ReleaseDC',root,dc));return[dx,dy];}
  let cases=0;
  function run(h,flags,rows,label,mode=0,hole=false){cases++;const [dx,dy]=background(h),[x,y]=origin(h,true);
    let source=0;if(mode){source=gdi('CreateRectRgn',x,y,x+(hole?7:4),y+10);assert(source);if(hole){const inner=gdi('CreateRectRgn',x+1,y+1,x+6,y+9);assert(gdi('CombineRgn',source,source,inner,4));assert(gdi('DeleteObject',inner));}}
    const dc=user('GetDCEx',h,source,flags|mode);assert(dc,label);
    const operand=hole?frame:band,expected=mode===0x80?and(rows,operand):mode===0x40?and(rows,operand.map(s=>[...s].map(c=>c==='#'?'.':'#').join(''))):rows;
    mask(label,dc,expected);check(gdi('GetClipRgn',dc,output),0,label+' no app');assert(gdi('SaveDC',dc));assert(gdi('SelectClipRgn',dc,app));check(gdi('GetClipRgn',dc,output),1,label+' app present');check(gdi('EqualRgn',output,app),1,label+' app is independent');mask(label+' app',dc,and(expected,Array(10).fill('###.........')));assert(gdi('RestoreDC',dc,-1));mask(label+' restore',dc,expected);
    assert(user('FillRect',dc,all,red));assert(user('ReleaseDC',h,dc));const read=user('GetDC',root);for(let yy=0;yy<10;yy++)for(let xx=0;xx<12;xx++)check(gdi('GetPixel',read,dx+xx,dy+yy)===0xff,expected[yy][xx]==='#',label+' pixels');assert(user('ReleaseDC',root,read));
  }
  for(const whole of [0,1])for(const mode of [0,0x40,0x80]){
    run(target,4|whole,edge,'parent clip ignores parent children and target styles',mode);
    run(target,12|whole,children,'explicit children still apply',mode);
    run(target,20|whole,siblings,'explicit siblings still apply',mode);
    run(target,28|whole,and(children,siblings),'explicit both still apply',mode);
    run(target,4|whole,edge,'supplied hole',mode,true);
  }
  // Parent style clipping (above its own sibling), ancestry and hidden state.
  user('SetWindowLongA',parent,-16,0x56800000);run(target,4,occluded,'parent sibling clipping');
  user('ShowWindow',above,0);run(target,4,edge,'hidden parent sibling ignored');user('ShowWindow',above,5);
  const dc=user('GetDCEx',target,0,4);assert(dc);mask('held initial',dc,occluded);user('ShowWindow',parent,0);mask('hidden parent refresh',dc,empty);user('ShowWindow',parent,5);mask('shown parent refresh',dc,occluded);
  user('ShowWindow',above,0);mask('parent sibling refresh',dc,edge);assert(user('ReleaseDC',target,dc));
  user('SetWindowLongA',parent,-16,0x52800000);
  run(parent,4,full,'child uses top-level parent visibility');
  assert(user('GetClientRect',root,rect));const rootWidth=r(rect+8);
  assert(user('SetWindowPos',parent,0,rootWidth-35,17,0,0,0x1d));
  run(target,4,Array(10).fill('###.........'),'parent clipped by ancestor client');
  assert(user('SetWindowPos',parent,0,19,17,0,0,0x1d));
  // CS_PARENTDC is ignored along with WS_CLIPCHILDREN.
  const cls=user('GetClassLongA',parent,-26);user('SetClassLongA',parent,-26,cls|0x80);run(target,4,edge,'parent CS_PARENTDC ignored');user('SetClassLongA',parent,-26,cls);
  // Ordinary acquisition remains tied to the target client and styles.
  const ordinary=user('GetDC',target);check(!!gdi('PtVisible',ordinary,2,2),false,'ordinary target child style remains');assert(user('ReleaseDC',target,ordinary));
  // No-parent and NULL controls compare all points against ordinary DCs.
  for(const h of [root,0])for(const whole of [0,1]){const a=user('GetDCEx',h,0,whole),b=user('GetDCEx',h,0,whole|4);assert(a&&b);for(let yy=0;yy<10;yy++)for(let xx=0;xx<12;xx++)check(gdi('PtVisible',a,xx,yy),gdi('PtVisible',b,xx,yy),'no-parent control');assert(user('ReleaseDC',h,a));assert(user('ReleaseDC',h,b));}
  const [tx,ty]=origin(target,true),request=gdi('CreateRectRgn',tx,ty,tx+4,ty+10),held=user('GetDCEx',target,request,0x84);assert(held);mask('held supplied',held,and(edge,band));assert(gdi('SaveDC',held));assert(gdi('SelectClipRgn',held,app));user('ShowWindow',parent,0);mask('hidden supplied',held,empty);user('ShowWindow',parent,5);mask('supplied refresh app separate',held,and(edge,Array(10).fill('###.........')));assert(gdi('RestoreDC',held,-1));mask('supplied refresh restore',held,and(edge,band));assert(user('ReleaseDC',target,held));
  const ignored=gdi('CreateRectRgn',0,0,0,0),ignoredDc=user('GetDCEx',target,ignored,4);assert(ignoredDc);mask('unflagged HRGN ignored',ignoredDc,edge);check(gdi('GetRgnBox',ignored,box),1,'unflagged HRGN caller owned');assert(user('ReleaseDC',target,ignoredDc));assert(gdi('DeleteObject',ignored));
  for(const mode of [0x40,0x80]){const q=user('GetDCEx',target,0,4|mode);assert(q);mask('NULL supplied operand '+mode,q,mode===0x40?edge:empty);assert(user('ReleaseDC',target,q));}
  const refreshSource=gdi('CreateRectRgn',tx,ty,tx+4,ty+10),refresh=user('GetDCEx',target,refreshSource,0x9c);assert(refresh);
  mask('held all flags',refresh,and(and(children,siblings),band));
  // Reuse and mutate newly allocated HRGNs after transfer: the DC retains
  // an immutable private operand, independently of allocator handle reuse.
  const reuse=gdi('CreateRectRgn',-100,-100,100,100);assert(reuse);assert(gdi('OffsetRgn',reuse,17,19));assert(gdi('DeleteObject',reuse));
  user('ShowWindow',kid,0);mask('held all flags child refresh',refresh,and(siblings,band));user('ShowWindow',sibling,0);mask('held all flags sibling refresh',refresh,and(edge,band));user('ShowWindow',kid,5);user('ShowWindow',sibling,5);mask('held all flags restored',refresh,and(and(children,siblings),band));assert(user('ReleaseDC',target,refresh));
  const released=user('GetDCEx',target,0,4);assert(released);mask('release clears previous flags and operand',released,edge);assert(user('ReleaseDC',target,released));
  assert(user('LockWindowUpdate',parent));const locked=user('GetDCEx',target,0,4),bypass=user('GetDCEx',target,0,0x404);assert(locked&&bypass);mask('parent lock',locked,empty);mask('parent bypass',bypass,edge);assert(user('LockWindowUpdate',0));mask('unlock retains parent clip',locked,edge);assert(user('ReleaseDC',target,locked));assert(user('ReleaseDC',target,bypass));
  // Failure must retain caller HRGN ownership and release the failed DC.
  const source=gdi('CreateRectRgn',tx,ty,tx+4,ty+10),regions=[];for(let i=0;i<256;i++){const q=gdi('CreateRectRgn',0,0,1,1);if(!q)break;regions.push(q);}assert(regions.length>200);
  for(let slots=0;slots<3;slots++){for(const supplied of [false,true]){const used=e.gdi_dc_state_used(),q=user('GetDCEx',target,supplied?source:0,4|(supplied?0x80:0));check(q,0,'capacity failure '+slots+' supplied='+supplied);if(q)user('ReleaseDC',target,q);check(e.gdi_dc_state_used(),used,'capacity no DC leak');check(gdi('GetRgnBox',source,box),2,'capacity source retained');}assert(gdi('DeleteObject',regions.pop()));}
  for(const q of regions)assert(gdi('DeleteObject',q));assert(gdi('DeleteObject',source));run(target,4,edge,'capacity recovered');
  const used=e.gdi_dc_state_used();for(let i=0;i<600;i++){const q=user('GetDCEx',target,0,4);assert(q);assert(gdi('SaveDC',q));assert(user('ReleaseDC',target,q));}check(e.gdi_dc_state_used(),used,'600 release cycles');
  for(const q of [output,app,red,black])assert(gdi('DeleteObject',q));
  console.log(JSON.stringify({cases,calls,checks,failures:counts,examples:failures}));assert.strictEqual(failures.length,0,'GetDCEx parentclip public points and pixels');console.log('PASS GetDCEx DCX_PARENTCLIP public origin, parent visibility, regions and lifecycle');
}
main().catch(err=>{console.error(err);process.exitCode=1;});
