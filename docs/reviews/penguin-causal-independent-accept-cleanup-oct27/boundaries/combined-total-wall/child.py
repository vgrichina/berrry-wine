import pathlib,sys,time,os
d=pathlib.Path(sys.argv[2]);stage=sys.argv[1];(d/(stage+'.started')).write_text('started');os.write(2,(stage+'-wall\n').encode());time.sleep(.65)
