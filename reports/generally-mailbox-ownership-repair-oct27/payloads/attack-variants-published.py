from pathlib import Path
import hashlib,json,subprocess,sys
R=Path('/tmp/generally-mailbox-ownership-repair-oct27');O=R/'ops'
original=(Path('/tmp/generally-bounded-loading-dispatch-repair-oct27/repo/tools/generally-loading-controller.py')).read_text()
source=(R/'repo/tools/generally-loading-controller.py').read_text()
oracle=(R/'repo/test/independent-generally-bounded-acceptance.py').read_text()
oldclass=original[original.index('class Mailbox:'):original.index('\n\nclass Stdio:')]
oldclass+='\n    def begin(self, cursor): pass\n    def accepted(self, cursor): pass\n    def finish(self, cursor): pass\n    def poison(self): pass\n    def close(self): pass\n'
mutant=source[:source.index('class Mailbox:')]+oldclass+source[source.index('\n\nclass Stdio:'):]
results=[]
for name,text,expected in [('repaired',source,0),('guard-omitted',mutant,1)]:
 v=O/('attack-published-'+name);(v/'tools').mkdir(parents=True);(v/'test').mkdir()
 helper=v/'tools/generally-loading-controller.py';helper.write_text(text)
 pin=hashlib.sha256(helper.read_bytes()).hexdigest()
 driver=v/'test/independent-generally-bounded-acceptance.py'
 driver.write_text(oracle.replace("PIN = 'bfc3a764ddba00a59fe7681a771edde320a36afd1f5434f9567c38424131c9fb'",f"PIN = '{pin}'"))
 with (v/'stdout').open('wb') as out,(v/'stderr').open('wb') as err:
  c=subprocess.run([sys.executable,'-B',str(driver),'--evidence',str(v/'evidence')],stdout=out,stderr=err,timeout=10)
 assert c.returncode==expected,(name,c.returncode,(v/'stderr').read_text())
 result=json.loads((v/'evidence/result.json').read_text());assert result['cleanupComplete']
 if expected: assert 'mailbox ownership violated' in result['error']
 results.append(dict(variant=name,helperSHA256=pin,exit=c.returncode,expected=expected,result=result,oracleChange='helper SHA identity pin only',driverSHA256=hashlib.sha256(driver.read_bytes()).hexdigest()))
(O/'attack-variants-published.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
