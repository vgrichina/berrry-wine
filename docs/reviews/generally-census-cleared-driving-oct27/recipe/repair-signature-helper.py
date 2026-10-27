from common import *
p=H/'remote-startup-v4.cjs';t=p.read_text().replace("const sig=JSON.parse(fs.readFileSync(root+'/lib/host-import-sigs.generated.json'));", "const signatureDocument=JSON.parse(fs.readFileSync(root+'/lib/host-import-sigs.generated.json'));const sig=signatureDocument.sigs;assert(sig&&signatureDocument.count===Object.keys(sig).length);")
assert t!=p.read_text();(H/'remote-startup-v5.cjs').write_text(t)
p=H/'remote-v6.py';t=p.read_text().replace("str(H/'remote-startup-v4.cjs')","str(H/'remote-startup-v5.cjs')").replace("'startup-preguest'","'startup-preguest-v5'")
(H/'remote-v7.py').write_text(t)
save('signature-helper-repair.json',dict(reason='generated JSON has metadata plus sigs map; helper previously addressed top-level document as map',originalHelper=sha((H/'remote-startup-v4.cjs').read_bytes()),correctedHelper=sha((H/'remote-startup-v5.cjs').read_bytes()),moduleRebuilt=False,canonicalBuildPass='retained-compile-continuation-two-supervision.json',sourceChanged=False))
print('signature document schema corrected; compiled module preserved unchanged')
