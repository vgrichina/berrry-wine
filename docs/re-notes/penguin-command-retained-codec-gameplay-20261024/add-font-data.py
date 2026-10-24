from api import *
import os
os.environ['GIT_NO_LAZY_FETCH']='1';D='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23';REV='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
def git(p):return subprocess.check_output(['git','-C',D,'show',REV+':'+p])
f=json.loads(git('fonts/substitutions.json'));paths=set()
for face in f['faces']:
 for style in face.get('win98Files',{}):
  source=face.get('styles',{}).get(style)
  if source:paths.add('fonts/subset/'+source.rsplit('/',1)[-1])
j=json.load(open(H/'admission.json'));added=[]
for p in sorted(paths):
 b=git(p);x=dict(path=p,target='runner/'+p,bytes=len(b),sha256=hashlib.sha256(b).hexdigest(),kind='git');added.append(x)
increase=sum(x['bytes'] for x in added);assert j['projected']+increase<=67108864
j['manifest']+=added;j['projected']+=increase;j['remotePayload']+=increase;j['fontDataCorrection']='Runtime fontMounts(...,{subset:true}) derives required CP1252 subset paths; supplied125file manifest had full fonts only. Preguest executed missing-path trace retained; exact historical subset Git bytes added, no sources modified.'
(H/'admission.json').write_text(json.dumps(j,indent=2))
for x in added:send(git(x['path']),ROOT+'/'+x['target'])
send(json.dumps(j['manifest']).encode(),ROOT+'/manifest.json')
remote('python3 -c '+shlex.quote('import pathlib;h=pathlib.Path('+repr(ROOT)+');(h/"run").rename(h/"preguest-missing-fonts");(h/"preflight.json").rename(h/"preflight-incomplete-font-data.json")'))
print('added',len(added),'subset fonts',increase,'bytes; revised projection',j['projected'])
