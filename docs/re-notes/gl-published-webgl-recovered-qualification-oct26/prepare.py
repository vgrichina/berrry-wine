from work import *
assert json.loads((O/'admission.json').read_text())['pass']
R.mkdir();git('init','-q');git('config','remote.origin.url','git@github.com:vgrichina/wine-assembly.git');git('config','remote.origin.promisor','true');git('config','remote.origin.partialclonefilter','blob:none')
(R/'.git/objects/info/alternates').write_text(str(D/'.git/objects')+'\n')
head=A['candidate'];assert git('show','-s','--format=%H %T',head).decode().strip()==head+' ef4fa7219aadb4241e9eb20c0d969bbb1cf139ce'
git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false')
paths=list(A['acceptedProductionPins'])+['test/helpers/palette-gpu-browser.js','test/helpers/palette-gpu-wat.js']
(R/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in paths))
git('checkout','-b','task/'+H.name,head)
for p,h in A['acceptedProductionPins'].items():assert sha(R/p)==h,p
for p in paths[-2:]:assert (R/p).read_bytes()==(S/p).read_bytes(),p
assert not git('diff','--stat').strip()
save('fixture-overlay.json',dict(head=head,tree='ef4fa7219aadb4241e9eb20c0d969bbb1cf139ce',files={p:sha(R/p) for p in paths},unchanged=True,sourceRoot=str(S),fixtureRoot=str(R),sourceSubsetIdentity=json.loads((S.parent/'ops/snapshot-identity.json').read_text()),moduleExpectedSHA256=A['moduleExpectedSHA256']))
print('PASS exact published sparse fixture7 files; pinned149source closure reused; no fixture compilation yet')
