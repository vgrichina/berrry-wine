from common import *
P=R/'docs/reviews'/H.name
shutil.copyfile(O/'publish.py',P/'publish.py')
for name in ['observer-identity.json','admission-recovery-check.json','recovery-check.json','recovery-check.log']:
 shutil.copyfile(O/name,P/name)
f=json.load(open(O/'remote-final-state.json'));gate('publish',remote=f['allocated']+f['apiProcessLogs'])
shutil.copyfile(O/'admission-publish.json',P/'admission-publish.json')
payloads={str(q.relative_to(P)):dict(bytes=q.stat().st_size,sha256=sha(q.read_bytes())) for q in sorted(P.rglob('*')) if q.is_file() and q.name!='evidence-manifest.json'}
(P/'evidence-manifest.json').write_text(json.dumps(dict(candidate=REV,branch=BR,files=payloads),indent=2)+'\n')
for name,r in payloads.items():assert sha((P/name).read_bytes())==r['sha256']
g('add','--sparse','docs/reviews/'+H.name);g('diff','--cached','--check')
delta=g('diff','--cached','--name-only').decode().splitlines();assert delta and all(x.startswith('docs/reviews/'+H.name+'/') for x in delta)
tree=g('write-tree','--missing-ok').decode().strip()
msg=O/'commit-message.txt';msg.write_text('Record exact-main full-VM palette alpha/page-watch API qualification\n\nCanonical full-closure compilation, native instantiation and unchanged retained assertions pass. Preserve pinned inputs, module identity, resource/access receipts and tested recovery recipe; GPU and gameplay remain unqualified.\n')
commit=g('commit-tree',tree,'-p',REV,'-F',str(msg)).decode().strip();g('update-ref','refs/heads/'+BR,commit,REV)
changed=g('diff-tree','--no-commit-id','--name-only','-r',REV,commit).decode().splitlines();assert changed==delta
assert g('rev-parse','HEAD').decode().strip()==commit
save('local-publication.json',dict(commit=commit,branch=BR,parent=REV,tree=tree,files=changed,manifestSHA256=sha((P/'evidence-manifest.json').read_bytes())))
print('COMMIT',commit,flush=True)
out=g('push','--porcelain','origin','HEAD:refs/heads/'+BR).decode();(O/'push-stdout.log').write_text(out)
remote=g('ls-remote','--exit-code','origin','refs/heads/'+BR).decode().strip();assert remote==commit+'\trefs/heads/'+BR,remote
receipt=dict(commit=commit,branch=BR,remote=remote,candidate=REV,module=json.load(open(O/'checkpoint.json')),payloadFiles=len(payloads),manifestSHA256=sha((P/'evidence-manifest.json').read_bytes()),lifecycle=dict(box=BOX,state='RUNNING',owner='coordinator',shutdown='2026-10-26T21:15:00Z',expiry='2026-10-26T21:35:51.258Z'),remaining=['GPU/WebGL/backend','native palette policy','gameplay/27apps'])
save('final-receipt.json',receipt);print('EXACT REMOTE VERIFIED',remote)
