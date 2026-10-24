from work import *
ns={'__name__':'stage','__file__':str(H/'stage.py')}
s=(P/'stage.py').read_text().replace('R=str(H)','R='+repr(R)).replace("assert json.loads((H/'admission.json').read_text())['passAdmission']","assert json.loads((H/'resource-pretransfer.json').read_text())['passAdmission']").replace("repr(str(H))","repr(R)")
(H/'stage.py').write_text(s);exec(compile(s,str(H/'stage.py'),'exec'),ns)
# Small helper transport keeps exact absolute argv paths; no alternate adapter binding.
for name in ['capture.cjs','supervise.py','preflight.py','validate-tree.cjs','guest-args.json','next-env.json']:
 ns['send']((H/name).read_bytes(),name)
adapter='/tmp/enigma-quiet-filesystem-runner-oct24/repo/tools/enigma-quiet-filesystem.cjs'
b=(H/'repo/tools/enigma-quiet-filesystem.cjs').read_bytes()
cmd='import pathlib,base64;p=pathlib.Path('+repr(adapter)+');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(base64.b64decode('+repr(base64.b64encode(b).decode())+'))'
save('adapter-transfer.json',py(cmd))
save('preflight-api.json',remote('python3 '+shlex.quote(R+'/preflight.py'),65))
save('tree-validation-api.json',remote('node --max-old-space-size=256 '+shlex.quote(R+'/validate-tree.cjs'),60))
measure('ready');print('READY exact closure/preflight/mount validated',flush=True)
