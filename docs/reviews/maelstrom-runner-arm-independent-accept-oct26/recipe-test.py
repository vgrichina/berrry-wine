from common import *
gate('pretests')
startup='const fs=require("fs");console.log(JSON.stringify({execPath:process.execPath,execArgv:process.execArgv,version:process.version,limits:fs.readFileSync("/proc/self/limits","utf8"),rss:process.memoryUsage().rss,env:{NODE_OPTIONS:process.env.NODE_OPTIONS??null,NODE_PATH:process.env.NODE_PATH??null}}));'
save('node-startup-exact.json',json.loads(run([NODE,'--max-old-space-size=192','-e',startup])))
for name in ['global-order-reproducer','independent-challenges']:
 if (O/(name+'-result.json')).exists():
  print(name+' reused unchanged PASS');continue
 gate(name)
 argv=[NODE,'--max-old-space-size=192',str(E/(name+'.cjs'))]
 save(name+'-command.json',dict(argv=argv,cpu=90,wall=120,file=25165824,output=2097152))
 result=json.loads(run(argv,cwd=R));save(name+'-result.json',result)
 assert result.get('peakRSS',0)<=335544320
 save('checkpoint.json',dict(candidate=REV,completed=name,resultSHA256=sha((O/(name+'-result.json')).read_bytes()),fixtureSHA256=sha((E/(name+'.cjs')).read_bytes()),remaining=['publish focused evidence','global pre-guest repair','independent repair review','separately authorized native runtime']))
 print(name+' PASS')
