import pathlib,json,hashlib,importlib.util,subprocess,shutil,resource
H=pathlib.Path(__file__).parent;D=pathlib.Path('/tmp/maelstrom-poststart-state-cause-oct24');a=json.load(open(H/'guest-args.json'));delta=json.load(open(H/'capture-delta.json'))
def arg(k):
 v=[s.split('=',1)[1] for s in a if s.startswith('--'+k+'=')];assert len(v)==1,(k,v);return v[0]
for flag in delta:assert flag.replace('OWN',str(H/'guest')) in a
assert arg('max-batches')=='42000' and arg('tick-ms-per-batch')=='200'
recipe=dict(count=arg('count'),input=arg('input'),traceAt=[x for x in a if x.startswith('--trace-at')])
spec=importlib.util.spec_from_file_location('proof',D/'repo/tools/maelstrom-poststart-proof.py');p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
r=p.node_validate((D/'canonical-run.js').read_bytes(),recipe,H)
wb=pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm').read_bytes();assert hashlib.sha256(wb).hexdigest()=='8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'
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
assert {'set_count','get_count','set_bp','get_eip','get_esp'}<=set(exports)
r.update(actualArgvSHA256=hashlib.sha256((H/'guest-args.json').read_bytes()).hexdigest(),exactDelta=True,exportsVerified=True,noInstantiation=True,outputProjection=dict(stateRawBytes=18752,stateTextUpper=100000,trace=12000,logs=30000,pngs=393216,separateLogCap=524288),moduleSHA256=hashlib.sha256(wb).hexdigest())
(H/'config-validation.json').write_text(json.dumps(r,indent=2));print(json.dumps(r))
