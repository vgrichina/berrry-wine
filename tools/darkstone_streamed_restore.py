"""FINAL1910 consumer adapter for an explicitly owned, fresh runtime.

Uses the existing transport's access.api and remote capabilities. Does not
allocate, launch, replay UNKNOWN operations, or mutate predecessor runs.
Only a returned pair receipt authorizes subsequent provisioning acceptance.
"""
import json
from pathlib import Path, PurePosixPath
from streamed_gzip_upload import upload_gzip, validate

FINAL = {
    'characters.lpl': (1342316, '4762ae9c0d7d048595433d121629a87d5a1aa24e7c3ebe84c7605006e3c10baa'),
    'game641d_6af0ca48.sav': (3204341, '5e898dc9d6f7a13350c939bf5b712eccfff95ef1072c93023103705999f84ffc'),
}
RECOVERY = 'scratch/runs/20261108-darkstone-bat-continuation-1910/new-save-recovery.json'


def canonical_pair(root):
    recovery = Path(root) / RECOVERY
    files = json.loads(recovery.read_text())['continuationFiles']
    if len(files) != 2:
        raise ValueError('exact FINAL1910 pair required')
    result = {}
    for entry in files:
        name = entry['path'].split('\\')[-1]
        if name not in FINAL or name in result or not entry['gzip']:
            raise ValueError('wrong/duplicate continuation source')
        pin = dict(size=entry['size'], sha256=entry['sha256'])
        if (pin['size'], pin['sha256']) != FINAL[name]:
            raise ValueError('superseded save refused')
        source = recovery.parent / entry['localArtifact']
        if not source.resolve().is_relative_to(recovery.parent.resolve()):
            raise ValueError('source escapes canonical recovery')
        compressed = {key: entry['transport'][key] for key in ('size', 'sha256')}
        validate(source, pin, compressed)
        result[name] = (source, pin, compressed)
    return result


def restore_pair(root, transport, destination):
    """Fresh unique destination only; caller must quarantine on ANY exception.

    Never call against an old run or repeat after UNKNOWN. The transport root
    and run identify the caller-owned runtime. No local checkpoint is created.
    """
    expected = transport.ROOT + '/' + transport.RUN + '/checkpoint'
    if destination != expected or '..' in PurePosixPath(destination).parts:
        raise ValueError('owned runtime checkpoint path required')
    pair = canonical_pair(root)  # Both sources fully validated before first PUT.
    receipts = {}
    for name, (source, pin, compressed) in pair.items():
        path = destination + '/' + name

        def url():
            return transport.access.api('POST', 'sandboxes/' + transport.box_id() +
                '/files/upload-url', {'path': path, 'ttlSeconds': 900})['url']

        def remote_hash():
            code = ('import hashlib,json\np=' + repr(path) + '\n'
                    'h=hashlib.sha256();n=0\nwith open(p,"rb") as f:\n'
                    ' while b:=f.read(65536):h.update(b);n+=len(b)\n'
                    'print(json.dumps(dict(size=n,sha256=h.hexdigest())))')
            return json.loads(transport.remote('streamed-restore-' + name, code)['stdout'])

        receipts[name] = upload_gzip(source, pin, compressed, url, remote_hash)
    return dict(accepted=True, files=receipts, localDecompressedStageBytes=0,
                avoidedLocalCopyBytes=sum(x[0] for x in FINAL.values()), reloaded=False)
