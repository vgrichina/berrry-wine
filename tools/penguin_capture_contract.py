#!/usr/bin/env python3
"""Offline-qualified Penguin launch and lossless response contract (stdlib only).

This is a recipe, not permission to run a guest. Provider framing and actual
Node startup/mount acceptance must be qualified separately before remote use.
"""
import argparse
import base64
import copy
import contextlib
import ctypes
import datetime
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
MAX_CAPTURE_BYTES = 8 << 20
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


def validate_capture_budget(value):
    require(type(value) is int and 0 < value <= MAX_CAPTURE_BYTES,
            'invalid capture budget (integer 1..8388608 required)')
    return value


class CapturePlan(dict):
    """Serializable plan with a construction-time budget pin.

    The public mapping remains compatible with existing plan consumers. Editing
    its budget field cannot grant capacity: every consumer checks the pin.
    """
    __slots__ = ('_capture_budget',)

    def __init__(self, *, capture_budget=API_BYTES, **fields):
        require(not hasattr(self, '_capture_budget'), 'capture plan budget is already pinned')
        object.__setattr__(self, '_capture_budget', validate_capture_budget(capture_budget))
        super().__init__(fields, capture_budget=capture_budget)

    def __setattr__(self, name, value):
        raise AttributeError('capture plan budget is immutable')

    def __delattr__(self, name):
        raise AttributeError('capture plan budget is immutable')

    def __deepcopy__(self, memo):
        result = CapturePlan(capture_budget=self._capture_budget)
        memo[id(self)] = result
        result.update(copy.deepcopy(dict(self), memo))
        return result


def plan_budget(plan, expected=None):
    require(type(plan) is CapturePlan, 'pinned capture plan required')
    budget = validate_capture_budget(plan.get('capture_budget'))
    require(budget == plan._capture_budget, 'capture plan budget mismatch')
    if expected is not None:
        require(budget == validate_capture_budget(expected), 'plan/collector budget mismatch')
    return budget


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
            paths = {name: out / (stage + '.' + name) for name in ('stdout', 'stderr')}
            phase = dict(stage=stage, argv=argv, status='setup',
                         environment_sha256=receipt['environment_sha256'])
            receipt['phases'].append(phase)
            proc = None
            read_fd = write_fd = None
            peak, applied, reason = 0, None, 'setup'
            opened, stream_errors = set(), {}
            phase_start = time.monotonic()
            try:
                with contextlib.ExitStack() as files:
                    # Attempt each channel independently before rejecting setup.
                    # In particular stdout failure must not hide writable stderr.
                    handles, failures = {}, []
                    for name, path in paths.items():
                        try:
                            handles[name] = files.enter_context(path.open('wb'))
                            opened.add(name)
                        except Exception as exc:
                            stream_errors[name] = type(exc).__name__ + ': ' + str(exc)
                            failures.append(exc)
                    if failures:
                        raise failures[0]
                    stdout, stderr = handles['stdout'], handles['stderr']
                    read_fd, write_fd = os.pipe()

                    def child_limits():
                        try:
                            for n, pair in p['limits'].items():
                                resource.setrlimit(getattr(resource, 'RLIMIT_' + n), tuple(pair))
                            # Audit only limits, never the inherited environment.
                            os.write(write_fd, wire(limits_now()))
                            os.close(write_fd)
                        except Exception as exc:
                            os.write(2, ('child setup: ' + str(exc) + '\n').encode()[:8192])
                            raise

                    reason = 'spawn'
                    proc = subprocess.Popen(argv, cwd=p['cwd'], env=p['env'],
                                            stdin=subprocess.DEVNULL, stdout=stdout, stderr=stderr,
                                            start_new_session=True, pass_fds=(write_fd,),
                                            preexec_fn=child_limits)
                    os.close(write_fd)
                    write_fd = None
                    phase.update(pid=proc.pid, status='running')
                    if stage == 'guest':
                        receipt['guest_starts'] += 1
                    reason = 'natural'
                    try:
                        applied = json.loads(os.read(read_fd, 8192))
                    finally:
                        os.close(read_fd)
                        read_fd = None
                    require(applied == p['limits'], 'actual child limits mismatch')
                    while True:
                        peak = max(peak, group_rss(proc.pid))
                        captures = list(Path(p['capture_dir']).rglob('*.png'))
                        sizes = [x.stat().st_size for x in captures]
                        reason = ('rss' if peak > p['resources']['rss'] else
                                  'wall' if time.monotonic() - phase_start > p['resources'][stage + '_wall']
                                  or time.monotonic() - start > p['resources']['total_wall'] else
                                  'text' if text_used + sum(x.stat().st_size for x in paths.values())
                                  > p['resources']['text'] else
                                  'image' if any(n > p['resources']['png'] for n in sizes)
                                  or sum(sizes) > p['resources']['remote'] else 'natural')
                        require(reason == 'natural', stage + ' ' + reason + ' guard')
                        if proc.poll() is not None:
                            break
                        time.sleep(.01)
            except Exception as exc:
                phase.update(status='failed', error=str(exc))
                if proc is None:
                    # Prefer stderr, but retain stdout if it is the only usable
                    # channel. No diagnostic write may duplicate the budget.
                    used = text_used + sum(paths[n].stat().st_size for n in opened)
                    diagnostic = (type(exc).__name__ + ': ' + str(exc) + '\n').encode()
                    for name in ('stderr', 'stdout'):
                        if name not in opened:
                            continue
                        try:
                            with paths[name].open('ab') as stream:
                                stream.write(diagnostic[:min(8192, max(0, p['resources']['text'] - used))])
                            phase['diagnostic_stream'] = name
                            break
                        except Exception as diagnostic_error:
                            phase.setdefault('diagnostic_errors', {})[name] = (
                                type(diagnostic_error).__name__ + ': ' + str(diagnostic_error))
                raise
            finally:
                for fd in (read_fd, write_fd):
                    if fd is not None:
                        os.close(fd)
                if proc is not None:
                    cleaned = reap_group(proc)
                    phase.update(returncode=proc.returncode, peak_rss=peak,
                                 actual_limits=applied, owned_group_absent=cleaned)
                phase['streams'] = {
                    name: (dict(path=str(path), bytes=path.stat().st_size,
                                sha256=sha(path.read_bytes())) if name in opened else
                           dict(path=str(path), bytes=0, sha256=None, status='unavailable',
                                error=stream_errors[name]))
                    for name, path in paths.items()}
                text_used += sum(x['bytes'] for x in phase['streams'].values())
                phase['reason'] = reason
                # Include final descendant writes and failed-spawn diagnostics,
                # charging each stream once even when an earlier check failed.
                if text_used > p['resources']['text']:
                    phase.update(status='failed', reason='text', error=stage + ' text guard')
                    raise ContractError(phase['error'])
            if proc is not None:
                if not cleaned or proc.returncode != 0:
                    phase.update(status='failed', error=('owned group cleanup incomplete'
                                 if not cleaned else stage + ' failed'))
                    raise ContractError(phase['error'])
                phase['status'] = 'passed'
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


def plan_images(paths, *, used, tail_reserve=0, chunk_bytes=4096, envelope=None,
                capture_budget=API_BYTES):
    """Preflight all PNG payloads, base64, JSON, manifest and end responses.

    used includes EVERY earlier serialized API response (including failures,
    metadata, stderr, polling). tail_reserve covers all later responses. This
    function does no collection I/O; an insufficient plan exposes no chunks.
    capture_budget is chosen for a fresh task before collecting any responses;
    selecting it never clears used or changes another plan/collector's budget.
    """
    capture_budget = validate_capture_budget(capture_budget)
    require(type(used) is int and type(tail_reserve) is int and
            0 <= used <= capture_budget and 0 <= tail_reserve <= capture_budget, 'invalid API accounting')
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
    require(used + measured + tail_reserve <= capture_budget,
            'UNSUPPORTED_PLAN: lossless payload + base64 + ALL JSON framing exceeds remaining API budget; '
            f'used={used} transfer={measured} tail={tail_reserve} cap={capture_budget}')
    return CapturePlan(capture_budget=capture_budget, frames=frames, images=images, serialized_bytes=measured,
                used=used, tail_reserve=tail_reserve, total=used+measured+tail_reserve,
                envelope=envelope)


def restore_images(plan, frames, *, capture_budget=None):
    """Validate complete bounded wire stream before returning any PNG bytes.

    Plan reserves capacity; actual responses are charged once here, not again
    as base64 or decompressed images. No partial output escapes on rejection.
    """
    budget = plan_budget(plan, capture_budget)
    require(len(frames) == len(plan['frames']), 'missing/extra response')
    require(plan['used'] + sum(map(len, frames)) + plan['tail_reserve'] <= budget,
            'cumulative API budget')
    records = []
    charged = plan['used']
    for expected, raw in zip(plan['frames'], frames):
        charged += len(raw)
        require(raw == expected, 'response changed/framing/truncation mismatch')
        parsed = json.loads(raw)
        require(not parsed['stdoutTruncated'] and not parsed['stderrTruncated'], 'truncated response')
        records.append(json.loads(parsed['stdout']))
    return restore_records(plan, records), charged


def restore_records(plan, records):
    """Shared bounded lossless decoder, independent of response framing."""
    plan_budget(plan)
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
    return restored


# Boat's serialized exec response is variable, unlike DEFAULT_ENVELOPE. These
# are the supported full response fields, not an invitation to ignore metadata.
PROVIDER_FIELDS = frozenset(('commandId', 'cwd', 'exitCode', 'finishedAt',
    'launcherFailed', 'noticedMs', 'oomKilled', 'signal', 'startMs', 'startedAt',
    'stderr', 'stderrTruncated', 'stdout', 'stdoutTruncated', 'success', 'timedOut'))


def strict_json(raw):
    def pairs(items):
        result = {}
        for key, value in items:
            require(key not in result, 'duplicate JSON field')
            result[key] = value
        return result
    def constant(value):
        raise ContractError('nonfinite JSON value')
    try:
        if type(raw) is bytes:
            raw = raw.decode('utf-8')
        return json.loads(raw, object_pairs_hook=pairs, parse_constant=constant)
    except (ValueError, UnicodeError, RecursionError) as exc:
        raise ContractError('malformed JSON: ' + str(exc)[:160]) from exc


def provider_stdout(raw, overhead_limit):
    """Validate a successful, complete Boat exec envelope; return record text.

    overhead includes ALL bytes beyond the canonical JSON string for stdout:
    provider metadata, field names, whitespace, and alternate escaping. Only
    capacity estimation uses that canonical string; charging always uses raw.
    """
    p = strict_json(raw)
    exact_keys(p, PROVIDER_FIELDS)
    for key, ceiling in (('commandId', 128), ('cwd', 1024)):
        require(type(p[key]) is str and 0 < len(p[key]) <= ceiling and
                all(ord(ch) >= 32 and ord(ch) != 127 for ch in p[key]),
                'invalid provider ' + key)
    times = []
    for key in ('startedAt', 'finishedAt'):
        value = p[key]
        require(type(value) is str and len(value) == 24 and value.endswith('Z'),
                'invalid provider timestamp')
        try:
            stamp = datetime.datetime.strptime(value, '%Y-%m-%dT%H:%M:%S.%fZ')
        except ValueError as exc:
            raise ContractError('invalid provider timestamp') from exc
        times.append(stamp)
    require(times[1] >= times[0], 'reversed provider timestamps')
    for key in ('startMs', 'noticedMs'):
        require(type(p[key]) is int and 0 <= p[key] <= (1 << 53)-1,
                'invalid provider timing')
    require(type(p['exitCode']) is int and p['exitCode'] == 0 and p['signal'] is None,
            'provider command failed')
    for key in ('launcherFailed', 'oomKilled', 'stderrTruncated',
                'stdoutTruncated', 'timedOut', 'success'):
        require(type(p[key]) is bool and p[key] == (key == 'success'),
                'provider failure/truncation: ' + key)
    require(type(p['stdout']) is str and p['stderr'] == '' and type(p['stderr']) is str,
            'invalid provider streams')
    require(len(raw)-len(wire(p['stdout'])) <= overhead_limit, 'provider framing reserve overflow')
    return p['stdout']


def plan_provider_images(paths, *, used, tail_reserve=0, chunk_bytes=8192,
                         envelope_overhead=1024, capture_budget=API_BYTES):
    """Conservative full-envelope plan; legacy deterministic API stays exact.

    used is the byte total of every earlier raw API response. tail_reserve
    reserves all additional non-capture responses, consumed by account().
    Every capture reserves its canonical stdout JSON string plus a bounded
    variable envelope. A larger legal envelope needs a new admitted plan.
    """
    require(type(envelope_overhead) is int and 1 <= envelope_overhead <= 8192,
            'invalid provider framing bound')
    canonical = plan_images(paths, used=used, tail_reserve=tail_reserve,
                            chunk_bytes=chunk_bytes, capture_budget=capture_budget)
    names = [i['name'] for i in canonical['images']]
    require(len(set(names)) == len(names), 'duplicate PNG name')
    records = [strict_json(strict_json(f)['stdout']) for f in canonical['frames']]
    bounds = [len(wire(strict_json(f)['stdout'])) + envelope_overhead
              for f in canonical['frames']]
    total = used + sum(bounds) + tail_reserve
    require(total <= capture_budget, 'UNSUPPORTED_PLAN: provider framing + used + tail exceeds API budget; '
            f'required={total} cap={capture_budget}')
    return CapturePlan(capture_budget=capture_budget, canonical=canonical, records=records, frame_limits=bounds,
                envelope_overhead=envelope_overhead, used=used,
                tail_reserve=tail_reserve, serialized_bytes_limit=sum(bounds), total=total)


class ProviderCapture:
    """One chronological raw-response ledger; rejection poisons this collector.

    accept() consumes a capture response. account() consumes every other API
    response, including failed requests, polls and metadata, without treating
    their stdout as image data. Never pass a response to both methods. No PNG
    bytes are exposed until finish() validates the entire lossless stream.
    """
    def __init__(self, plan, *, capture_budget=None):
        budget = plan_budget(plan, capture_budget)
        plan_budget(plan['canonical'], budget)
        self.plan = copy.deepcopy(plan)
        self.__capture_budget = budget
        self.charged = plan['used']
        self.tail = plan['tail_reserve']
        self.cursor = 0
        self.records = []
        self.failed = False
        self.finished = False

    @property
    def capture_budget(self):
        return self.__capture_budget

    def _check_budget(self):
        plan_budget(self.plan, self.capture_budget)
        plan_budget(self.plan['canonical'], self.capture_budget)

    def _consume(self, raw, capture):
        require(not self.failed and not self.finished, 'collector is closed')
        try:
            require(type(raw) is bytes, 'original serialized response bytes required')
            # Charge before ANY parsing, including rejected/error responses.
            self.charged += len(raw)
            self._check_budget()
            require(self.charged <= self.capture_budget, 'cumulative API budget')
            p = self.plan
            if capture:
                require(self.cursor < len(p['records']), 'extra capture response')
                require(len(raw) <= p['frame_limits'][self.cursor], 'provider framing reserve overflow')
                record = strict_json(provider_stdout(raw, p['envelope_overhead']))
                require(wire(record) == wire(p['records'][self.cursor]),
                        'manifest/chunk/end identity or order mismatch')
                self.records.append(record)
                self.cursor += 1
            else:
                # Actual non-capture bytes spend, rather than duplicate, the
                # reserved tail. Any excess must fit unused capture capacity.
                self.tail = max(0, self.tail-len(raw))
            require(self.charged + sum(p['frame_limits'][self.cursor:]) + self.tail <= self.capture_budget,
                    'remaining capture/tail reserve exceeds API budget')
        except (ContractError, ValueError, TypeError, OverflowError, RecursionError) as exc:
            self.failed = True
            raise ContractError(str(exc)) from exc

    def account(self, raw):
        self._consume(raw, False)

    def accept(self, raw):
        self._consume(raw, True)

    def finish(self):
        require(not self.failed and not self.finished, 'collector is closed')
        try:
            self._check_budget()
            require(self.cursor == len(self.plan['records']), 'incomplete capture stream')
            # Decode the actual accepted records with the existing bounded
            # base64/zlib EOF/size/hash checks. The raw ledger is independent.
            images = restore_records(self.plan['canonical'], self.records)
        except (ContractError, ValueError, zlib.error) as exc:
            self.failed = True
            raise ContractError(str(exc)) from exc
        self.finished = True
        return images, self.charged


def restore_provider_transcript(paths, transcript_path, output, *, used,
                                tail_reserve=0, envelope_overhead=1024,
                                capture_budget=API_BYTES):
    """Production offline CLI boundary: raw files, explicit ordered disposition.

    Transcript is [{"kind":"capture"|"account", "path":"raw-response.json"}].
    Paths are relative to the transcript. Output directory must be new. All
    validation precedes atomic directory publication; rejection publishes none.
    """
    import shutil
    import tempfile
    capture_budget = validate_capture_budget(capture_budget)
    transcript_path = Path(transcript_path)
    require(transcript_path.stat().st_size <= API_BYTES, 'transcript size cap')
    transcript = strict_json(transcript_path.read_bytes())
    require(type(transcript) is list and len(transcript) <= 4096, 'transcript count cap')
    plan = plan_provider_images(paths, used=used, tail_reserve=tail_reserve,
                                envelope_overhead=envelope_overhead, capture_budget=capture_budget)
    capture = ProviderCapture(plan, capture_budget=capture_budget)
    for entry in transcript:
        exact_keys(entry, ('kind', 'path'))
        require(entry['kind'] in ('capture', 'account') and type(entry['path']) is str,
                'invalid transcript entry')
        source = transcript_path.parent / entry['path']
        require(source.stat().st_size <= capture_budget, 'response file exceeds API cap')
        raw = source.read_bytes()
        if entry['kind'] == 'capture':
            capture.accept(raw)
        else:
            capture.account(raw)
    images, charged = capture.finish()
    out = Path(output)
    require(not out.exists(), 'output must be new')
    stage = Path(tempfile.mkdtemp(prefix='.'+out.name+'-', dir=out.parent))
    try:
        for image, data in zip(plan['canonical']['images'], images):
            (stage / image['name']).write_bytes(data)
        stage.rename(out)
    finally:
        if stage.exists():
            shutil.rmtree(stage)
    return dict(status='PASS_LOSSLESS_OFFLINE_TRANSPORT', charged=charged, capture_budget=capture_budget,
                tail_remaining=capture.tail, images=plan['canonical']['images'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    s = sub.add_parser('supervise')
    s.add_argument('profile'); s.add_argument('--sha256', required=True); s.add_argument('--output', required=True)
    t = sub.add_parser('plan')
    t.add_argument('png', nargs='+'); t.add_argument('--used', required=True, type=int)
    t.add_argument('--tail-reserve', required=True, type=int)
    t.add_argument('--capture-budget', type=int, default=API_BYTES)
    p = sub.add_parser('restore-provider')
    p.add_argument('png', nargs='+')
    p.add_argument('--transcript', required=True)
    p.add_argument('--output', required=True)
    p.add_argument('--used', required=True, type=int)
    p.add_argument('--tail-reserve', required=True, type=int)
    p.add_argument('--envelope-overhead', type=int, default=1024)
    p.add_argument('--capture-budget', type=int, default=API_BYTES)
    a = parser.parse_args()
    try:
        if a.command == 'supervise':
            result = supervise(a.profile, a.sha256, a.output)
            print(json.dumps(dict(status=result['status'], guest_starts=result['guest_starts'])))
        elif a.command == 'restore-provider':
            print(json.dumps(restore_provider_transcript(a.png, a.transcript, a.output,
                used=a.used, tail_reserve=a.tail_reserve, envelope_overhead=a.envelope_overhead,
                capture_budget=a.capture_budget)))
        else:
            p = plan_images(a.png, used=a.used, tail_reserve=a.tail_reserve,
                            capture_budget=a.capture_budget)
            print(json.dumps({k: v for k, v in p.items() if k not in ('frames', 'envelope')}))
    except (ContractError, OSError, ValueError, subprocess.SubprocessError) as exc:
        print(json.dumps(dict(status='REJECT', error=str(exc))))
        return 2
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
