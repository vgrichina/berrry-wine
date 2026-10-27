PIN='1e4fdb06f64e5f14ddec582111dfe7ecb71df6ba';DONOR='/tmp/generally-census-accepted-main-integration-oct27/repo/.git/objects'
assert pathlib.Path(DONOR).is_dir();assert pathlib.Path('/home/user/.ssh/wine_github_ed25519').is_file()
save('ssh-check.json',dict(command=SSH,knownHostsSHA256=sha(pathlib.Path('/home/user/.ssh/wine_github_known_hosts').read_bytes())))
git('init',['init',str(H/'repo')]);G=H/'repo/.git';(G/'objects/info/alternates').write_text(DONOR+'\n');git('sparse-config',['-C',str(H/'repo'),'config','core.sparseCheckout','true']);(G/'info/sparse-checkout').write_text('/reports/'+H.name+'/\n');git('checkout',['-C',str(H/'repo'),'checkout','-b','task/'+H.name,PIN]);git('remote',['-C',str(H/'repo'),'remote','add','origin','git@github.com:vgrichina/wine-assembly.git'])
for field,value in [('name','Wine Ops Worker'),('email','wine-ops@local')]:git('identity-'+field,['-C',str(H/'repo'),'config','user.'+field,value])
save('source-readiness.json',json.loads((ROOT/'scratch/usage-watch/census-cleared-games-readiness-oct27/gta2.json').read_text()))
print('sparse setup pinned',PIN)
