from run import *
f=R/'test/fixtures/airstrike-independent-accept-oct27.cjs';s=f.read_text()
s=s.replace("   const line='[ctl] '","   if(cmd.action==='snapshot'&&inputCount===16&&mode.startsWith('full-'))setTimeout(()=>{console.log(mode==='full-timeout'?'[max-seconds] fixture timeout':'[Exit] code=0');process.exit(0);},15);\n   const line='[ctl] '")
f.write_text(s)
# retain original protocol-test results and startup/extraction identities in checkpoint
p=json.loads((H/'pins.json').read_text())
dump('checkpoint.json',dict(candidate=p['candidate'],runnerSHA256=p['runnerSHA256'],completed={'first-boundary':'pass','independent-adversarial':10,'independent-normal-corrected':'pass'},failure='independent normal assertion expected snapshot subset; actual includes tickMs16 recordingfalse; corrected to full exact object; all original outputs preserved',remaining=['external approval/menu contract','16-action capture and cleanup reservation','terminal false positives','publication']))
