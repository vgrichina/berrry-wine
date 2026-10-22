"""Task-specific original seals/support recovery and full transport admission."""
import hashlib,json,pathlib,subprocess,shutil
R=pathlib.Path('/home/user/shadow-man-tools-ready-oct22')
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def rows(root):return [dict(path=p.relative_to(root).as_posix(),size=p.stat().st_size,sha256=sha(p)) for p in sorted(root.rglob('*')) if p.is_file()]
def save(n,x):(R/n).write_text(json.dumps(x,indent=2)+'\n')
before=rows(R/'recovery/source')
assert sum(x['size'] for x in before if x['path'].startswith('Demos/Shadowman/'))==73339636
spec=json.loads((R/'support-expected.json').read_text())
current=sum(p.stat().st_size for p in R.rglob('*') if p.is_file()); expansion=sum(x['size'] for x in spec)
assert current+expansion+268435456<2147483648
assert shutil.disk_usage(R).free-expansion-268435456>=2982150144
save('support-prewrite.json',dict(currentBytes=current,expansionBytes=expansion,phaseCap=2147483648,freeBytes=shutil.disk_usage(R).free))
for cabinet in ['sys1','user1']:
 cmd=['unshield','-d',str(R/'support'/cabinet),'x',str(R/'recovery/source/Demos/Shadowman'/('_'+cabinet+'.cab'))]
 p=subprocess.run(cmd,capture_output=True,text=True,timeout=30)
 save('support-'+cabinet+'-command.json',dict(command=cmd,exitCode=p.returncode,stdout=p.stdout,stderr=p.stderr))
 assert p.returncode==0,p.stderr
actual=rows(R/'support');assert actual==spec
save('support-manifest.json',actual)
assert rows(R/'recovery/source')==before
expected=json.loads((R/'original-expected.json').read_text())['extractedMembers']
actualOriginal=rows(R/'recovery/source/Demos/Shadowman')
assert {x['path']:(x['size'],x['sha256']) for x in actualOriginal}=={x['name']:(x['bytes'],x['sha256']) for x in expected}
save('original-seals.json',actualOriginal)
src=(R/'runtime/test/run.js').read_text()
assert 'const written = saveVfsToHost(vfs, inDir);' in src
assert "`--save-vfs=${outDir}`" in src and "'--spawned-child', '--spawn-processes'" in src
assert "fs.rmSync(tmp, { recursive: true, force: true });" in src
sourceBytes=sum(x['size'] for x in actualOriginal)
inventory=dict(recovery=rows(R/'recovery'),runtime=rows(R/'runtime'),codec=rows(R/'runner'),support=actual,taskFiles=[dict(path=p.name,size=p.stat().st_size) for p in R.iterdir() if p.is_file()])
save('remote-inventory.json',inventory)
usable=256*1024**2-16*1024**2
admission=dict(verdict='BLOCKED_FULL_VFS_DESCENDANT_BOUND',admitted=False,guestAttempts=0,
 capBytes=256*1024**2,reserveBytes=16*1024**2,usableBytes=usable,sourceFiles=23,sourceBytes=sourceBytes,
 baselineOneForkInputOutputSourceOnly=2*sourceBytes,
 childAndGrandchildInputOutputSourceOnly=4*sourceBytes,
 excessOverUsableBeforeRuntimeSupportRegistryLogsImagesGrowth=4*sourceBytes-usable,
 originalSourceHostBytes=sourceBytes,runtimeHostBytes=sum(x['size'] for x in inventory['runtime']),
 codecHostBytes=sum(x['size'] for x in inventory['codec']),supportHostBytes=sum(x['size'] for x in actual),
 phaseActualBytes=sum(p.stat().st_size for p in R.rglob('*') if p.is_file()),phaseCapBytes=2147483648,
 freeBytes=shutil.disk_usage(R).free,sourcePreserved=True,
 childrenGrandchildren={'observed':0,'upperBound':None,'reason':'Unchanged normal transport recursively inherits --spawn-processes with no fork-count/depth or pre-export byte admission guard. Full input is synchronously written before fork; full output is written before exit/merge cleanup.'},
 components={'fullSourceInputOutput':'73339636 bytes per source copy before font/DLL/generated guest files',
 'registry':'Input and output per fork; no task-proven upper bound',
 'logsImages':'Observer has per-process quotas, but no process-count or canvas-size bound',
 'transients':'Ancestor input snapshots persist until each corresponding process exits; descendant output/merge overlaps are possible',
 'lazyMedia':'No lazy projection or source omission authorized',
 'guestHeap':'Not counted as disk transport; no claim about guest memory'},
 reason='Cannot prove the required aggregate full VFS transport bound for all descendants. Two normal transport generations require allowance for four full source copies: 293358544 bytes alone, exceeding usable 251658240 and total 268435456. This is a rejected possible envelope, not an observed guest fork or prediction of its actual path. The 60-second watchdog and after-write polling do not prevent synchronous full snapshot expansion.',
 run=False)
assert admission['phaseActualBytes']<2147483648 and admission['freeBytes']>2982150144
assert admission['childAndGrandchildInputOutputSourceOnly']>admission['capBytes']
save('admission.json',admission)
print(json.dumps(admission,indent=2))
