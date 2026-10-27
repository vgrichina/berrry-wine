argv=['/home/user/.ascii/boat','info','--no-update','--json',BOX]
with (O/'box-info.stdout').open('xb') as out,(O/'box-info.stderr').open('xb') as err:
 p=subprocess.Popen(argv,stdout=out,stderr=err);save('box-info-start.json',dict(pid=p.pid,argv=argv,at=time.time()));result=p.wait(timeout=15)
save('box-info-exit.json',dict(exit=result,at=time.time()));assert result==0;j=json.loads((O/'box-info.stdout').read_text());save('box-info.json',j);print(json.dumps(j)[:2200])
