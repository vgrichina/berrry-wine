import pathlib,subprocess,resource,json
H=pathlib.Path('/tmp/gl-detached-rss-independent-acceptance-oct26');R=H/'repo'
def lim():resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
def g(*a):return subprocess.check_output(['/usr/bin/git','-C',str(R),*a],preexec_fn=lim).decode()
(R/'.git/objects/info/alternates').write_text('/tmp/gl-detached-peak-rss-repair-oct26/repo/.git/objects\n/home/user/wine-assembly/.git/objects\n/tmp/gl-palette-current-webgl-qualification-oct26/source/.git/objects\n/tmp/renderer-side-polling-main-retained-closeout-oct26/repo/.git/objects\n/tmp/app-files-merged-main-publication-oct26/repo/.git/objects\n/tmp/browser-key-reentrant-main-publication-oct26/repo/.git/objects\n/tmp/vfs-read-abort-main-publication-oct26/repo/.git/objects\n')
m='754c97d3ff22ce0a0cd06d08ac06dc0446fbcbb2';c='dc9b0e8ee2c56f029a56fbb6dd42422ed29dd557'
print('MAIN',g('rev-parse',m+'^{commit}'))
print(g('diff','--stat',m,c,'--','test','lib'))
pins=json.loads((H/'ops/inputs.json').read_text())
for f in pins['sourcePins']:
 p=f['path'].split('/repo/')[1]
 print('FILE',p);print(g('diff',m,c,'--',p))
print('MAIN TEST HELPERS',g('ls-tree',m,'test/helpers/'))
