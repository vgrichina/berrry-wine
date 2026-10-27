from git_owned import *
D=pathlib.Path('/tmp/penguin-visible-projectile-gameplay-oct27/repo')
git(['init','--quiet'])
alts=[str(D/'.git/objects'),*(D/'.git/objects/info/alternates').read_text().splitlines()]
(R/'.git/objects/info/alternates').write_text('\n'.join(dict.fromkeys(alts))+'\n')
git(['config','gc.auto','0']);git(['config','core.sparseCheckout','true'])
(R/'.git/info/sparse-checkout').write_text('/tools/penguin_capture_contract.py\n/test/test_penguin_capture_contract.py\n/docs/re-notes/penguin-capture-harness-contract-repair-20261027.md\n/docs/re-notes/penguin-capture-harness-contract-repair-20261027/\n')
git(['checkout','-b','task/penguin-capture-harness-contract-repair-oct27','d9cabfa58c3c54c9e66b7315c02ec4826fcfaa15'])
import configparser
c=configparser.ConfigParser();c.read(D/'.git/config')
git(['remote','add','origin',c['remote "origin"']['url']])
print('sparse branch ready')
