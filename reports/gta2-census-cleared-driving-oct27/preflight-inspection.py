receipt=json.loads((O/'source-readiness.json').read_text())
save('setup.json',dict(pin=receipt['revision'],sourceBytes=receipt['sourceBytes'],gameBytes=receipt['gameBytes'],sourceCount=len(receipt['sourceFiles']),ssh=SSH))
print(json.dumps(dict(sourceCount=len(receipt['sourceFiles']),largest=sorted(receipt['sourceFiles'],key=lambda r:r['bytes'])[-5:])))
print(json.dumps(py('import os,pathlib,json,resource,shutil; n=pathlib.Path("/home/user/.nvm/versions/node/v24.22.1/bin/node");print(json.dumps(dict(cwd=os.getcwd(),nodeExists=n.is_file(),disk=shutil.disk_usage("/tmp").free,limits=pathlib.Path("/proc/self/limits").read_text())))')))
