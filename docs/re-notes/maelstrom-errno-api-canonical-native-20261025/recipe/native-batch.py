import pathlib,subprocess,json,os,sys,time,datetime
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';NODE='/home/user/.nvm/versions/node/v24.22.1/bin/node'
cases=['errno0','errno4','errno37','wrong-select-return','wrong-native-target','wrong-return-pc','wrong-ebp','unsafe-errno','return-without-call','block-mode']
results=[]
for case in cases:
 cutoff=datetime.datetime.fromisoformat(json.load(open(O/'runtime.json'))['guestCutoff'].replace('Z','+00:00'));assert datetime.datetime.now(datetime.timezone.utc)<cutoff
 mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024;assert mem>=2684354560
 # A fresh OS process releases its sole 512MiB arena before the next fixture.
 # Single-shot diagnostics cannot safely be reset/reused across independent errno values.
 p=subprocess.run([NODE,'--max-old-space-size=512','--require',str(O/'native-module-bound.cjs'),str(R/'test/maelstrom-errno-canonical-native.cjs'),case],cwd=R,timeout=50)
 results.append(dict(scenario=case,exit=p.returncode,admissionMemory=mem));(O/'native-batch.json').write_text(json.dumps(dict(results=results,concurrentArenas=1,arenaMiB=512,perProcessHeapMiB=512,processesReaped=True),indent=2));assert p.returncode==0,('first substantive native rejection',case,p.returncode)
print(json.dumps(dict(status='PASS',scenarios=len(results),concurrentArenas=1)))
