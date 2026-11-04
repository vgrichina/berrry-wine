"""Sequential ordinary commands; waits for each final reply, never retries."""
import sys, json, shlex
from pathlib import Path
from runtime_io import E, ROOT, remote, upload, download

REMOTE = ROOT + '/scratch/runs/20261104-stronghold-direct-crusader-start/browser'
cursor = E / 'operator-cursor.json'
index = json.loads(cursor.read_text())['next'] if cursor.exists() else 0
action = sys.argv[1]
repeat = 1
if action == 'step':
    count = int(sys.argv[2]); assert 1 <= count <= 64
    repeat = int(sys.argv[3]) if len(sys.argv) > 3 else 1
    assert 1 <= repeat <= 32
    command = dict(action=action, n=count)
elif action in ('shot', 'state'): command = dict(action=action, name=sys.argv[2])
elif action in ('keydown', 'keyup'): command = dict(action=action, key=sys.argv[2], reviewRef=sys.argv[3])
elif action == 'gesture': command = dict(action=action,x=float(sys.argv[2]),y=float(sys.argv[3]),button=sys.argv[4] if len(sys.argv)>4 else 'left')
elif action == 'tick': command = dict(action=action, ms=int(sys.argv[2]))
elif action in ('mousedown','mouseup'): command = dict(action=action, button=sys.argv[2], reviewRef=sys.argv[3])
elif action == 'mousemove': command = dict(action=action, x=float(sys.argv[2]), y=float(sys.argv[3]), reviewRef=sys.argv[4])
elif action == 'click': command = dict(action=action, x=float(sys.argv[2]), y=float(sys.argv[3]), reviewRef=sys.argv[4])
elif action == 'snapshot': command = dict(action=action, name=sys.argv[2])
elif action in ('install-native','native-start'): command = dict(action=action)
elif action == 'quit': command = dict(action=action)
else: raise ValueError('unknown action')

for _ in range(repeat):
    assert not (E / ('operator-reply-' + str(index) + '.json')).exists()
    upload(json.dumps(command).encode(), REMOTE + '/commands/' + str(index) + '.json')
    cursor.write_text(json.dumps(dict(next=index+1, pending=index))+'\n')
    program = "import pathlib,time; p=pathlib.Path(" + repr(REMOTE + '/reply-' + str(index) + '.json') + "); deadline=time.monotonic()+75\nwhile not p.exists() and time.monotonic()<deadline: time.sleep(.2)\nassert p.exists(),'missing final command reply; no retry'\nprint(p.read_text())"
    result = remote('python3 -c ' + shlex.quote(program), timeout=85)
    reply = json.loads(result['stdout'])
    (E / ('operator-reply-' + str(index) + '.json')).write_text(json.dumps(dict(command=command, reply=reply),indent=2)+'\n')
    assert reply['i'] == index and reply['ok'], reply
    if action in ('shot','state'):
        download(REMOTE+'/'+command['name']+'.json', E/'review'/ (command['name']+'.json'))
        if action == 'shot': download(REMOTE+'/'+command['name']+'.png', E/'review'/(command['name']+'.png'))
    print(json.dumps(dict(index=index,command=command,reply=reply)),flush=True)
    index += 1
    cursor.write_text(json.dumps(dict(next=index,pending=None))+'\n')
