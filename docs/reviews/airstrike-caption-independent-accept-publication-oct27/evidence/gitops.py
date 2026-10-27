"""Run only under TWO-permit pool and trusted supervisor holding Git flock."""
import pathlib,subprocess,json,hashlib,sys,time,os
import run as c
def git(label,args,required=True):
 if sys.argv[1].startswith('publish-archive-context'):label=sys.argv[1]+'-'+label
 assert c.gate() is None,'fresh admission failure; no retry'
 cmd=['prlimit','--data=536870912','--','git','-C',str(c.R),*args]
 o=c.H/(label+'.stdout');e=c.H/(label+'.stderr')
 c.dump(label+'.command.json',dict(argv=cmd,ssh=c.SSH,DATA='Git child only 512MiB',parentDATA=__import__('resource').getrlimit(__import__('resource').RLIMIT_DATA)))
 with o.open('wb') as out,e.open('wb') as err:r=subprocess.run(cmd,stdout=out,stderr=err,timeout=110)
 c.dump(label+'.status.json',dict(exit=r.returncode,stdoutSHA256=hashlib.sha256(o.read_bytes()).hexdigest(),stderrSHA256=hashlib.sha256(e.read_bytes()).hexdigest()))
 assert o.stat().st_size+e.stat().st_size<=2*c.M
 assert not required or r.returncode==0,(label,r.returncode)
 return r.returncode,o.read_bytes()
mode=sys.argv[1]
if mode=='inspect':
 root=c.ROOT/'.git';loose=root/'refs/heads/main'
 if loose.exists():main=loose.read_text().strip()
 else:main=next(x.split()[0] for x in (root/'packed-refs').read_text().splitlines() if x.endswith(' refs/heads/main'))
 paths=list(json.loads((c.H/'input-identities.json').read_text())['sourcePins'])
 state={}
 for i,p in enumerate(paths):
  rc,data=git('local-main-source-'+str(i),['show',main+':'+p],required=False)
  own=(c.R/p).read_bytes()
  state[p]=dict(available=rc==0,mainSHA256=hashlib.sha256(data).hexdigest() if rc==0 else None,candidateSHA256=hashlib.sha256(own).hexdigest(),identical=rc==0 and data==own,bytes=len(own))
 c.dump('current-main.json',dict(main=main,source='locally read root packed main ref only; may differ from coordinator integration main, which is not fetched or integrated',paths=state,closure='Production Python Controller and Bridge use stdlib only plus bridge dynamic hash-pinned Controller. Targeted fixture imports both and read-only original retained request/image, all preserved; historical baseline receipts reused, not baseline test source reruns. Rejected candidate MUST NOT be integrated. Future accepted repair needs explicit source/test/recipe hunks plus any missing predecessor controller/bridge/frozen-dispatch tests on exact coordinator integration main; never merge orphan report whole.'))
 print('Locally inspected main source/dependency closure without fetching or integration.')
elif mode in ('publish','publish-archive-context','publish-archive-context2'):
 git('stage',['add','--sparse','.gitattributes','tools','test','docs'])
 git('diff-check',['diff','--cached','--check'])
 git('staged-stat',['diff','--cached','--stat'])
 git('commit',['commit','-m','Reject Airstrike caption repair on unsafe main-window height'])
 _,head=git('head',['rev-parse','HEAD']);commit=head.decode().strip()
 ref='refs/heads/task/airstrike-caption-independent-accept-publication-oct27'
 c.dump('local-commit.json',dict(commit=commit,ref=ref,remoteVerified=False))
 git('push',['push','origin',commit+':'+ref])
 _,remote=git('remote-verify',['ls-remote','--exit-code','origin',ref])
 lines=remote.decode().splitlines();assert lines==[commit+'\t'+ref],lines
 c.dump('publication.json',dict(commit=commit,remoteRef=ref,exactRemoteLine=lines[0],verified=True,origin='git@github.com:vgrichina/wine-assembly.git',SSH=c.SSH,mainTouched=False,accepted=False))
 print('Verified exact remote commit/ref:',commit,ref)
else:raise AssertionError(mode)
