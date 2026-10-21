import hashlib,io,json,tarfile,pathlib
p=pathlib.Path(__file__).resolve().parent
archive=p/'evidence.tar.gz'
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(archive.read_bytes())=='22121970add638c66203d278b55ee734f668abf36a389cdec2c9c901298d673c'
with tarfile.open(archive) as tf:
    files={m.name:tf.extractfile(m).read() for m in tf.getmembers() if m.isfile()}
    seals=json.loads(files['SHA256SUMS.json'])
    for x in seals:
        b=files[x['path']];assert len(b)==x['bytes'] and sha(b)==x['sha256'],x['path']
    pre=json.loads(files['preflight.json']);post=json.loads(files['postflight.json'])
    assert pre['source']=='72e7a30d6e36df896eb25007b6139d750e715720'
    assert pre['moduleSha256']==sha(files['provenance/wine-assembly.wasm'])=='728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c'
    prior={x['path']:x for x in json.loads(files['prior-seals.json'])}
    for name in ['build.log','build.exit','build-source-manifest.json','wine-assembly.wasm']:
        path='provenance/'+name;assert sha(files[path])==prior[path]['sha256']
    assert files['provenance/build.exit'].strip()==b'0'
    old={x['path']:x for x in json.loads(files['provenance/build-source-manifest.json'])['files']}
    new={x['path']:x for x in json.loads(files['source-manifest.json'])['files']}
    delta=[p for p in sorted(set(old)|set(new)) if old.get(p,{}).get('sha256')!=new.get(p,{}).get('sha256')]
    assert delta==pre['changedPaths']
    assert all(p.startswith(('docs/','scratch/')) or p in ['TODOS.md','ops/STATUS.md','tools/army-bltfast-observer.js','tools/army-bltfast-preload.test.js'] for p in delta)
    assert len(new)==7451 and len(pre['closure'])==168 and post['unchanged'] and post['gitStatus']==''
    assert post['guestGroupsAbsent'] and post['moduleSha256']==pre['moduleSha256']
    inputs=0
    for run in ['run1','run2']:
        terminal=json.loads(files[run+'/terminal.json']);assert terminal['code']==0 and terminal['reason'] is None and terminal['groupAbsent']
        launch=json.loads(files[run+'/launch.json']);args=launch['args']
        assert '--app=madbomber' in args and '--max-seconds=60' in args
        assert not any(a.startswith(('--exe=','--input=')) for a in args)
        receipts=[json.loads(x) for x in files[run+'/input-receipts.jsonl'].splitlines()]
        log=files[run+'/output.log'].decode()
        for rec in receipts:
            assert rec['writable']
            cmd=rec['command']
            if 'cmd' in cmd:
                action,*values=cmd['cmd'].split(':');assert action in ['keydown','keyup','mousemove']
                expected=f'[input] {action} vk={values[0]}' if action in ['keydown','keyup'] else f'[input] mousemove {values[0]},{values[1]}'
                assert expected in log,expected;inputs+=1
            else:
                assert cmd['action']=='png'
                assert files[run+'/'+pathlib.Path(cmd['path']).name].startswith(b'\x89PNG\r\n\x1a\n')
    print(json.dumps({'pass':True,'seals':len(seals),'sourceFiles':len(new),'assetPins':168,'acknowledgedInputs':inputs,'runs':2,'visualVerdict':'manual review required; see report'}))
