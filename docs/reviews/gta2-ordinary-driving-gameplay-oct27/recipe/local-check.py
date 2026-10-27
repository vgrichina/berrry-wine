from run import *
import ast
files=[]
for p in H.glob('*.py'):ast.parse(p.read_bytes(),filename=str(p));files.append(dict(path=str(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
assert hashlib.sha256(S.read_bytes()).hexdigest()=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
assert S.read_text().count('lower_limit(resource.RLIMIT_CPU, 90)')==1
for i,s in enumerate(json.loads((H/'donor-views.json').read_text())['original']):
 for p in (H/'readonly-donor-views'/str(i)).iterdir():assert p.resolve()==(pathlib.Path(s)/p.name).resolve()
dump('local-wrapper-validation.json',dict(status='PASS_SYNTAX_AND_EXACT_IMMUTABLE_ALTERNATE_TARGETS',files=files,trustedSupervisorSHA256=hashlib.sha256(S.read_bytes()).hexdigest(),remoteCPUChange='one requested CPU-constant substitution only; local trusted supervisor unchanged',localResourceConfiguration='128MiB physical CPU90 wall120 FSIZE24MiB output2MiB; no DATA/AS on Python/Node'))
print('PASS',len(files),'Python source files and immutable alternate resolution')
