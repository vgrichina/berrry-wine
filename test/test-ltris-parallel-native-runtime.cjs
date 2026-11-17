'use strict';
// Authored PE. This program has no game/media/config/board bytes. Its native
// wndproc advances only via real delivered WM_KEYDOWN/WM_KEYUP pairs.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
function fixture(variant='main') {
  assert(['main','threaded','missing-health'].includes(variant));
  const b = Buffer.alloc(0x4400), base = 0x400000, raw = r => r - 0x1000 + 0x400;
  const w = (o,n) => b.writeUInt16LE(n,o), d = (o,n) => b.writeUInt32LE(n>>>0,o);
  const pe = 0x80, opt = pe+24, section = opt+224;
  w(0,0x5a4d); d(0x3c,pe); d(pe,0x4550); w(pe+4,0x14c); w(pe+6,1); w(pe+20,224); w(pe+22,0x10e);
  w(opt,0x10b);d(opt+16,variant==='main'?0x2000:0x2800);d(opt+28,base);d(opt+32,4096);d(opt+36,1024);
  w(opt+40,4);w(opt+48,4);d(opt+56,0x5000);d(opt+60,1024);w(opt+68,2);
  d(opt+72,0x100000);d(opt+76,4096);d(opt+80,0x100000);d(opt+84,4096);d(opt+92,16);
  d(opt+104,0x1000);d(opt+108,60);b.write('.native',section);d(section+8,0x4000);d(section+12,0x1000);
  d(section+16,0x4000);d(section+20,1024);d(section+36,0xe0000060);
  const apis = new Map(); let string = 0x1600;
  const libraries = [['kernel32.dll',['ExitProcess','Sleep','CreateThread']],['user32.dll',[
    'RegisterClassA','CreateWindowExA','SetFocus','GetMessageA','TranslateMessage','DispatchMessageA',
    'DefWindowProcA','SetWindowTextA','PostQuitMessage']]];
  for (const [i,[dll,names]] of libraries.entries()) {
    const desc=raw(0x1000+i*20), thunk=0x1200+i*256;
    d(desc,thunk);d(desc+12,string);d(desc+16,thunk);b.write(dll+'\0',raw(string));string+=dll.length+1;
    for(const [j,name] of names.entries()) {
      d(raw(thunk+j*4),string);b.write(name+'\0',raw(string+2));string+=name.length+3;apis.set(name,base+thunk+j*4);
    }
  }
  b.write('LTrisGuardFixture\0',raw(0x3000));
  b.write('STATIC\0',raw(0x3040));b.write('Authored native guard fixture\0',raw(0x3080));
  const titles=['Fixture active board | ESC opens End Game', 'Fixture End Game? Y/N | ESC UP observed',
    'Fixture Back selected | Y UP observed', 'Fixture Quit selected | Back Enter UP observed'];
  for(const [i,title] of titles.entries()) b.write(title+'\0',raw(0x3100+i*128));
  d(raw(0x3504),base+0x2400);d(raw(0x3510),base);d(raw(0x351c),6);d(raw(0x3524),base+0x3000);
  const u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24];
  function assemble(rva,work) {
    const code=[], labels=new Map(),fix=[];
    const emit=(...a)=>code.push(...a), push=n=>emit(0x68,...u32(n)), call=n=>emit(0xff,0x15,...u32(apis.get(n)));
    const label=n=>labels.set(n,code.length), jump=(n,condition)=>{emit(...(condition?[0x0f,condition]:[0xe9]));fix.push([code.length,n]);emit(0,0,0,0);};
    work({emit,push,call,label,jump});const result=Buffer.from(code);
    for(const [o,n] of fix){assert(labels.has(n));result.writeInt32LE(labels.get(n)-o-4,o);}
    assert(result.length<0x400);result.copy(b,raw(rva));
  }
  assemble(0x2000,({emit,push,call,label,jump})=>{
    push(base+0x3500);call('RegisterClassA');
    for(const n of [0,base,0,0,300,700,40,40,0x10cf0000,base+0x3080,base+0x3000,0])push(n);
    call('CreateWindowExA');emit(0xa3,...u32(base+0x3600),0x50);call('SetFocus');
    push(0);push(base);push(7);emit(0xff,0x35,...u32(base+0x3600));
    for(const n of [100,660,20,20,0x50000000,base+0x3100,base+0x3040,0])push(n);
    call('CreateWindowExA');emit(0xa3,...u32(base+0x360c));
    emit(0xff,0x35,...u32(base+0x3600));call('SetFocus');
    label('pump');for(const n of [0,0,0,base+0x3640])push(n);call('GetMessageA');emit(0x85,0xc0);jump('exit',0x84);
    push(base+0x3640);call('TranslateMessage');push(base+0x3640);call('DispatchMessageA');jump('pump');
    label('exit');push(0);call('ExitProcess');emit(0xcc);
  });
  assemble(0x2400,({emit,push,call,label,jump})=>{
    // frame args: hwnd,msg,wParam,lParam. Stage changes only on expected DOWN;
    // title and final Quit are committed only by the matching native UP.
    emit(0x55,0x89,0xe5,0x81,0x7d,0x0c,...u32(0x100));jump('upcheck',0x85);
    for(const [i,key] of [27,89,13,13].entries()) {
      emit(0x83,0x3d,...u32(base+0x3604),i);jump('next'+i,0x85);
      emit(0x83,0x7d,0x10,key);jump('default',0x85);
      emit(0xc7,0x05,...u32(base+0x3608),...u32(key));jump('zero');label('next'+i);
    }
    jump('default');label('upcheck');emit(0x81,0x7d,0x0c,...u32(0x101));jump('default',0x85);
    emit(0xa1,...u32(base+0x3608),0x85,0xc0);jump('default',0x84);emit(0x3b,0x45,0x10);jump('default',0x85);
    emit(0xc7,0x05,...u32(base+0x3608),0,0,0,0,0xff,0x05,...u32(base+0x3604));
    for(let i=1;i<=3;i++) {
      emit(0x83,0x3d,...u32(base+0x3604),i);jump('later'+i,0x85);
      push(base+0x3100+i*128);emit(0xff,0x35,...u32(base+0x360c));call('SetWindowTextA');jump('zero');label('later'+i);
    }
    push(0);call('PostQuitMessage');jump('zero');label('default');
    for(const offset of [20,16,12,8])emit(0xff,0x75,offset);call('DefWindowProcA');emit(0xc9,0xc2,0x10,0);
    label('zero');emit(0x31,0xc0,0xc9,0xc2,0x10,0);
  });
  assemble(0x2800,({emit,push,call,label,jump})=>{
    if(variant==='threaded') {
      for(const n of [base+0x3680,0,0,base+0x2000,0,0])push(n);
      call('CreateThread');
    }
    label('wait');push(50);call('Sleep');jump('wait');
  });
  return b;
}
function prepare(variant='main') {
  const dir=path.join(root,'test/binaries/ltris-parallel-native-20261116');fs.mkdirSync(dir,{recursive:true});
  const bytes=fixture(variant), file=path.join(dir,'native-quit-fixture-'+crypto.createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.exe');
  if(fs.existsSync(file))assert.deepEqual(fs.readFileSync(file),bytes);else fs.writeFileSync(file,bytes,{flag:'wx'});
  return {file,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),size:bytes.length};
}
if(require.main===module) {
  if(process.argv.includes('--prepare'))process.stdout.write(JSON.stringify(prepare(process.argv.find(p=>p.startsWith('--variant='))?.split('=')[1]||'main'))+'\n');
  else {
    const bytes=fixture();assert.equal(bytes.readUInt32LE(0x80),0x4550);
    assert.equal(bytes.readUInt16LE(0x84),0x14c);assert.equal(bytes.length,0x4400);
    assert(bytes.includes(Buffer.from('PostQuitMessage\0')));assert(bytes.includes(Buffer.from('Y UP observed\0')));
    console.log('Authored PE structure checks PASS; native runtime qualification NOT RUN');
  }
}
module.exports={fixture,prepare};
