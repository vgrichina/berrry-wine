'use strict';
// Diagnostic host reads only. No guest function calls, writes, allocation,
// breakpoint rearming, clock changes, scheduling or fabricated guest strings.
module.exports = function createObserver(emit, region) {
  const points = new Set([
    0x489ec9,0x489ece,0x489ef1,0x489ef6,0x48a1d9,
    0x918790,0x9187c5,0x9187db,0x9187fb,
    0x930650,0x930695,0x9306be,0x9306ed,0x930702,0x93072b,
    0x8e9680,0x8e9730,0x8e9772,0x8e9792,0x8e97de,0x8e97ef,
    0x8e982c,0x8e983e,0x8e9877,0x8e98b7,0x8e98bf,0x8e98ca,
    0x8e98dc,0x8e98ec,0x8e98fb,0x8e9904,0x8e9931,0x8e9946,0x8e9960,
    0x486e30,0x486fd7,0x918670,0x8e4603,0x8e46ca,
    0x486ffb,0x48700d,0x487029,0x487040,0x487059,0x487070,
    0x48709e,0x4870b5,0x4870ce,0x4870e5,0x4870fe,0x487119,
    0x487190,0x4871ab,0x4871b4,
  ]);
  let seq=0, count=0, lookup=null, xml=false;
  const hits=new Map();
  const handles=new Map(), pending=[];
  const names=new Set(['CreateFileA','CreateFileW','ReadFile','SetFilePointer','GetFileSize','CreateFileMappingA','CreateFileMappingW','MapViewOfFile','CoCreateInstance','SendMessageW','SendMessageA','GetDlgItem','DialogBoxParamW']);
  function view(e,m,tr) {
    const dv=new DataView(m.buffer), base=e.get_image_base()>>>0;
    const wa=a=>tr(a>>>0,base,m.buffer);
    const u32=a=>dv.getUint32(wa(a),true);
    const bytes=(a,n)=>Array.from({length:Math.min(n,256)},(_,i)=>dv.getUint8(wa(a+i)));
    const str=(a,wide=false,n=256)=>{
      if(!a)return null; let out='';
      for(let i=0;i<n;i++){const c=wide?dv.getUint16(wa(a+2*i),true):dv.getUint8(wa(a+i));if(!c)break;out+=String.fromCharCode(c);}return out;
    };
    const safe=f=>{try{return f();}catch(err){return {unreadable:String(err.message)};}};
    const regs={};for(const r of ['eax','ebx','ecx','edx','esi','edi','ebp','esp','eip'])regs[r]=e['get_'+r]()>>>0;
    const stack=Array.from({length:12},(_,i)=>safe(()=>u32(regs.esp+4*i)));
    function windows(){
      const out=[];
      for(let s=0;s<256;s++){
        const rec=region.BASE.WND_RECORDS+s*24,hwnd=dv.getUint32(rec,true);if(!hwnd)continue;
        const ctrl=region.BASE.CONTROL_TABLE+s*16,cls=dv.getUint32(ctrl,true),id=dv.getUint32(ctrl+4,true);
        if(![2,1030,1032,1034,1035,1036].includes(id)&&dv.getUint32(rec+8,true)!==0)continue;
        const state=dv.getUint32(rec+20,true),title=region.BASE.TITLE_TABLE+s*8;
        const tp=dv.getUint32(title,true),tl=dv.getUint32(title+4,true);
        const x={slot:s,hwnd,cls,id,proc:dv.getUint32(rec+4,true),parent:dv.getUint32(rec+8,true),state,titlePtr:tp,titleLen:tl,title:safe(()=>str(tp))};
        if(state&&(cls===1||cls===3)){x.textPtr=safe(()=>u32(state));x.textLen=safe(()=>u32(state+4));x.text=safe(()=>str(x.textPtr));}
        if(state)x.stateBytes=safe(()=>bytes(state,48));out.push(x);
      }return out;
    }
    return {dv,u32,bytes,str,safe,regs,stack,windows};
  }
  function send(x){if(count++<1600)emit({seq:++seq,...x});}
  function block(ip,e,m,tr){
    if(!points.has(ip>>>0)&&!(ip>=0x8e9680&&ip<0x8e9980)&&!(ip>=0x930650&&ip<0x930b00))return;
    const n=hits.get(ip)||0;if(n>=8)return;hits.set(ip,n+1);
    const v=view(e,m,tr),{regs:r,stack:s,safe,u32,str,bytes}=v;
    if(ip===0x918670)lookup=s[1];
    const x={kind:'block',ip:ip>>>0,regs:r,stack:s,lookup,
      manager:safe(()=>({pointer:u32(0xce26cc),count:u32(0xce26d0),tables:bytes(u32(0xce26cc),32)}))};
    if(ip===0x8e9680){xml=true;x.xmlFilename=safe(()=>str(s[2],true));x.xmlObject=safe(()=>bytes(r.ecx,48));}
    if(ip>=0x8e9730&&ip<=0x8e9960){x.xml=true;x.esi=safe(()=>bytes(r.esi,48));x.locals=safe(()=>bytes(r.esp+0x10,64));x.url=safe(()=>str(u32(r.esp+0x18),true));x.eaxData=safe(()=>bytes(r.eax,32));}
    if(ip===0x8e98bf){x.comObject=safe(()=>u32(r.esp+0x14));x.comVtable=safe(()=>bytes(u32(x.comObject),96));}
    if(ip===0x8e98fb){x.parseUrl=safe(()=>str(r.eax,true));}
    if(ip===0x8e4603){x.returnObject=safe(()=>bytes(r.eax,16));x.returnText=safe(()=>str(u32(r.eax),true));}
    if(ip===0x8e46ca){x.destination=safe(()=>({pointer:u32(r.ebx),text:str(u32(r.ebx),true)}));}
    if(ip===0x486e30||ip===0x486fd7||ip>=0x486ffb&&ip<=0x4871b4){
      x.windows=v.windows();x.result=safe(()=>bytes(0xc4319c,80));x.explanation=safe(()=>str(u32(0xc431a0),true));
      x.textBuffer=safe(()=>str(r.eax,true));
    }
    send(x);
  }
  function api(name,e,m,tr,phase){
    if(!names.has(name))return;
    const v=view(e,m,tr),{regs:r,stack:s,safe,u32,str,bytes}=v;
    if(phase==='entry'){
      const args=s.slice(1),p={name,args,ret:s[0]};pending.push(p);
      const x={kind:'api-entry',name,ret:s[0],args,regs:r};
      if(name.startsWith('CreateFile')){x.path=safe(()=>str(args[0],name.endsWith('W')));p.path=x.path;}
      if(name==='ReadFile')x.file=handles.get(args[0])||null;
      if(name==='CoCreateInstance'){x.clsid=safe(()=>bytes(args[0],16));x.iid=safe(()=>bytes(args[3],16));}
      if(name.startsWith('SendMessage')&&args[1]===12){x.text=safe(()=>str(args[3],name.endsWith('W')));x.textBytes=safe(()=>bytes(args[3],128));x.windows=v.windows();}
      send(x);
    }else{
      const i=pending.map(x=>x.name).lastIndexOf(name),p=i<0?null:pending.splice(i,1)[0];
      const x={kind:'api-exit',name,eax:r.eax,entry:p};
      if(p&&name.startsWith('CreateFile')&&r.eax!==0xffffffff)handles.set(r.eax,p.path);
      if(p&&name==='ReadFile'){x.readCount=safe(()=>u32(p.args[3]));x.bytes=safe(()=>bytes(p.args[1],Math.min(x.readCount||0,128)));x.file=handles.get(p.args[0])||null;}
      if(p&&name==='CoCreateInstance')x.object=safe(()=>u32(p.args[4]));
      if(name.startsWith('SendMessage'))x.windows=v.windows();send(x);
    }
  }
  return {block,api};
};
