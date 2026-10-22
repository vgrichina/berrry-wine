import pathlib,subprocess,json
E=pathlib.Path(__file__).resolve().parent; W=E.parents[2]
commands=[['node','tools/check-wat-manifest.js'],['node','tools/check-wat-fragments.js'],['node','tools/aw-census.js','--check'],['node','tools/wat-dup-census.js','--check'],['node','tools/region-census.js','--gate'],['node','tools/gen-region-map.js','--check'],['node','tools/check-data-strings.js'],['node','tools/check-api-table.js'],['node','tools/check-handler-esp.js'],['node','--check','lib/host-imports.js'],['node','--check','test/test-oleaut32-ordinals.js'],['git','diff','--check']]
rows=[]
for cmd in commands:
 p=subprocess.run(cmd,cwd=W,capture_output=True,text=True);rows.append(dict(command=cmd,exit=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0,rows[-1]
(E/'source-gates.json').write_text(json.dumps(rows,indent=2)+'\n');print('PASS',len(rows),'focused gates/checks; not the complete canonical build gates')
