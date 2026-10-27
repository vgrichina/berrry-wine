import sys,json,pathlib,hashlib
import run as c
H,R=c.H,c.R
def git(label,*args):
 sys.argv=['run','git',label,'-C',str(R),*args];c.main()
 return (H/(label+'.stdout')).read_text().strip()
D=R/'docs/reviews/airstrike-sixteen-capture-ordinary-quit-oct27'
for x in json.loads((D/'manifest.json').read_text()):
 p=D/x['path'];assert p.stat().st_size==x['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==x['sha256']
git('index','read-tree','HEAD')
git('stage','add','--','docs/reviews/airstrike-sixteen-capture-ordinary-quit-oct27')
git('whitespace','diff','--cached','--check')
names=git('scope','diff','--cached','--name-status').splitlines()
assert names and all(n.startswith('A\tdocs/reviews/airstrike-sixteen-capture-ordinary-quit-oct27/') for n in names),names
git('commit','commit','-m','docs: retain Airstrike sixteen-capture pass and frozen dispatch blocker')
sha=git('head','rev-parse','HEAD');ref='refs/heads/task/airstrike-sixteen-capture-ordinary-quit-oct27'
git('push','push','origin','HEAD:'+ref)
remote=git('exact-remote','ls-remote','--exit-code','origin',ref)
assert remote==sha+'\t'+ref,(sha,remote)
assert git('final-staged','diff','--cached','--name-only')==''
c.dump('publication.json',dict(commit=sha,remoteRef=ref,remote=remote,exactVerified=True,sourceEdits=False,main=False,actualGuestStarts=0,scopeFiles=len(names)))
print('PUBLISHED',sha,ref,'EXACT VERIFIED')
