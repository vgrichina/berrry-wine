PIN='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba'
DONOR=pathlib.Path('/tmp/generally-census-accepted-main-integration-oct27/repo/.git/objects')
assert DONOR.is_dir()
assert pathlib.Path('/home/user/.ssh/wine_github_ed25519').is_file()
assert pathlib.Path('/home/user/.ssh/wine_github_known_hosts').is_file()
save('ssh-check.json',dict(command=SSH,identityExists=True,knownHostsSHA256=sha(pathlib.Path('/home/user/.ssh/wine_github_known_hosts').read_bytes())))
git('init',['init',str(H/'repo')])
G=H/'repo/.git'
(G/'objects/info/alternates').write_text(str(DONOR)+'\n')
git('sparse-config',['-C',str(H/'repo'),'config','core.sparseCheckout','true'])
(G/'info/sparse-checkout').write_text('/reports/gta2-census-cleared-driving-oct27/\n')
git('checkout',['-C',str(H/'repo'),'checkout','-b','task/gta2-census-cleared-driving-oct27',PIN])
origin=pathlib.Path('/home/user/wine-assembly/.git/config').read_text()
import configparser
c=configparser.ConfigParser();c.read_string(origin);url=c['remote "origin"']['url']
git('remote',['-C',str(H/'repo'),'remote','add','origin',url])
receipt=json.loads((ROOT/'scratch/usage-watch/census-cleared-games-readiness-oct27/gta2.json').read_text())
save('source-readiness.json',receipt)
save('setup.json',dict(pin=PIN,donor=str(DONOR),sourceBytes=receipt['sourceBytes'],gameBytes=receipt['gameBytes'],sourceCount=len(receipt['source']),rootRefReceipt=str(ROOT/'scratch/usage-watch/gta2-census-cleared-driving-oct27/root-ref-digest.json')))
