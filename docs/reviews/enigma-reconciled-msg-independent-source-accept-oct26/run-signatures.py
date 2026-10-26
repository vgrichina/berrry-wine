from common import *
D=pathlib.Path('/tmp/enigma-accepted-msg-current-tree-reconcile-oct26/repo')
script='const fs=require("fs");const {WAT_FILES}=require('+json.dumps(str(D/'lib/wat-manifest.js'))+');fs.writeFileSync('+json.dumps(str(O/'canonical-manifest.json'))+',JSON.stringify(WAT_FILES.map(x=>"src/"+x)));console.log("PASS canonical production manifest");'
print(pool([NODE,'--max-old-space-size=64','-e',script],label='canonical-manifest').decode())
print(pool(['python3',str(O/'signature-oracle.py')],label='independent-signatures').decode())
