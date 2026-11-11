"""Serialized KKnD operator: personal review plus current-frame ground cursor proof.

The transport's settled callback must collect the complete raw stage PNG/JSON
under <root>/retrieved/output-fixed/ before returning. Both plain and .xz files
are supported. No cursor claim or proof supplied by a caller is trusted.
"""
import fcntl
import hashlib
import json
import lzma
import os
from pathlib import Path
import subprocess
import time


def require(condition, message):
    # Safety checks must remain active under python -O.
    if not condition:
        raise ValueError(message)


def read_frame(root, stage):
    def read(suffix):
        p = Path(root) / 'retrieved' / 'output-fixed' / f'stage-{stage}.{suffix}'
        return p.read_bytes() if p.exists() else lzma.decompress(Path(str(p) + '.xz').read_bytes())
    return read('png'), read('json')


def ground_cursor(review, index, frame_reader):
    require(review['stage'] == index - 1, 'review is stale')
    frame, raw_state = frame_reader(review['stage'])
    state = json.loads(raw_state)
    require(state == review['state'], 'wrong current frame state')
    capture = state['capture']
    require(capture == review['capture'], 'wrong reviewed capture')
    require(len(frame) == capture['size'] and hashlib.sha256(frame).hexdigest() == capture['sha256'],
            'wrong current frame bytes')
    require(capture['path'] == f"stage-{review['stage']}.png", 'wrong frame stage')
    require(not state['done'] and not state['exited'] and not state['faults'], 'unusable current frame')
    x, y = review['x'], review['y']
    mouse, command = state['mouse'], state['lastCommand']
    require(mouse['x'] == x and mouse['y'] == y and mouse['buttons'] == 0,
            'cursor not at reviewed neutral target')
    require(command['index'] == review['stage'] and command['kind'] == 'mouse' and
            command['x'] == x and command['y'] == y and command['buttons'] == 0,
            'frame is not the current settled hover')
    result = subprocess.run(['node', str(Path(__file__).with_name('kknd_cursor_pixels.cjs')), str(x), str(y)],
                            input=frame, capture_output=True, timeout=10, check=False)
    require(result.returncode == 0, 'ground cursor refused: ' + result.stderr.decode(errors='replace').strip())
    proof = json.loads(result.stdout)
    require(proof['frameSha256'] == capture['sha256'], 'cursor proof frame mismatch')
    return proof


class Operator:
    def __init__(self, root, publish, settled, frame_reader=None):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.publish, self.settled = publish, settled
        self.frame_reader = frame_reader or (lambda stage: read_frame(self.root.parent, stage))
        self.index, self.pending, self.reviewed = 1, None, None

    def send(self, commands):
        require(self.pending is None, 'unreviewed hover pending')
        ids = list(range(self.index, self.index + len(commands)))
        self.publish(dict(zip(ids, commands)))
        self.index += len(commands)
        return self.settled(ids[-1])

    def hover(self, x, y, dispatches=10_000_000, seconds=3):
        state = self.send([dict(kind='mouse', x=x, y=y, buttons=0, dispatches=dispatches, seconds=seconds)])
        self.pending = dict(stage=self.index - 1, x=x, y=y, capture=state['capture'], state=state)
        return state

    def review(self, classification, note):
        require(self.pending is not None and bool(note), 'personal review note required')
        require(classification in ['valid-ground', 'visible-target', 'menu', 'selection', 'prohibited', 'water', 'fog'],
                'unknown classification')
        value = dict(at=time.time(), personallyReviewed=True, classification=classification, note=note, **self.pending)
        with (self.root / f"review-{value['stage']}.json").open('x') as f:
            json.dump(value, f, indent=2)
        self.pending, self.reviewed = None, value
        return value

    def pair(self, dispatches=60_000_000, seconds=12, end=None):
        require(self.pending is None, 'cannot press unreviewed hover')
        v = self.reviewed
        require(v is not None and v.get('personallyReviewed') is True and bool(v.get('note')), 'personal review required')
        require(v['classification'] in ['valid-ground', 'visible-target', 'menu', 'selection'], 'refuse prohibited/water/fog press')
        require(v['stage'] == self.index - 1, 'review is stale')
        require(end is None or v['classification'] == 'selection', 'only selection may drag')
        # Immediately before constructing commands or calling the transport.
        # Recompute from raw collected bytes, including after durable reload.
        if v['classification'] == 'valid-ground':
            ground_cursor(v, self.index, self.frame_reader)
        x, y = v['x'], v['y']
        ex, ey = end or (x, y)
        gesture = [dict(kind='mouse', x=x, y=y, buttons=1, dispatches=10_000_000, seconds=3)]
        if end is not None:
            gesture.append(dict(kind='mouse', x=ex, y=ey, buttons=1, dispatches=10_000_000, seconds=3))
        gesture.append(dict(kind='mouse', x=ex, y=ey, buttons=0, dispatches=dispatches, seconds=seconds))
        return self.send(gesture)

    def run(self, dispatches=60_000_000, seconds=12):
        return self.send([dict(kind='run', dispatches=dispatches, seconds=seconds)])

    def stop(self):
        self.pending = None
        self.publish({self.index: dict(kind='stop')})
        self.index += 1


def atomic_publish(root, commands):
    root = Path(root)
    for i, command in commands.items():
        p = root / f'fixed-command-{i}.json'
        tmp = p.with_suffix('.json.tmp')
        require(not p.exists() and not tmp.exists(), 'command already exists')
        with tmp.open('x') as f:
            json.dump(command, f)
            f.flush()
            os.fsync(f.fileno())
        tmp.rename(p)


def perform(action, args, root, publish_fn, settled_fn, frame_reader=None):
    """Keep the original nonblocking lock across dispatch, actual wait and state commit.

    publish_fn/settled_fn retain responsibility for durable caller waits, EOF
    collection and capture retrieval. A refusal never invokes either callback.
    """
    root = Path(root)
    with (root / 'operator.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print(json.dumps(dict(refused=True, reason='active operator request', predispatch=True, indexAdvanced=False)), flush=True)
            return 75
        op = Operator(root / 'reviews', publish_fn, settled_fn, frame_reader)
        p = root / 'operator-state.json'
        if p.exists():
            value = json.loads(p.read_text())
            op.index, op.pending, op.reviewed = value['index'], value.get('pending'), value.get('reviewed')
        state = settled_fn(0) if action == 'initial' else getattr(op, action)(**args)
        tmp = p.with_suffix('.json.tmp')
        with tmp.open('w') as f:
            json.dump(dict(index=op.index, pending=op.pending, reviewed=op.reviewed), f, indent=2)
            f.flush()
            os.fsync(f.fileno())
        tmp.replace(p)
        print(json.dumps(dict(next=op.index, pending=bool(op.pending), action=action,
                             capture=state.get('capture') if isinstance(state, dict) else None)), flush=True)
    return 0
