import pathlib,json,hashlib,subprocess,re,shutil,os,sys
import guard
B=guard.B; donor=pathlib.Path('/tmp/d3d-render-cache-independent-closeout-oct23/repo')
base='5406777ecbcef9cf9b03b40d592d722bb0086de0';fixture='09dc88de08907d362eef2ac5dbbaad0080147358'
def obj(path,rev=base):
 p=subprocess.run(['git','-C',str(donor),'show',rev+':'+path],stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=30)
 assert p.returncode==0,'missing object '+path
 assert len(p.stdout)<=guard.FILE
 return p.stdout
def sha(b):return hashlib.sha256(b).hexdigest()
j=json.loads(pathlib.Path('/tmp/d3d-incremental-native-qualification-oct23/source-inventory.json').read_text());items={x['path']:x for x in j['closure']}
for x in items.values():
 b=obj(x['path'],x['revision']);assert len(b)==x['bytes'] and sha(b)==x['sha256'],x['path']
extra=['test/compile-src.js','tools/check-wat-manifest.js','tools/check-wat-fragments.js','tools/check-watx-provenance.js']
prov=obj('tools/check-watx-provenance.js').decode();arr=prov.split('const REQUIRED_FILES = [',1)[1].split('];',1)[0]
extra+=re.findall(r"'([^']+)'",arr)
for p in extra:
 if p in items:continue
 b=obj(p);blob=subprocess.check_output(['git','-C',str(donor),'rev-parse',base+':'+p],timeout=30).decode().strip()
 items[p]={'path':p,'blob':blob,'bytes':len(b),'sha256':sha(b),'revision':base,'reason':'actual compiler adapter or source/provenance gate input'}
codec=json.loads((guard.ROOT/'scratch/usage-watch/d3d-scoped-native-qualification-oct23.codec-receipt.json').read_text())
for x in codec['files']:
 b=pathlib.Path(x['path']).read_bytes();assert len(b)==x['bytes'] and sha(b)==x['sha256']
tools={}
for n in ['node','python3','git','ssh']:
 p=pathlib.Path(shutil.which(n)).resolve();tools[n]={'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())}
guard.write(B/'source-inventory.json',{'base':base,'fixture':fixture,'closure':list(items.values()),'bytes':sum(x['bytes'] for x in items.values()),'originalInventoryBytes':j['bytes'],'codec':codec,'tools':tools})
compiler=next(x for x in items.values() if x['path']=='tools/watx.js')
guard.write(B/'compiler-identity.json',{'candidate':base,'helper':items['test/render-helper.js'],'compiler':compiler,'excerpt':{'recipe':'entire tools/watx.js byte-for-byte, no transform','bytes':compiler['bytes'],'sha256':compiler['sha256']},'adapter':items['test/compile-src.js'],'loader':items['tools/watx-closure.js'],'stages':[x for x in items.values() if x['path'].startswith('tools/watx-src/')]})
st=guard.sample();source=sum(x['bytes'] for x in items.values())
# Two modules run sequentially, with no concurrent artifact retention.
parts={'checkout':source,'copiedPinnedPngjs':codec['totalBytes'],'gitMetadataPeak':2097152,'oneModule':8388608,'oneManifest':131072,'tempArtifactWriteHighwater':0,'logsEvidenceAndPublication':2097152,'preparedWrapperAndControlAndScripts':262144}
private=sum(parts.values());future=16777216;total=private+st['externalHighwater']+st['cumulativeGrowth']+future+8388608
plan={'parts':parts,'privatePeak':private,'futureGrowth':future,'reserve':8388608,'allocation':67108864,'projectedNew':total,'hostFree':st['hostFree'],'projectedHostRemaining':st['hostFree']-(total-st['measuredNew']),'initialSample':st,'commands':{'static':['node --max-old-space-size=256 tools/check-wat-manifest.js','node --max-old-space-size=256 tools/check-wat-fragments.js <exact all src/*.wat paths>','node --max-old-space-size=256 tools/check-watx-provenance.js'],'prepare':'WINE_RENDER_ARTIFACT_PREPARE=<own module> node --max-old-space-size=2048 <exact suite> CPU/wall900 MemAvailable2684354560','native':'WINE_RENDER_ARTIFACT=<sealed module> node --max-old-space-size=512 <same exact suite> CPU/wall150 MemAvailable1610612736','python':'wall60','git':'wall60 bounded output; metadata peak2MiB; strict SSH nonforce publication'},'scope':'diagnostic render modules; no canonical build.sh/shipping release claim; selected source/compiler gates required before preparation','verdict':'PASS' if total<=67108864 and st['hostFree']-(total-st['measuredNew'])>=2982150144 else 'DENY'}
guard.write(B/'admission.json',plan)
print(json.dumps({k:plan[k] for k in ['projectedNew','allocation','projectedHostRemaining','verdict']}))
print(json.dumps({'files':len(items),'sourceBytes':source,'addedInputs':len(items)-len(j['closure']),'privatePeak':private,'futureGrowth':future,'captureCharged':st['captureBytes']}))
