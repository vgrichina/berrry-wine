gate('diagnose-runtime')
code='import pathlib,json;h=pathlib.Path('+repr(str(O))+');names=["supervisor-stderr.log","supervisor-stdout.log","cli-exit.json","launch/node-startup.json","launch/supervisor-outcome.json","launch/controller/phase.json","launch/controller/outcome.json"];print(json.dumps({n:(h/n).read_text()[:1800] if (h/n).exists() else None for n in names}))'
v=json.loads(py(code)['stdout']);save('runtime-diagnostic.json',v);print(json.dumps(v))
