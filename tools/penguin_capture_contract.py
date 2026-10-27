#!/usr/bin/env python3
"""Offline-qualified Penguin launch and lossless response contract (stdlib only).

This is a recipe, not permission to run a guest. Provider framing and actual
Node startup/mount acceptance must be qualified separately before remote use.
"""
import argparse
import base64
import copy
import ctypes
import hashlib
import json
import os
from pathlib import Path
import resource
import signal
import subprocess
import time
import zlib

API_BYTES = 1 << 20
TEXT_BYTES = 2 << 20
PNG_BYTES = 4 << 20
SELECTED_BYTES = 8 << 20
REMOTE_BYTES = 16 << 20
ALLOW_ENV = frozenset({'PATH', 'LANG', 'LC_ALL', 'TZ', 'TMPDIR',
                       'WINE_ASSEMBLY_WASM', 'WINE_REGION_MAP'})
LIMIT_NAMES = ('DATA', 'AS', 'RSS', 'CPU', 'FSIZE')


class ContractError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ContractError(message)


def wire(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'),
                      ensure_ascii=True, allow_nan=False).encode('ascii')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def limits_now():
    return {n: list(resource.getrlimit(getattr(resource, 'RLIMIT_' + n)))
            for n in LIMIT_NAMES}


def exact_keys(obj, keys):
    require(type(obj) is dict and set(obj) == set(keys), 'unknown/missing configuration fields')


def validate_profile(p):
    exact_keys(p, ('executable', 'executable_sha256', 'flags', 'startup', 'guest',
                   'cwd', 'env', 'limits', 'resources', 'artifacts', 'capture_dir'))
    for key in ('flags', 'startup', 'guest'):
        require(type(p[key]) is list and all(type(x) is str and '\0' not in x
                                            for x in p[key]), 'invalid argv')
    require(p['startup'] and p['guest'], 'both commands required')
    require(Path(p['executable']).is_absolute() and Path(p['cwd']).is_absolute(),
            'absolute executable/cwd required')
    env = p['env']
    require(type(env) is dict and set(env) <= ALLOW_ENV, 'ambient/secret environment forbidden')
    require(env.get('LC_ALL') == 'C.UTF-8' and env.get('TZ') == 'UTC', 'explicit locale/timezone required')
    require(all(type(v) is str and '\0' not in v for v in env.values()), 'invalid environment')
    exact_keys(p['limits'], LIMIT_NAMES)
    for n, pair in p['limits'].items():
        require(type(pair) is list and len(pair) == 2 and
                all(type(v) is int and v >= -1 for v in pair), 'invalid rlimit')
    # DATA/AS/RSS are inherited exactly, never copied from a Git wrapper or raised.
    inherited = limits_now()
    for n in ('DATA', 'AS', 'RSS'):
        require(p['limits'][n] == inherited[n], 'inherited ' + n + ' mismatch')
    for n, ceiling in (('CPU', 90), ('FSIZE', PNG_BYTES)):
        soft, hard = p['limits'][n]
        require(0 < soft <= hard <= ceiling, n + ' exceeds ceiling')
        for intended, current in zip((soft, hard), inherited[n]):
            require(current == -1 or intended <= current, 'cannot raise inherited ' + n)
    r = p['resources']
    exact_keys(r, ('rss', 'startup_wall', 'guest_wall', 'total_wall', 'text',
                   'png', 'selected', 'remote', 'api'))
    ceilings = dict(rss=2147483648, startup_wall=20, guest_wall=90, total_wall=120,
                    text=TEXT_BYTES, png=PNG_BYTES, selected=SELECTED_BYTES,
                    remote=REMOTE_BYTES, api=API_BYTES)
    require(all(type(r[k]) is int and 0 < r[k] <= v for k, v in ceilings.items()),
            'resource ceiling exceeded')
    require(p['limits']['FSIZE'][0] >= r['png'], 'file limit cannot hold selected PNG profile')
    require(type(p['artifacts']) is dict, 'explicit artifact pins required')
    require(Path(p['capture_dir']).is_absolute(), 'absolute capture directory required')
    check_files(p)


def check_files(p):
    require(sha(Path(p['executable']).read_bytes()) == p['executable_sha256'], 'executable changed')
    for name, digest in p['artifacts'].items():
        require(Path(name).is_absolute() and sha(Path(name).read_bytes()) == digest,
                'artifact changed: ' + name)


def group_rss(pgid):
    total = 0
    for q in Path('/proc').glob('[0-9]*'):
        try:
            fields = (q / 'stat').read_text().split(') ', 1)[1].split()
            if int(fields[2]) == pgid:
                total += int((q / 'statm').read_text().split()[1]) * os.sysconf('SC_PAGE_SIZE')
        except (OSError, ValueError, IndexError):
            pass
    return total


def kill_group(pid):
    try:
        os.killpg(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


def reap_group(proc):
    kill_group(proc.pid)
    proc.wait()
    deadline = time.monotonic() + 1
    while True:
        try:
            while os.waitpid(-proc.pid, os.WNOHANG)[0]:
                pass
        except ChildProcessError:
            pass
        try:
            os.killpg(proc.pid, 0)
        except ProcessLookupError:
            return True
        if time.monotonic() >= deadline:
            return False
        time.sleep(.01)


def supervise(profile_path, expected_sha, output_dir):
    """Single owner; startup success never authorizes a different configuration."""
    profile_path = Path(profile_path)
    original = profile_path.read_bytes()
    require(sha(original) == expected_sha, 'intended profile hash mismatch')
    p = json.loads(original)
    validate_profile(p)
    require(ctypes.CDLL(None, use_errno=True).prctl(36, 1, 0, 0, 0) == 0,
            'Linux owning subreaper required')
    # Deep snapshot cannot be changed through a caller-owned dict or ambient env.
    p = json.loads(wire(p))
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=False)
    receipt = dict(profile_sha256=expected_sha, environment=p['env'],
                   environment_sha256=sha(wire(p['env'])), executable=p['executable'],
                   executable_sha256=p['executable_sha256'], flags=p['flags'],
                   limits=p['limits'], resources=p['resources'], phases=[], guest_starts=0)
    start = time.monotonic()
    text_used = 0
    try:
        for stage in ('startup', 'guest'):
            # Revalidate BEFORE each spawn, even if startup has modified disk.
            require(profile_path.read_bytes() == original, 'profile changed before ' + stage)
            validate_profile(p)
            require(time.monotonic() - start < p['resources']['total_wall'], 'total wall exhausted')
            argv = [p['executable'], *p['flags'], *p[stage]]
            read_fd, write_fd = os.pipe()

            def child_limits():
                for n, pair in p['limits'].items():
                    resource.setrlimit(getattr(resource, 'RLIMIT_' + n), tuple(pair))
                # Pre-exec audit of actual applied limits; Popen replaces environment
                # with the explicit mapping at execve. No ambient environment is logged.
                os.write(write_fd, wire(limits_now()))
                os.close(write_fd)

            log_path = out / (stage + '.log')
            with log_path.open('wb') as log:
                phase_start = time.monotonic()
                try:
                    proc = subprocess.Popen(argv, cwd=p['cwd'], env=p['env'],
                                            stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                                            start_new_session=True, pass_fds=(write_fd,),
                                            preexec_fn=child_limits)
                except Exception:
                    os.close(read_fd)
                    raise
                finally:
                    os.close(write_fd)
                if stage == 'guest':
                    receipt['guest_starts'] += 1
                peak = 0
                reason = 'natural'
                applied = None
                try:
                    try:
                        applied = json.loads(os.read(read_fd, 8192))
                    finally:
                        os.close(read_fd)
                    require(applied == p['limits'], 'actual child limits mismatch')
                    while True:
                        peak = max(peak, group_rss(proc.pid))
                        captures = list(Path(p['capture_dir']).rglob('*.png'))
                        sizes = [x.stat().st_size for x in captures]
                        reason = ('rss' if peak > p['resources']['rss'] else
                                  'wall' if time.monotonic() - phase_start > p['resources'][stage + '_wall']
                                  or time.monotonic() - start > p['resources']['total_wall'] else
                                  'text' if text_used + log_path.stat().st_size > p['resources']['text'] else
                                  'image' if any(n > p['resources']['png'] for n in sizes)
                                  or sum(sizes) > p['resources']['remote'] else 'natural')
                        require(reason == 'natural', stage + ' ' + reason + ' guard')
                        if proc.poll() is not None:
                            break
                        time.sleep(.01)
                finally:
                    cleaned = reap_group(proc)
                    text_used += log_path.stat().st_size
                    receipt['phases'].append(dict(stage=stage, argv=argv, pid=proc.pid,
                                                  returncode=proc.returncode, peak_rss=peak,
                                                  actual_limits=applied, reason=reason,
                                                  owned_group_absent=cleaned,
                                                  environment_sha256=receipt['environment_sha256']))
                require(cleaned, 'owned group cleanup incomplete')
                require(proc.returncode == 0, stage + ' failed')
        receipt['status'] = 'PASS_OFFLINE_RECIPE'
    except Exception as exc:
        receipt['status'] = 'REJECT'
        receipt['error'] = str(exc)
        raise
    finally:
        receipt['text_bytes'] = text_used
        (out / 'receipt.json').write_bytes(wire(receipt) + b'\n')
    return receipt


# Exact protocol framing. A future provider adapter must demonstrate this
# envelope's serialized byte identity, or supply all extra fields in envelope.
# Unknown/provider-dependent/truncated framing is unsupported, not free output.
DEFAULT_ENVELOPE = dict(exitCode=0, stderr='', stdoutTruncated=False, stderrTruncated=False)


def response(record, envelope):
    require('stdout' not in envelope and envelope.get('exitCode') == 0 and
            envelope.get('stderr') == '' and envelope.get('stdoutTruncated') is False and
            envelope.get('stderrTruncated') is False, 'unsupported response envelope')
    return wire(dict(envelope, stdout=wire(record).decode('ascii') + '\n'))


def plan_images(paths, *, used, tail_reserve=0, chunk_bytes=4096, envelope=None):
    """Preflight all PNG payloads, base64, JSON, manifest and end responses.

    used includes EVERY earlier serialized API response (including failures,
    metadata, stderr, polling). tail_reserve covers all later responses. This
    function does no collection I/O; an insufficient plan exposes no chunks.
    """
    require(type(used) is int and type(tail_reserve) is int and
            0 <= used <= API_BYTES and 0 <= tail_reserve <= API_BYTES, 'invalid API accounting')
    require(type(chunk_bytes) is int and 1 <= chunk_bytes <= 8192, 'invalid chunk bound')
    require(1 <= len(paths) <= 16, 'finite selected image count required')
    envelope = copy.deepcopy(DEFAULT_ENVELOPE if envelope is None else envelope)
    require(len(wire(envelope)) <= 8192, 'response framing bound')
    images, compressed = [], []
    total = 0
    for path in paths:
        path = Path(path)
        require(path.stat().st_size <= PNG_BYTES, 'per-image cap')
        data = path.read_bytes()
        require(len(data) <= PNG_BYTES, 'per-image cap after read')
        require(data[:8] == b'\x89PNG\r\n\x1a\n', 'PNG required')
        total += len(data)
        require(total <= SELECTED_BYTES, 'selected local cap')
        packed = zlib.compress(data, 9)
        compressed.append(packed)
        images.append(dict(name=path.name, size=len(data), sha256=sha(data),
                           compressed=len(packed), chunks=(len(packed)+chunk_bytes-1)//chunk_bytes))
    require(sum(i['chunks'] for i in images)+2 <= 4096, 'response count cap before encoding')
    records = [dict(kind='manifest', images=images, chunk_bytes=chunk_bytes)]
    for i, packed in enumerate(compressed):
        for index, offset in enumerate(range(0, len(packed), chunk_bytes)):
            records.append(dict(kind='chunk', image=i, index=index,
                                data=base64.b64encode(packed[offset:offset+chunk_bytes]).decode('ascii')))
    records.append(dict(kind='end', images=len(images)))
    require(len(records) <= 4096, 'response count cap')
    frames = tuple(response(r, envelope) for r in records)
    measured = sum(map(len, frames))
    require(used + measured + tail_reserve <= API_BYTES,
            'UNSUPPORTED_PLAN: lossless payload + base64 + ALL JSON framing exceeds remaining API budget; '
            f'used={used} transfer={measured} tail={tail_reserve} cap={API_BYTES}')
    return dict(frames=frames, images=images, serialized_bytes=measured,
                used=used, tail_reserve=tail_reserve, total=used+measured+tail_reserve,
                envelope=envelope)


def restore_images(plan, frames):
    """Validate complete bounded wire stream before returning any PNG bytes.

    Plan reserves capacity; actual responses are charged once here, not again
    as base64 or decompressed images. No partial output escapes on rejection.
    """
    require(len(frames) == len(plan['frames']), 'missing/extra response')
    require(plan['used'] + sum(map(len, frames)) + plan['tail_reserve'] <= API_BYTES,
            'cumulative API budget')
    records = []
    charged = plan['used']
    for expected, raw in zip(plan['frames'], frames):
        charged += len(raw)
        require(raw == expected, 'response changed/framing/truncation mismatch')
        parsed = json.loads(raw)
        require(not parsed['stdoutTruncated'] and not parsed['stderrTruncated'], 'truncated response')
        records.append(json.loads(parsed['stdout']))
    require(records[0]['kind'] == 'manifest' and records[-1] ==
            dict(kind='end', images=len(plan['images'])), 'incomplete stream')
    cursor = 1
    restored = []
    for i, image in enumerate(plan['images']):
        packed = bytearray()
        for index in range(image['chunks']):
            r = records[cursor]
            cursor += 1
            require(r['kind'] == 'chunk' and r['image'] == i and r['index'] == index,
                    'chunk ordering/identity mismatch')
            packed.extend(base64.b64decode(r['data'], validate=True))
        require(len(packed) == image['compressed'], 'compressed size mismatch')
        d = zlib.decompressobj()
        data = d.decompress(packed, image['size'] + 1)
        require(d.eof and not d.unused_data and not d.unconsumed_tail and
                len(data) == image['size'] and sha(data) == image['sha256'], 'lossless PNG verification failed')
        restored.append(data)
    require(cursor == len(records)-1, 'extra chunks')
    return restored, charged


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    s = sub.add_parser('supervise')
    s.add_argument('profile'); s.add_argument('--sha256', required=True); s.add_argument('--output', required=True)
    t = sub.add_parser('plan')
    t.add_argument('png', nargs='+'); t.add_argument('--used', required=True, type=int)
    t.add_argument('--tail-reserve', required=True, type=int)
    a = parser.parse_args()
    try:
        if a.command == 'supervise':
            result = supervise(a.profile, a.sha256, a.output)
            print(json.dumps(dict(status=result['status'], guest_starts=result['guest_starts'])))
        else:
            p = plan_images(a.png, used=a.used, tail_reserve=a.tail_reserve)
            print(json.dumps({k: v for k, v in p.items() if k not in ('frames', 'envelope')}))
    except (ContractError, OSError, ValueError, subprocess.SubprocessError) as exc:
        print(json.dumps(dict(status='REJECT', error=str(exc))))
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
