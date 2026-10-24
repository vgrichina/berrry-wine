from work import *
import importlib.util,re,struct
P=pathlib.Path('/tmp/maelstrom-poststart-phase-capture-oct24');D=pathlib.Path('/tmp/maelstrom-sdl-event-drain-cause-oct24/repo')
spec=importlib.util.spec_from_file_location('boundary',D/'tools/maelstrom-sdl-boundary.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
game=pathlib.Path('/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6');pes={}
for name,digest in p.HASHES.items():
 b=(game/name).read_bytes();assert sha(b)==digest;pes[name]=p.PE(b)
exe,net=pes['Maelstrom.exe'],pes['SDL_net.dll'];p.check_bytes(exe,0x402878,'e8a90b0100');assert p.call_target(exe,0x402878)+0==0x413426
p.check_bytes(exe,0x40287d,'83c40885c075e5');p.check_bytes(exe,0x40e000,'81ec2c020000');p.check_bytes(net,0x1000135d,'e8ee090000');assert 0x10001362-net.base+0x7a2000==0x7a3362
# x86 CALL terminates the basic block, so return PCs are genuine entries.
entries={hex(0x40287d):'CALL return from 402878',hex(0x7a3362):'CALL return from relocated SDL_net 1000135d',hex(0x40e000):'CALL target from 4019ab'}
assert p.call_target(exe,0x4019ab)==0x40e000
save('entry-byte-checks.json',dict(passChecks=True,entries=entries,bytesRead=64,returnBytes=net.read(0x10001362,16).hex(),counterSemantics='historical run compares EIP at decoded block entry',donorSourceSlices=str(D/'docs/re-notes/maelstrom-sdl-event-drain-cause-20261024/historical-slices.json')))
a=json.load(open(H/'guest-args.json'));a=[s for s in a if not s.startswith('--trace-at-mem=')]+['--trace-at-mem=esp:24'];save('guest-args.json',a)
source=pathlib.Path('/tmp/maelstrom-poststart-state-cause-oct24/canonical-run.js').read_text();assert sha(source.encode())=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
# Actual parser snippets, no harness main and no module instantiation.
parser=source[source.index('const getArg ='):source.index('// Was `--name=...`')]
trace=source[source.index('const TRACE_AT ='):source.index('const TRACE_AT_WATCH =')]
# This interval includes other constant declarations; limit to the actual trace array parser end.
trace=trace+source[source.index('const traceAtMem ='):source.index('}).filter(d => d.expr) : [];')+len('}).filter(d => d.expr) : [];')]
addr=source[source.index('            const parseAddrExpr = (expr) => {'):source.index("            const parts = [];",source.index('            const parseAddrExpr = (expr) => {'))] if '            const parts = [];' in source[source.index('            const parseAddrExpr = (expr) => {'):] else ''
# Exact pointer parsing ends just before loop printing.
start=source.index('            const parseAddrExpr = (expr) => {');end=source.index('            const parts =',start);addr=source[start:end]
code='const fs=require("fs"),vm=require("vm"),assert=require("assert");const args=JSON.parse(fs.readFileSync(process.argv[2])).slice(4);'+parser+'\n'+trace+'\n'+addr+'\nassert.equal(getArg("trace-from"),"30000");assert.equal(TRACE_AT,"0x406378");assert.equal(TRACE_AT_LIMIT,1);assert.equal(TRACE_AT_START_BATCH,30000);assert.equal(traceAtMem[0].expr,"esp");assert.equal(parseAddrExpr("*esp+20"),240);assert.equal(parseAddrExpr("esp"),100);console.log(JSON.stringify({pass:true,traceFrom:true,traceAt:true,pointer:true}));'
# Supply only read-only fixture register/memory exports.
code='const e={},regValue=n=>n==="esp"?100:null,g2w=x=>x,dv={getUint32:x=>x===120?240:0};'+code
(H/'parser-test.cjs').write_text(code)
r=subprocess.run(['node','--max-old-space-size=256',str(H/'parser-test.cjs'),str(H/'guest-args.json')],capture_output=True,text=True,timeout=60);save('parser-test.json',dict(returncode=r.returncode,stdout=r.stdout,stderr=r.stderr));assert r.returncode==0,r.stderr
wb=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm').read_bytes();assert sha(wb)=='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
def leb(o):
 v=0;shift=0
 while True:
  x=wb[o];o+=1;v|=(x&127)<<shift
  if x<128:return v,o
  shift+=7;assert shift<35
exports=[];o=8
while o<len(wb):
 kind=wb[o];size,c=leb(o+1);end=c+size
 if kind==7:
  count,c=leb(c)
  for _ in range(count):
   n,c=leb(c);name=wb[c:c+n].decode();c+=n;typ=wb[c];c+=1;idx,c=leb(c);exports.append(name)
 o=end
assert {'set_count','get_count','set_bp','get_eip','get_esp','get_yield_reason'}<=set(exports)
save('export-validation.json',dict(passChecks=True,noInstantiation=True,exports=exports,wasmSHA256=sha(wb),harnessSHA256=sha(source.encode()),observerSHA256=sha((H/'observer.cjs').read_bytes()),preloadSHA256=sha((H/'preload.cjs').read_bytes()),argvSHA256=sha((H/'guest-args.json').read_bytes())))
print('parser, exports, entries PASS')
