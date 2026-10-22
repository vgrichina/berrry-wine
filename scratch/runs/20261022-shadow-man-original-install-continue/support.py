"""Task-specific original seals/support recovery and full transport admission."""
import hashlib,json,pathlib,subprocess,shutil
R=pathlib.Path('/home/user/shadow-man-install-continue-oct22')
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
expected=json.loads((R/'original-expected-seals.json').read_text())
actualOriginal=rows(R/'recovery/source/Demos/Shadowman')
assert actualOriginal==expected
save('original-seals.json',actualOriginal)
p=subprocess.run(['unshield','l',str(R/'recovery/source/Demos/Shadowman/data1.cab')],capture_output=True,text=True,timeout=30)
save('native-listing.json',dict(command=p.args,exitCode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0
p=R/'recovery/GS1199.iso';assert p.stat().st_size==674328576 and sha(p)=='db9ca33413c53d2d333a3d4b2e220d19daab625526d8acf55c1f11e780b28a12'
print(json.dumps(dict(original=actualOriginal,support=actual,nativeListing=p.as_posix(),isoSha256=sha(p))))
