"""Read-only static blocker check; does not launch a fixture or import production."""
import ast,hashlib,json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
PINS={
'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py':'73c5bd33eb8af3887f5c6f21a8c6354aef591baf2d41589eb673c9d275448b60',
'test/toyvm-kernel-profile-accounting-backend-oct28/confine.py':'0b10df6497f359f9684f1dbb0752eba3816d0e6568c492c39f62ba3a3f2076d8',
'test/toyvm-kernel-profile-accounting-backend-oct28/fuse_backend.py':'e281eb058cee5e65797566c738d0330d2449ec6fe84572d572cfbf181c32ec41',
'test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py':'5ac463e9168b1162b47b784e919a6f71830d5581c5fbde14597f8e1e866eb3bf',
'test/toyvm-transient-profile-accounting-repair-oct28/pinned-supervisor.py':'9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'}
for rel,digest in PINS.items():assert hashlib.sha256((ROOT/rel).read_bytes()).hexdigest()==digest
conf=(ROOT/'test/toyvm-kernel-profile-accounting-backend-oct28/confine.py').read_text()
tree=ast.parse(conf)
allowed=next(ast.literal_eval(n.value) for n in ast.walk(tree) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='allowed' for t in n.targets))
headers=pathlib.Path('/usr/include/x86_64-linux-gnu/asm/unistd_64.h').read_text()
numbers={x.split()[1]:int(x.split()[2]) for x in headers.splitlines() if x.startswith('#define __NR_')}
assert numbers['__NR_setsid']==112
assert 112 not in allowed
assert 'ins.append((0x06,0,0,0x00050000|1))' in conf
assert "restrict(sys.argv[1]);os.execvp(sys.argv[2],sys.argv[2:])" in conf
adapter=(ROOT/'test/toyvm-kernel-profile-accounting-backend-oct28/supervise_accounted.py').read_text()
assert "str(HERE/'confine.py'),str(root),*argv" in adapter
caller=(ROOT/'test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py').read_text()
assert "backend='synchronous-fuse'" in caller
print(json.dumps(dict(staticCheckPassed=True,behavioralAcceptance=False,setsidSyscall=112,allowed=False,unlistedAction='SECCOMP_RET_ERRNO | EPERM',productionInvocations=0,sourcePins=PINS,alsoDeniedIdentityQueries={k:v for k,v in numbers.items() if k in ('__NR_getsid','__NR_getpgid') and v not in allowed}),sort_keys=True))
