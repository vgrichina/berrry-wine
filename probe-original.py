import importlib.util, pathlib, json, hashlib
p=pathlib.Path('tools/recovery/tuxracer-original-win32-recovery-oct28.py')
s=importlib.util.spec_from_file_location('production',p); m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
d=json.loads(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/tuxracer-real-media-tcl-syntax-gap-oct29-dispatch.json').read_text())
name='tuxracer-win32-0.61a/tuxracer_init.tcl'
f=pathlib.Path(d['extracted'])/name
t=f.read_text(); commands=list(m.lexical_commands(t))
assert commands[0][1] is not None and commands[0][1].startswith('set tux_data_dir [pwd]')
assert not any(w and w[0]=='source' for w,u in commands)
r={'productionSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'originalPath':str(f),'originalSHA256':hashlib.sha256(f.read_bytes()).hexdigest(),'earliestBoundaryLine':6,'missedLiteralLine':24,'missedLiteral':'courses/course_idx.tcl','reproduced':True}
pathlib.Path('evidence/original-reproducer.json').write_text(json.dumps(r,indent=2))
print(json.dumps(r))
