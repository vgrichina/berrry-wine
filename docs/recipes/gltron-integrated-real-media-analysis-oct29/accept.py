from supervisor import *
test=REPO/'test/gltron-integrated-real-media-analysis-oct29.py'
archive=ROOT/'payload/gltron-0.70-win32.exe'
def mark(generation):
 admission('set owned prior pair '+generation)
 for name in ('inventory.json','closure.json'):(ROOT/'payload'/name).write_text(json.dumps({'generation':generation}))
mark('before-api')
print(run(['/usr/bin/python3','-B',str(test),'api'],cwd=ROOT).decode().strip())
save('checkpoint-api.json',dict(PASS=True,candidate=D['main'],sourceSHA256=D['source']['sha256'],receipt='api-result.json',remaining=['CLI','failure-control']))
mark('before-cli')
print(run(['/usr/bin/python3','-B',str(REPO/D['sourceRepoPath']),'analyze',str(archive)],cwd=ROOT).decode().strip())
print(run(['/usr/bin/python3','-B',str(test),'check-cli'],cwd=ROOT).decode().strip())
save('checkpoint-cli.json',dict(PASS=True,candidate=D['main'],receipt='cli-result.json',remaining=['failure-control']))
print(run(['/usr/bin/python3','-B',str(test),'failure-control'],cwd=ROOT).decode().strip())
save('checkpoint-complete.json',dict(PASS=True,candidate=D['main'],receipts=['api-result.json','cli-result.json','failure-control.json'],remaining=['publication']))
