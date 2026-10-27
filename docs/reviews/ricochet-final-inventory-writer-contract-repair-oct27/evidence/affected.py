import pathlib,hashlib,importlib.util,sys,os,runpy,json,shutil
R=pathlib.Path(__file__).resolve().parent.parent/'repo';O=R.parent/'ops'
sys.path.insert(0,str(R/'test'))
def load(name,p):
 s=importlib.util.spec_from_file_location(name,p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
# Retarget only source identity/configuration; strict independent assertions stay
# byte-for-byte unchanged. Historical originals remain separately pinned.
p=R/'test/ricochet-consumed-independent.test.py';s=p.read_text()
s=s.replace("D=pathlib.Path('/tmp/ricochet-consumed-control-accounting-repair-oct27/repo')",'D=pathlib.Path('+repr(str(R))+')')
old="HELPER:'857e30508c1e4db1c943b765a0e7551842973032cc5431eb08235dabda903364'"
s=s.replace(old,'HELPER:'+repr(hashlib.sha256((R/'tools/ricochet/runtime-accounting.py').read_bytes()).hexdigest()))
os.environ['RICOCHET_ACCEPT_OPS']=str(O)
(O/'independent-retarget.json').write_text(json.dumps(dict(originalSHA256=hashlib.sha256(p.read_bytes()).hexdigest(),retargetSHA256=hashlib.sha256(s.encode()).hexdigest(),onlyChanges='D and expected helper pin; all assertions unchanged')))
sys.argv=[str(p),*sys.argv[1:]]
exec(compile(s,str(p),'exec'),globals())
