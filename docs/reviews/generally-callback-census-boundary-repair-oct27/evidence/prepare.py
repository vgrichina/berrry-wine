import pathlib,json,hashlib
B=pathlib.Path('/tmp/generally-callback-census-boundary-repair-oct27');R=B/'repo';O=B/'ops'
D=pathlib.Path('/tmp/generally-ordinary-driving-gameplay-oct27/repo')
origins=[D/'.git/objects']+[pathlib.Path(p) for p in (D/'.git/objects/info/alternates').read_text().splitlines()]
alts=[]
for i,origin in enumerate(origins):
 proxy=O/'readonly-object-proxies'/str(i);proxy.mkdir(parents=True,exist_ok=True)
 for p in origin.iterdir():
  if p.name=='pack' or (len(p.name)==2 and all(c in '0123456789abcdef' for c in p.name)):
   (proxy/p.name).symlink_to(p.resolve(),target_is_directory=True)
 alts.append(str(proxy))
(R/'.git/objects/info/alternates').write_text('\n'.join(alts)+'\n')
(R/'.git/config').write_text('[core]\n repositoryformatversion = 0\n bare = false\n sparseCheckout = true\n sparseCheckoutCone = false\n[remote "origin"]\n url = git@github.com:vgrichina/wine-assembly.git\n[user]\n name = Wine Ops\n email = wine-ops@localhost\n')
(R/'.git/info/sparse-checkout').write_text('/tools/callback-ownership-census.js\n')
(O/'configuration.json').write_text(json.dumps(dict(donors=[str(p) for p in origins],source='4a2bec145ef34b0d084b96b09a682a16e89703fd',report='4f10044135e6f6c66ae61a76c51bbb68978e540c',mountArgv=[],mountValidation='No runtime or guest mount operation in this source-only assignment; prior unchanged tree mount receipt retained by canonical source report.',priorMountReceipt='/tmp/generally-ordinary-driving-gameplay-oct27/ops/mount-parser-check.json',priorMountSHA256=hashlib.sha256(pathlib.Path('/tmp/generally-ordinary-driving-gameplay-oct27/ops/mount-parser-check.json').read_bytes()).hexdigest()),indent=2))
print('sparse configuration and read-only immutable-object proxies ready',len(alts))
