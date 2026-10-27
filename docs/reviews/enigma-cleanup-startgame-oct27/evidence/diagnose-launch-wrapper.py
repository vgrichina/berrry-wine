gate('diagnose-launch-wrapper')
j=json.loads((O/'launch-api.json').read_text());names=[j['logPath'],j['errLogPath'],str(O/'launch.py'),str(O/'startup-environment.json')]
code='import pathlib,json;names='+repr(names)+';print(json.dumps({n:pathlib.Path(n).read_text()[:3500] if pathlib.Path(n).exists() else None for n in names}))'
v=json.loads(py(code)['stdout']);save('launch-wrapper-diagnostic.json',v);print(json.dumps(v))
