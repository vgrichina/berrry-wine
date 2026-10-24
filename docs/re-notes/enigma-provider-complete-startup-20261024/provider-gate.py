"""Validate exact explicit native providers before a single diagnostic launch."""
import pathlib,json,hashlib,sys,gzip
H=pathlib.Path(__file__).parent
P=pathlib.Path('/tmp/enigma-register-load-cause-oct24/repo/tools/enigma-unpacked-closure.py')
PARSER_SHA='f949185c282300ac3463b5524420464f87883b5ab5cb6e833fdf564cf6d83bbf'
def gate(manifest,args):
 b=P.read_bytes();assert hashlib.sha256(b).hexdigest()==PARSER_SHA;ns={'__name__':'sealed'};exec(compile(b,str(P),'exec'),ns)
 rows={x['target']:x for x in manifest};raw=next(a for a in args if a.startswith('--dlls='))[7:].split(',');providers={};order=[]
 for filename in raw:
  target=str(pathlib.Path(filename).relative_to(H));assert target in rows,'provider absent from manifest: '+target
  r=rows[target];data=pathlib.Path(r['path']).read_bytes();assert len(data)==r['bytes'] and hashlib.sha256(data).hexdigest()==r['sha256'];name=pathlib.Path(target).name.lower();assert name not in providers;providers[name]=ns['pe'](r['path']);order.append(name)
 exe=ns['pe']('/tmp/enigma-authentic-static-unpack-oct24/outputs/enigma.exe');available={pathlib.Path(x['target']).name.lower() for x in json.load(open(H/'manifest.json')) if x['target'].startswith('vfs/') and len(pathlib.Path(x['target']).parts)==3 and x['target'].lower().endswith('.dll')};available.add('msvcrt.dll');bindings=[];edges=[]
 for name,meta in [('enigma.exe',exe),*providers.items()]:
  for dep,symbols in meta['imports'].items():
   if dep not in available:continue
   assert dep in providers,'native normal-import provider absent: '+dep
   if name!='enigma.exe':assert order.index(dep)<order.index(name),'provider dependency order'
   edges.append([name,dep])
   for symbol in symbols:
    assert symbol in providers[dep]['exports'],(name,dep,symbol)
    assert providers[dep]['exports'][symbol] is None,'unexpected native forwarded export'
    bindings.append([name,dep,symbol,providers[dep]['export_rvas'][symbol]])
 assert 'msvcrt.dll' in providers
 assert providers['sdl.dll']['sha256']=='66136f9cc7091b7fa59514afe88792e45476926f8415f0080a6401f5f1b6366b'
 assert providers['sdl.dll']['export_rvas']['SDL_getenv']==37536
 return dict(passGate=True,providers=order,nativeEdges=edges,nativeBindingCount=len(bindings),bindings=bindings,SDL_getenvRVA=37536,parserSHA256=PARSER_SHA)
if __name__=='__main__':
 try:
  result=gate((json.loads(gzip.decompress(pathlib.Path(sys.argv[1]).read_bytes())) if sys.argv[1].endswith('.gz') else json.load(open(sys.argv[1]))),json.load(open(H/'guest-args.json')));print(json.dumps(result))
 except (AssertionError,KeyError,OSError) as e:print('REJECT: '+str(e),file=sys.stderr);sys.exit(2)
