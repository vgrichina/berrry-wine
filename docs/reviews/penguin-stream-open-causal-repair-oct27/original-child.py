import os,sys,pathlib
stage=sys.argv[1]
streams={'startup': (b'\x00\xffS', b'\xfeERR\n'), 'guest': (b'G\x00\xfcOUT\n', b'\xfbguest-ERR\n')}
pathlib.Path(sys.argv[2],stage+".started").write_bytes(b"started")
a,b=streams[stage];os.write(1,a);os.write(2,b)
sys.exit(0 if stage=="startup" else 0)
