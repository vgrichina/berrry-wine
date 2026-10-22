import base64,hashlib,json,os,pathlib,subprocess,zlib
R=pathlib.Path('/home/user/shadow-man-dsetup-canonical-qualification-oct22');E=R/'evidence-census-fullmodule'
os.chdir(R)
def snippets(file,term,before,after):
 lines=(R/file).read_text().splitlines();return [dict(line=i+1,context='\n'.join(lines[max(0,i-before):i+after])) for i,s in enumerate(lines) if term in s]
details=dict(firstFailedCommand=['node','tools/check-region-decls.js','--check-owners'],declaration=snippets('src/00-regions.wat','$DX_VERSION_INFO',3,9),handler=snippets('src/09a1-comctl-handlers.wat','(func $handle_GetFileVersionInfoA',2,55),gate=snippets('tools/check-region-decls.js','no longer references',15,8),build=snippets('tools/build.sh','--check-owners',6,3))
(E/'blocker-details.json').write_text(json.dumps(details,indent=2)+'\n')
commands=subprocess.check_output(['ps','-eo','pid,ppid,comm,args'],text=True).splitlines()
processes=[s for s in commands if any(x in s for x in ['node tools/','bash tools/build.sh','node test/']) and 'python3 -c' not in s]
(E/'handback-processes.json').write_text(json.dumps({'matchingBuildTestProcesses':processes},indent=2)+'\n')
facts=dict(box='bx_f3gs8qm2',state='RUNNING; API exec responding',expiry='2026-10-22T23:20:32.491Z',lifecycleOwner='coordinator',retainedRoot=str(R),retainedEvidence=str(E),originalEvidence=str(R/'evidence'),bytesAllocated=int(subprocess.check_output(['du','-s','-B1',str(R)]).split()[0]),freeBytes=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize,cap=1073741824,reserve=67108864,buildAttempts=1,priorAssignmentAttempts=1,buildExit=1,moduleIdentity=None,fullModuleTests=0,nativeCalls=0,gameLaunches=0,matchingProcesses=processes)
assert not processes and not list((R/'build').glob('*.wasm'))
(E/'handback.json').write_text(json.dumps(facts,indent=2)+'\n')
files={str(p.relative_to(E)):base64.b64encode(p.read_bytes()).decode() for p in E.rglob('*') if p.is_file()}
print(base64.b64encode(zlib.compress(json.dumps(files).encode())).decode())
