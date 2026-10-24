from work import *
def main():
 c=json.load(open(H/'control-args.json'));t=json.load(open(H/'treatment-args.json'))
 assert [x for x in c if not x.startswith('--input=')]==[x for x in t if not x.startswith('--input=')]
 required=['--no-build','--quiet-api','--quiet-blocks','--no-close','--memory-mb=512','--tick-ms-per-batch=200','--screen=840x660','--trace-input-dispatch','--max-batches=43000','--max-seconds=60']
 assert all(x in c and x in t for x in required)
 def norm(name):
  return [x.replace(R+'/'+name+'/', 'OUTPUT/') for x in json.load(open(H/(name+'-inputs.json')))]
 ci=norm('control');ti=norm('treatment');assert [x for x in ti if x not in ci]==['40000:keydown:65','40200:keyup:65'];assert [x for x in ti if x in ci]==ci
 seals=json.load(open(H/'remote-files.json'))['files'];pngs=[x for x in seals if x['path'].endswith('.png')];assert len(pngs)==12
 hashes={x['path']:x['sha256'] for x in pngs}
 assert hashes['control/b39999.png']==hashes['treatment/b39999.png']=='95112041c84196db00873e676117ac51d58562a21cabe06f5498d1f4b0504972'
 for b in [40020,40100,40201]:assert hashes['control/b'+str(b)+'.png']==hashes['treatment/b'+str(b)+'.png']
 for row in seals:
  p=E/row['path']
  if p.exists():assert p.stat().st_size==row['bytes'] and sha(p.read_bytes())==row['sha256'],str(p)
 for name in ['control','treatment']:
  term=json.load(open(E/name/'terminal.json'));assert term['returncode']==0 and not term['remainingGroup'] and not term['guestExitClaim'];assert term['elapsed']<90
  cmd=json.load(open(E/name/'command.json'));assert cmd['memAvailable']>=2684354560;assert cmd['argv']==json.load(open(H/(name+'-args.json')))
 log=(E/'treatment/output.log').read_text()
 for msg,batch in [('0x100',40032),('0x101',40282)]:
  rows=[x for x in log.splitlines() if '[dispatch-input]' in x and 'msg='+msg+' ' in x and 'wParam=0x41 ' in x];assert len(rows)==1 and 'batch='+str(batch)+' ' in rows[0]
 assert len([x for x in H.glob('*-launch-api.json')])==2
 save('verification.json',dict(passAll=True,guestRuns=2,sameNonInputArgv=True,onlyInputDifference=['40000:keydown:65','40200:keyup:65'],baseline='non-menu full cannon/ammo personally inspected before treatment',actualDispatchBatches=[40032,40282],remoteImagesHashed=12,collectedImages=sum((E/x['path']).exists() for x in pngs),firingCausality='ambiguous; stop without third run'))
 print('PASS matched recipes, source/image seals, actual A dispatch, two-run bound, terminal cleanup and fresh per-run memory')
if __name__=='__main__':main()
