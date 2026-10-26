from control import *
branch='task/blocker-count-private-dashboard-activation-oct26'
R=P/'repo';R.mkdir(exist_ok=True)
resources('pre-checkout',0)
watch=subprocess.Popen(['tail','-f','/home/user/wine-assembly/messageboard.txt'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
save('board-watcher.json',{'pid':watch.pid,'argv':['tail','-f','/home/user/wine-assembly/messageboard.txt'],'output':'discarded; no private board copied'})
run(['git','init','-b',branch,str(R)],True)
run(['git','config','user.name','Codex'],True,R)
run(['git','config','user.email','codex@users.noreply.github.com'],True,R)
if not run(['git','remote'],True,R):run(['git','remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],True,R)
(R/'.git/objects/info/alternates').write_text((P/'flat-alternates.txt').read_text() if (P/'flat-alternates.txt').exists() else str(D/'.git/objects')+'\n')
base='938ea5bb01a25c51a9d70db756be3873fefe68f7'
assert run(['git','cat-file','-t',base],True,R)=='commit'
run(['git','config','core.sparseCheckout','true'],True,R)
run(['git','config','core.sparseCheckoutCone','false'],True,R)
relative='docs/reviews/blocker-count-private-dashboard-activation-oct26'
(R/'.git/info/sparse-checkout').write_text('/'+relative+'/\n')
run(['git','update-ref','refs/heads/'+branch,base],True,R)
run(['git','read-tree','-mu',base],True,R)
out=R/relative;out.mkdir(parents=True)
# Keep aggregate evidence only. Private task snapshots never reached the filesystem.
files=['startup.json','pinned-inputs.json','compatibility.json','activation.json','service-before.json','service-after-activation.json','service-after-browser.json','browser-startup.json','browser-result.json','browser-monitor.json','counts-focused-redacted.png']
for n in files:shutil.copy2(P/n,out/n)
for f in P.glob('resources-*.json'):
 x=json.loads(f.read_text())
 for c in x['clients']:c['flags']=[s for s in c['flags'] if len(s)<256 and (s.startswith('model_') or s=='gpt-6.1-sol')]
 (out/f.name).write_text(json.dumps(x,indent=2)+'\n')
warnings=[]
for f in P.glob('command-*.json'):
 x=json.loads(f.read_text())
 if x.get('stderr'):warnings.append({'argv':x['argv'],'stderr':x['stderr'],'exitCode':x['returncode']})
(out/'git-warnings.json').write_text(json.dumps(warnings,indent=2)+'\n')
shutil.copy2('/home/user/wine-assembly/scratch/usage-watch/blocker-count-private-dashboard-activation-oct26/root-ref-digest.json',out/'root-ref-digest.json')
for n in ['control.py','activate.py','browser.cjs','run-browser.py','rollback.py','flatten-alternates.py','publish.py']:
 shutil.copy2(P/n,out/n)
notes={'incidents':['python alias absent; used installed python3, no install','early combined exploratory command exceeded excerpt budget; output truncated by tool; subsequent excerpts bounded','Git nested-alternates diagnostic preserved in git-warnings.json; no full ref listing captured','browser provisional RSS estimate512MiB was lower than measured aggregate Node+browser peak1228795904B; pre-run available3825856512B and after-run physical admission using actual peak passed; no hard memory cap was changed'],'browserMemoryInterpretation':'aggregate RSS includes shared pages across browser processes and Node; old-space192MiB is heap only, not total RSS limit','runtimeSnapshot':'1357 other runtime files hashed before and verified after activation; private runtime filename inventory kept only in owned temporary evidence','remainingGate':'Accepted Blockers summary activation/browser gate complete. Sidebar remains raw91 rows and overview raw count by accepted source; any wider count-label change needs a separate coordinator assignment. No source changes in this task.','lifecycle':{'boxId':None,'state':'unassigned','expiry':None,'owner':'coordinator'}}
notes['incidents'].extend(['Shared root object store lacked the pinned commit; isolated repo switched to exact donor stores. Nested donor alternates then prevented full tree lookup; bounded read-only leaf-first traversal of367 existing stores recovered lookup in isolated repo only. No object/ref listing copied, original warnings retained.','Alternate traversal wrapper initially used a whole-file8192 cap and256-store guard; changed to8192-byte line reads and2048-store bounded traversal (actual367). No user/enforced resource limits changed.','One unexecuted patch anchor mismatch corrected within task.'])
recovery=json.loads((P/'alternate-recovery.json').read_text());recovery.pop('paths',None)
(out/'alternate-recovery.json').write_text(json.dumps(recovery,indent=2)+'\n')
(out/'notes.json').write_text(json.dumps(notes,indent=2)+'\n')
browser=json.loads((P/'browser-result.json').read_text())
activation=json.loads((P/'activation.json').read_text())
receipt={'decision':'ACTIVATED_AND_REAL_BROWSER_VERIFIED','acceptedCommit':base,'deployed':{n:sha(L/n) for n in ['app.js','blocker-model.js','readers.js']},'privateURL':'http://127.0.0.1:8098/#blockers','http':activation['served'],'browser':browser,'serviceSamples':{n:json.loads((P/f'service-{n}.json').read_text()) for n in ['before','after-activation','after-browser']},'rssQualification':'three observations only; no long-term memory stability inference','rollback':str(P/'rollback.py'),'backups':str(P/'backups'),'serviceRestarted':False,'privateTaskContentsPublished':False,'profileDeleted':not (P/'browser-profile').exists(),'screenshotReviewed':True,'taskBranch':branch,'publication':'exact commit and remote verification recorded in sibling final-receipt.json after commit to avoid self-referential commit hash','evidenceDirectory':relative,'acceptanceReused':notes['remainingGate'],'remainingGate':notes['remainingGate'],'resources':json.loads((P/'resources-after-browser.json').read_text()),'box':notes['lifecycle']}
for c in receipt['resources']['clients']:c['flags']=[s for s in c['flags'] if len(s)<256 and (s.startswith('model_') or s=='gpt-6.1-sol')]
(out/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
manifest={f.name:{'bytes':f.stat().st_size,'sha256':sha(f)} for f in out.iterdir() if f.is_file()}
(out/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(out/'README.md').write_text('''# Private Blockers summary activation, 2026-10-26

Activated only the exact accepted app.js and blocker-model.js on the existing loopback dashboard. Static HTTP bytes match accepted source, all 1357 other runtime files remain unchanged, and the existing service PID remained 2896015. No restart or public deployment occurred.

One real Chromium render used one size-bounded 7,072,688-byte response from the current private API. It displayed **77 distinct blocked task IDs**, **91 blocked rows**, **14 duplicate-ID blocked rows**, and **0 anonymous blocked rows**. Independent counting of the same in-memory snapshot matched the rendered label. The row classification line explicitly says dependent rows / filtered row classifications. The screenshot was inspected: it contains aggregate labels only, with all task contents excluded by crop. No task snapshot or fixture was written or published. The owned browser profile was removed after closing Chromium.

The accepted app still shows raw 91 in its sidebar, and its overview stat uses raw rows. The distinct-count summary gate passes; this does not establish a distinct count in every dashboard surface. Changing those surfaces is outside this task's exact two-file activation scope.

`receipt.json` records identities, browser observations, service PID/RSS samples and rollback path. `evidence-manifest.json` hashes all evidence payloads except this index and the manifest itself. The three RSS observations do not establish long-term stability. Browser aggregate Node+Chrome peak RSS was 1,228,795,904 bytes; this exceeded the provisional estimate but physical admission against the actual measured demand passed. `notes.json` preserves incidents and qualifications; `git-warnings.json` retains the nested-alternates warning. Prior accepted implementation/independent/merged/Telegram acceptance groups were reused without repetition.

Rollback is available locally at `/tmp/blocker-count-private-dashboard-activation-oct26/rollback.py`, with lossless prior-byte backups in its `backups` sibling. Root owns any future service or wider source action. No test box was assigned; lifecycle remains coordinator-owned.
''')
run(['git','add','--',relative],True,R)
run(['git','diff','--cached','--check'],True,R)
stat=run(['git','diff','--cached','--stat'],True,R);print(stat)
run(['git','commit','-m','Record private blocker summary activation and real browser verification'],True,R)
commit=run(['git','rev-parse','HEAD'],True,R)
run(['git','push','origin',f'HEAD:refs/heads/{branch}'],True,R)
remote=run(['git','ls-remote','--exit-code','origin',f'refs/heads/{branch}'],True,R)
assert remote.split()[0]==commit
assert run(['git','status','--porcelain'],True,R)==''
for n,v in manifest.items():assert sha(out/n)==v['sha256']
receipt.update({'commit':commit,'remoteBranch':'refs/heads/'+branch,'exactRemoteVerified':True,'remoteObservation':remote,'evidenceManifestSha256':sha(out/'evidence-manifest.json'),'resourcesFinal':resources('published',0)})
save('final-receipt.json',receipt)
watch.terminate();watch.wait(timeout=5)
print(json.dumps({'commit':commit,'remote':remote,'receipt':str(P/'final-receipt.json'),'evidence':str(out),'ownedBytes':ownedbytes()}))
