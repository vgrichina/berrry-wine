"""TR2-only single-download capture delivery; review remains an explicit next call.

The caller displays the returned PNG in the same tool invocation. Nothing here
reviews an image or changes capture age, admission, input or failure policy.
"""
import base64
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time


SUFFIXES = ('.png', '-capture.json', '-state.json', '-binding.json')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def remote_source(out, command):
    """One command ACK followed by one immutable, hashed evidence packet."""
    js = r"""const fs=require('fs'),crypto=require('crypto'),t=require('./transport.cjs');
const out=process.argv[1],c=JSON.parse(process.argv[2]),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 let ack=null;
 if(c){
  if(c.review){t.publish(out+'/'+c.review.label+'-review.json',c.review);delete c.review;}
  ack=await t.request(out,c.id,c,50000);
  if(!ack.ok||ack.status)throw Error('first refusal terminal');
 }
 if(c?.action==='quit'){console.log(JSON.stringify({ack,packet:null}));return;}
 const latest=JSON.parse(fs.readFileSync(out+'/latest.json'));
 if(!/^[a-z0-9-]+$/.test(latest.label))throw Error('unsafe capture label');
 const files=['.png','-capture.json','-state.json','-binding.json'].map(s=>{
  const name=latest.label+s,b=fs.readFileSync(out+'/'+name);
  return {name,size:b.length,sha256:sha(b),data:b.toString('base64')};
 });
 const b=Buffer.from(JSON.stringify({label:latest.label,files})),p=out+'/'+latest.label+'-review-packet.json';
 fs.writeFileSync(p,b,{flag:'wx'});
 console.log(JSON.stringify({ack,packet:{path:p,size:b.length,sha256:sha(b)}}));
})().catch(e=>{console.error(e);process.exitCode=1;});"""
    args = ['node', '-e', js, str(out), json.dumps(command)]
    return ('import subprocess\np=subprocess.run('+repr(args)+',cwd='+repr(str(Path(out).parent))+
            ',capture_output=True,text=True,timeout=55)\nprint(p.stdout)\nprint(p.stderr)\nraise SystemExit(p.returncode)')


def unpack(packet, destination, pin):
    """Verify every member before publishing any; never replace evidence."""
    assert len(packet) == pin['size'] and digest(packet) == pin['sha256'], 'packet hash/size'
    value = json.loads(packet)
    label = value['label']
    assert re.fullmatch('[a-z0-9-]+', label), 'capture label'
    assert [p['name'] for p in value['files']] == [label+s for s in SUFFIXES], 'exact members'
    members = {}
    for p in value['files']:
        b = base64.b64decode(p['data'], validate=True)
        assert len(b) == p['size'] and digest(b) == p['sha256'], 'member hash/size'
        members[p['name']] = b
    capture = json.loads(members[label+'-capture.json'])
    assert capture['label'] == label and capture['sha256'] == digest(members[label+'.png']), 'capture binding'
    assert capture['at'] and capture['completedAt'] and capture['identity'], 'original capture required'
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    assert all(not (destination/n).exists() for n in members), 'immutable evidence'
    for n, b in members.items():
        (destination/n).write_bytes(b)
    # Full decode/CRC precedes display. This is integrity validation, not review.
    subprocess.run(['node', '-e', "require('pngjs').PNG.sync.read(require('fs').readFileSync(process.argv[1]),{checkCRC:true});",
                    str(destination/(label+'.png'))], check=True, capture_output=True)
    return capture


def drive(run, transport, command, review=None):
    """Exactly one remote command and one file download. No retry/freshening."""
    run = Path(run)
    local = run/'review/webgl'
    started = time.time()
    label = command['id'] if command else 'startup'
    try:
        if command and command['action'] not in ('capture', 'observe', 'quit'):
            assert isinstance(review, str) and review.strip(), 'individual model review required'
            capture = json.loads((local/(command['reviewRef']+'-capture.json')).read_bytes())
            assert digest((local/(command['reviewRef']+'.png')).read_bytes()) == capture['sha256']
            # Preserve all original fields, including at. Review has no new capture clock.
            command = {**command, 'review': {**capture, 'review': review}}
        out = transport.ROOT+'/'+transport.RUN+'/webgl'
        result = json.loads(transport.remote('drive-'+label, remote_source(out, command), 65)['stdout'])
        remote_done = time.time()
        if result['packet']:
            pin = result['packet']
            packet_path = run/(label+'-delivery.json')
            transport.download(pin['path'], packet_path, pin)
            capture = unpack(packet_path.read_bytes(), local, pin)
            result['image'] = str(local/(capture['label']+'.png'))
            result['captureAt'] = capture['at']
        result['timing'] = dict(started=started, remoteDone=remote_done, verified=time.time())
        (run/('drive-'+label+'-receipt.json')).write_text(json.dumps(result))
        return result
    except BaseException:
        subprocess.run(['python3', str(run/'cancel.py'), 'first command/delivery failure '+label], check=True, timeout=40)
        raise


if __name__ == '__main__':
    import importlib.util
    import sys
    run = Path(sys.argv[1]).resolve()
    sys.path.insert(0, str(run))
    spec = importlib.util.spec_from_file_location('tr2_owned_remote', run/'remote.py')
    adapter = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(adapter)
    command = None if sys.argv[2] == 'startup' else json.loads(sys.argv[2])
    print(json.dumps(drive(run, adapter.t, command, sys.argv[3] if len(sys.argv)>3 else None)))
