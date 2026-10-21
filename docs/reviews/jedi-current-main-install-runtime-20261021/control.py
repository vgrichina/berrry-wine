import sys,json
from remote import run
name=sys.argv[1];cmd=json.loads(sys.argv[2]);folder=sys.argv[3] if len(sys.argv)>3 else 'install1'
code='''const fs=require('fs');const out='/home/user/jedi-evidence/'+FOLDER;
(async()=>{const call=async cmd=>{const r=await fetch('http://127.0.0.1:8139/ctl',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(cmd)});const v=await r.json();if(!v.ok)throw Error(JSON.stringify(v));return v};
const before=new Date().toISOString();const action=await call(COMMAND);await new Promise(r=>setTimeout(r,300));const snap=await call({action:'snapshot'});const png=await call({action:'png',path:out+'/'+NAME+'.png'});fs.writeFileSync(out+'/'+NAME+'.json',JSON.stringify({at:before,command:COMMAND,action,snap,png},null,2));console.log(JSON.stringify({action,snap,png}));})();'''.replace('FOLDER',json.dumps(folder)).replace('COMMAND',json.dumps(cmd)).replace('NAME',json.dumps(name))
run(['node','-e',code],folder+'-'+name)
