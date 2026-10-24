import pathlib,json,shutil
H=pathlib.Path(__file__).parent
O=pathlib.Path('/tmp/maelstrom-original-bounded-runtime-oct24')
for name in ['work.py','stage.py','capture.cjs','preflight.py','supervise.py']:
 s=(O/name).read_text().replace('maelstrom-original-bounded-runtime-oct24','maelstrom-tree-mounted-runtime-oct24').replace('bx_hn58wqw7','bx_7y65jhum').replace('1792825560','1792826940').replace('latest start07:06UTC','latest start07:29UTC').replace('shutdown07:10UTC','shutdown07:35UTC').replace('2026-10-24T07:19:28.062Z','2026-10-24T07:42:18.192Z')
 (H/name).write_text(s)
m=json.loads((O/'manifest.json').read_text())
for x in m:
 if x['target'].startswith('game/'):x['target']='vfs/maelstrom/'+x['target'][5:]
(H/'manifest.json').write_text(json.dumps(m,indent=2))
a=json.loads((O/'recovery-args.json').read_text());a=[x.replace(str(O),str(H)) for x in a]
(H/'guest-args.json').write_text(json.dumps(a,indent=2))
for n in ['static-abi.json','identities.json','watchdog-negative-control-api.json']:
 shutil.copyfile(O/n,H/('prior-'+n))
