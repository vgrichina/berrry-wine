import pathlib,json,hashlib,difflib,resource,shutil,base64,os,time
H=pathlib.Path(__file__).parent;R=H.parent/'repo';D=pathlib.Path('/tmp/enigma-frame-accounting-corrected-admission-oct27');A=pathlib.Path('/tmp/enigma-review-budget-independent-accept-oct27/repo');C='37bad5b6a919a62b4e385b72219c2bb2b01a223b'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads((H/'producer-receipt.json').read_text());pins=m['sourcePins']
for p,h in pins.items():assert sha(R/p)==h,(p,h,sha(R/p))
verified=[]
for line in (H/'candidate-tree.stdout').read_text().splitlines():
 meta,name=line.split('\t');blob=meta.split()[2];raw=(R/name).read_bytes()
 assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==blob,name
 verified.append(dict(path=name,gitBlob=blob,sha256=sha(R/name)))
assert len(verified)==4
old=(A/'tools/enigma-frozen-gameplay-controller.py').read_text().splitlines(True);new=(R/'tools/enigma-frozen-gameplay-controller.py').read_text().splitlines(True)
diff=''.join(difflib.unified_diff(old,new,fromfile='previous-rejected-controller',tofile=C))
(H/'independent-source-review.diff').write_text(diff)
check=json.loads((H/'acceptance-checkpoint.json').read_text());assert len(check['completed'])==12 and not check['remaining']
reused={}
for n in ['checkpoint-test_full_frame_budget.json','checkpoint-test_review_budget.json','full-frame-final.json','related-tests.json']:
 p=D/'ops'/n;q=json.loads(p.read_text());assert q.get('successful',q.get('exit')==0),n
 reused[n]=dict(path=str(p),sha256=sha(p),scope='Unchanged production and affected fixture dependency pins; other groups fixture files are unrelated inputs, not grounds for repeating successful tests')
receipt=dict(status='ACCEPTED_OFFLINE_FULL_FRAME_ACCOUNTING',candidate=C,producerReceipt=dict(path=str(D/'ops/receipt-manifest.json'),sha256=sha(H/'producer-receipt.json')),sourcePins=pins,candidateGitBlobChecks=verified,firstBoundary=dict(path='first-boundary/boundary.json',sha256=sha(H/'first-boundary/boundary.json'),oracle='Unchanged original production main reproducer, 34 seconds with slots .25/33.75; exit0, zero input, spent>=2s; failure oracle preserved'),independent=dict(checkpoint='acceptance-checkpoint.json',sha256=sha(H/'acceptance-checkpoint.json'),cases=12,positives=2,clockLedger='Exact capture start and terminal elapsed reads in unchanged production source prove once-only accounting on nine additional cases; first three completed cases retained without rerun, spent lower bound and zero input verified'),wireCheck=dict(path='wire-check.json',sha256=sha(H/'wire-check.json')),reused=reused,sourceReview=dict(path='independent-source-review.diff',sha256=sha(H/'independent-source-review.diff'),finding='Capture starts before request/read/durable frame write; capture exceptions debit once, review finally debits same start; decision durability included before slot/cumulative guards; no future-slot reset. Failed I/O preserves uncertainty and owner cleanup.'),limits=dict(physicalPython=128*1048576,physicalGit=256*1048576,gitChildData=512*1048576,cpu=90,wall=120,file=24*1048576,output=2*1048576,display=8192,cumulativeOutput=1048576,actualPythonChildLimits={str(k):resource.getrlimit(k) for k in [resource.RLIMIT_CPU,resource.RLIMIT_FSIZE,resource.RLIMIT_DATA,resource.RLIMIT_AS]},supervisorSHA256='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'),configuration='configuration.json; no filename-bearing mount argv / no Node / no guest authorized',scope='Offline real child/listener/HTTP synthetic640x480 only; independent acceptance supports scoped integration, does not claim gameplay or public deployment. Evidence orphan NEVER wholemerge.',incidents=['Initial combined display reads exceeded8192B, original launcher events/session retained and accounted. Subsequent diagnostic excerpts capped.','Independent third-case upper tolerance .8s rejected actual2.869734 vs injected2s due real I/O elapsed. Preserved failure streams; no candidate defect. First three behavioral outcomes reused. Nine remaining cases use exact production clock ledger instead of elapsed tolerance.'],rootReceipt='/home/user/wine-assembly/scratch/usage-watch/enigma-full-frame-independent-accept-oct27/root-ref-digest.json',publication='Pending exact task branch; final canonical ops receipt will bind commit and verified remote ref.',cleanup='All behavior supervisors remainingOwnedLive empty; each operation supervisor cleanupComplete. Board watcher to close at final.',boxes=dict(assigned=None,state='none accessed',expiry=None,owner='Coordinator retains all lifecycle authority'))
(H/'acceptance-report.json').write_text(json.dumps(receipt,indent=2)+'\n')
P=R/'docs/reviews/enigma-full-frame-independent-accept-oct27';P.mkdir(parents=True,exist_ok=True)
for p in H.rglob('*'):
 if not p.is_file() or 'immutable-donor-object-view' in p.parts:continue
 rel=p.relative_to(H);dest=P/rel
 if rel.name.endswith(('.png','.py','.json','.jsonl','.diff')):
  dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
 else:
  dest=dest.with_name(dest.name+'.base64');dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(base64.b64encode(p.read_bytes()).decode()+'\n')
entries={str(p.relative_to(P)):sha(p) for p in P.rglob('*') if p.is_file()}
(P/'archive-manifest.json').write_text(json.dumps(dict(candidate=C,files=entries,encoding='Non-source/non-JSON raw diagnostics base64, byteexact decode; prior failures preserved'),indent=2)+'\n')
print('ACCEPT offline full-frame accounting: exact candidate four Git blob pins; twelve independent cases; unchanged groups reused; complete causal evidence archived',len(entries),'files')
