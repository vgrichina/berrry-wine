from work import *
import gzip
E=H/'repo/docs/re-notes/enigma-provider-complete-startup-20261024'
for s in json.load(open(E/'evidence-seals.json')):
 b=(E/s['path']).read_bytes();assert len(b)==s['bytes'] and sha(b)==s['sha256']
m=json.loads(gzip.decompress((E/'manifest.json.gz').read_bytes()));t=json.loads(gzip.decompress((E/'tree-validation.json.gz').read_bytes()));assert len(m)==2659 and sum(x['bytes'] for x in m)==37476538 and t['files']==2460
assert all((x['sha256'],x['bytes'])==next((r['sha256'],r['bytes']) for r in m if r['target']==x['target']) for x in t['mapping'])
assert t['argv']==json.load(open(E/'command.json'))['argv']
checks=[]
for name,status in [('manifest.json.gz',0),('reject-missing-sdl-manifest.json.gz',2)]:
 r=subprocess.run(['python3',str(H/'provider-gate.py'),str(E/name)],capture_output=True,text=True,timeout=60);assert r.returncode==status,(name,r.stderr)
 checks.append(dict(fixture=name,status=r.returncode,stdoutSHA256=sha(r.stdout.encode()),stderr=r.stderr,helperSHA256=sha((H/'provider-gate.py').read_bytes())))
 if status==0:assert json.loads(r.stdout)['nativeBindingCount']==527
log=(E/'output.log').read_bytes();assert len(log)==131072 and b'UNIMPLEMENTED API:' not in log and b'[crash]' not in log
assert all(('DLL: '+n).encode() in log for n in ['msvcrt.dll','zlib1.dll','libpng12-0.dll','SDL.dll','SDL_image.dll','SDL_mixer.dll','libfreetype-6.dll','SDL_ttf.dll'])
term=json.load(open(E/'terminal.json'));assert term['reason']=='output-guard' and term['returncode']==-9 and not term['remainingGroup']
assert not list(E.glob('*.png'));assert len(json.load(open(E/'api-traces.json')))==16
r=dict(passBundle=True,sealedArtifacts=len(json.load(open(E/'evidence-seals.json'))),normalBindingCount=527,exactTreeFiles=2460,completeClosureFiles=2659,providerControls=checks,terminalGuardVerified=True,frameProduced=False,guestAttempts=1,staticOnly=True)
save('bundle-tests.json',r);print(json.dumps(r))
