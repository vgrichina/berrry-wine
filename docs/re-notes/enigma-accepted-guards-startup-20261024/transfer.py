from work import *
# Original bounded streaming recipe: no second full local materialization.
s=(Q/'stage.py').read_text();(H/'stage.py').write_text(s)
ns={'__name__':'stage','__file__':str(H/'stage.py')};exec(compile(s,str(H/'stage.py'),'exec'),ns)
for name in ['capture.cjs','supervise.py','preflight.py','validate-tree.cjs','guest-args.json','next-env.json']:
 ns['send']((H/name).read_bytes(),name)
for name in ['tools/enigma-findfirst-compat.cjs','tools/enigma-terminal-capture-guard.cjs','tools/enigma-quiet-filesystem.cjs','lib/filesystem.js']:
 ns['send']((H/'repo'/name).read_bytes(),'accepted/'+name)
save('preflight-api.json',remote('python3 '+shlex.quote(R+'/preflight.py'),65))
save('tree-validation-api.json',remote('node --max-old-space-size=256 '+shlex.quote(R+'/validate-tree.cjs'),60))
measure('ready');print('READY full closure, real dependency/pixel preflight, actual mount enumeration',flush=True)
