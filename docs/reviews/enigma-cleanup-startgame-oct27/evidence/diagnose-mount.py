gate('diagnose-mount')
code='import pathlib,json;h=pathlib.Path('+repr(str(O))+');names=["mount-check.json","mount-parser.stdout","mount-parser.stderr","mount-preflight-api.stdout","mount-preflight-api.stderr"];print(json.dumps({n:(h/n).read_text()[:4500] if (h/n).exists() else None for n in names}))'
v=json.loads(py(code)['stdout']);save('mount-failed-setup.json',v);print(json.dumps(v))
