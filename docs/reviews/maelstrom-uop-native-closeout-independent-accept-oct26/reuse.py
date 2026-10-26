from common import *
import re,gzip
admit('admission-reuse.json',True)
oracle=json.loads((O/'oracle-review.json').read_text());assert oracle['status']=='PASS' and oracle['candidate']==SHA
fixture=(R/'test/maelstrom-diagnostic-canonical-native.cjs').read_text();old=(E/'retained-fixture.cjs').read_text()
helperSHA=oracle['helperSHA256'];fixtureSHA=sha(fixture.encode());assert fixtureSHA==oracle['fixtureSHA256']
values={'HEAD':0x7a3362,'ret':0x7a3362+0x40};expect=oracle['scalarAssertions']
def accepts(d):return all(d.get(k)==v for k,v in expect.items())
s=(O/'review.py').read_text();exec(compile(s[s.index("cp=json.loads"):],str(O/'review.py'),'exec'))
