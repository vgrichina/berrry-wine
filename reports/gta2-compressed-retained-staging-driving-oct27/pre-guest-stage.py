# Reflect latest canonical preflight helper; no runtime code changes.
put(str(O/'preflight-v2.js'),(O/'preflight.js').read_bytes(),'preflight-v2')
py('import pathlib;p=pathlib.Path('+repr(str(O/'preflight-v2.js'))+');q=p.with_name("preflight.js");q.write_bytes(p.read_bytes());print("preflight updated")')
print('latest preflight staged')
