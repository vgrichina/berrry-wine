#!/usr/bin/env python3
"""KKnD lifecycle custody, outside the finite allocation request.

  python3 tools/kknd-lifecycle.py run RUN_DIR CONFIG.json
  python3 tools/kknd-lifecycle.py status RUN_DIR

Submit from the top-level observer, NEVER from an allocation job. `run` is
only an observer: losing it does not cancel custody. CONFIG contains an absolute
deadlineEpoch (fixed before allocation), allocationSeconds, stopSeconds,
allocationArgv and stopArgv. Commands receive KKND_LIFECYCLE_DIR. Allocation
publishes boat-created.json; normal shutdown requires normal-stop-request.json
and retrieval-verified.json {"passed": true}. The stop adapter must perform
normal stop, independently verify the API receipt/status and publish
normal-stop-confirmed.json {"confirmed": true, "forced": false} before exit 0.
No retry is permitted after a stop attempt, even after an ambiguous failure.

The long-lived durable job owns normal and watchdog siblings before it starts
finite allocation custody. Its command stays live until both have actually
exited. The independent watchdog uses the original deadline, even if allocation
or the normal process fails. Each actual child wait and pipe EOF is distinct.
The generic durable launcher's successful-parent descendant cleanup is intact.
"""
import concurrent.futures
import fcntl
import importlib.util
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time

SCRIPT = Path(__file__).resolve()
spec = importlib.util.spec_from_file_location('kknd_durable', SCRIPT.parent/'toyvm/durable-launcher.py')
durable = importlib.util.module_from_spec(spec)
spec.loader.exec_module(durable)
TICK = .1


def emit(root, name, **value):
    durable.publish(root/(name+'.json'), {**value, 'at': time.time()})


def heartbeat(root, role, deadline):
    with (root/(role+'-heartbeat.jsonl')).open('a') as stream:
        stream.write(json.dumps(dict(at=time.time(), pid=os.getpid(), deadlineEpoch=deadline))+'\n')
        stream.flush()
        os.fsync(stream.fileno())


def monitored(root, label, argv, timeout=None):
    child = subprocess.Popen(argv, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                             stderr=subprocess.PIPE, start_new_session=True)
    emit(root, label+'-process', pid=child.pid, actualParent=os.getpid(), argv=argv)
    finish = durable.drains(root, label, child)
    timed_out = False
    try:
        code = child.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        child.kill()
        code = child.wait()
    durable.waited(root, label, child.pid, code, timedOut=timed_out)
    finish()
    return code


def confirmed(root):
    path = root/'normal-stop-confirmed.json'
    if not path.exists():
        return False
    receipt = durable.read(path)
    return receipt.get('confirmed') is True and receipt.get('forced') is False


def stop(root, config, role):
    # Both children can reach the deadline together. The durable attempt is the
    # once-only boundary; a lock alone would allow replay after process death.
    with (root/'stop.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return None
        if (root/'stop-attempt.json').exists():
            return None
        emit(root, 'stop-attempt', role=role, forced=False, replayAllowed=False)
        # A finite durable stop job also cleans adapter descendants on success
        # or timeout; normal/watchdog themselves are outside this finite job.
        job = root/'stop-custody'
        durable.submit(job, config['stopArgv'], config['stopSeconds'])
        while not (job/'outcome.json').exists():
            heartbeat(root, role, config['deadlineEpoch'])
            time.sleep(TICK)
        result = durable.observe(job)
        passed = result['returnCode'] == 0 and result['custodyComplete'] and confirmed(root)
        emit(root, 'stop-result', passed=passed, outcome=result)
        return 0 if passed else 1


def participant(root, config, role):
    deadline = config['deadlineEpoch']
    emit(root, role+'-armed', pid=os.getpid(), actualParent=os.getppid(), deadlineEpoch=deadline)
    result = 1
    try:
        while True:
            heartbeat(root, role, deadline)
            if confirmed(root):
                result = 0
                break
            if (root/'stop-result.json').exists():
                result = 0 if durable.read(root/'stop-result.json')['passed'] else 1
                break
            allocated = (root/'boat-created.json').exists()
            allocation_done = (root/'allocation-result.json').exists()
            if allocation_done and not allocated:
                result = 1
                break
            failed = allocation_done and durable.read(root/'allocation-result.json')['returnCode'] != 0
            requested = (root/'normal-stop-request.json').exists()
            verified = (root/'retrieval-verified.json').exists() and durable.read(root/'retrieval-verified.json').get('passed') is True
            due = time.time() >= deadline
            if allocated and ((role == 'watchdog' and due) or
                              (role == 'normal' and (failed or (requested and verified)))):
                code = stop(root, config, role)
                if code is not None:
                    result = code
                    break
            if due and not allocated and allocation_done:
                # Finite allocation custody remains responsible for its own
                # descendants. Never manufacture a stop receipt without an ID.
                result = 1
                break
            if time.time() > deadline + config['stopSeconds'] + 5:
                break  # ambiguous stop attempt: retain evidence, never replay
            time.sleep(TICK)
    finally:
        emit(root, role+'-terminal', returnCode=result, pid=os.getpid())
    return result


def custodian(root, config):
    os.environ['KKND_LIFECYCLE_DIR'] = str(root)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        jobs = {role: pool.submit(monitored, root, role,
                [sys.executable, str(SCRIPT), '_'+role, str(root)])
                for role in ('watchdog', 'normal')}
        ready_until = time.monotonic()+10
        while not all((root/(role+'-heartbeat.jsonl')).exists() for role in jobs):
            if time.monotonic() >= ready_until or any(job.done() for job in jobs.values()):
                raise RuntimeError('lifecycle prearm failed; allocation forbidden')
            time.sleep(.01)
        emit(root, 'prearmed', deadlineEpoch=config['deadlineEpoch'])
        remaining = config['deadlineEpoch']-time.time()
        if remaining <= 0:
            raise RuntimeError('deadline elapsed before allocation')
        # This is deliberately the unchanged finite durable wrapper. Its child
        # cleanup cannot reach the sibling watchdog or this live custodian.
        allocation = root/'allocation-custody'
        durable.submit(allocation, config['allocationArgv'], min(config['allocationSeconds'], remaining))
        while not (allocation/'outcome.json').exists():
            heartbeat(root, 'custodian', config['deadlineEpoch'])
            time.sleep(TICK)
        result = durable.observe(allocation)
        emit(root, 'allocation-result', **result)
        while not all(job.done() for job in jobs.values()):
            heartbeat(root, 'custodian', config['deadlineEpoch'])
            time.sleep(TICK)
        codes = {role: job.result() for role, job in jobs.items()}
    passed = result['returnCode'] == 0 and result['custodyComplete'] and all(code == 0 for code in codes.values())
    emit(root, 'custodian-terminal', passed=passed, participantReturnCodes=codes)
    return 0 if passed else 1


def submit(root, config):
    for key in ('deadlineEpoch', 'allocationSeconds', 'stopSeconds'):
        if not isinstance(config[key], (int, float)) or not math.isfinite(config[key]) or config[key] <= 0:
            raise ValueError('finite positive '+key+' required')
    for key in ('allocationArgv', 'stopArgv'):
        if not isinstance(config[key], list) or not config[key] or not all(isinstance(arg, str) for arg in config[key]):
            raise ValueError('nonempty argv required: '+key)
    root = Path(root).resolve()
    root.mkdir(exist_ok=True)
    config_path = root/'config.json'
    if config_path.exists():
        if durable.read(config_path) != config:
            raise ValueError('immutable lifecycle identity conflict')
    else:
        if config['deadlineEpoch'] <= time.time():
            raise ValueError('deadline must precede allocation and still be in future')
        durable.publish(config_path, config)
    # Stable bound on duplicate observations; never recompute from current time.
    request = root/'lifecycle-bound.json'
    if not request.exists():
        emit(root, 'lifecycle-bound', seconds=max(.1, config['deadlineEpoch']-time.time())+config['stopSeconds']+20)
    durable.submit(root/'lifecycle-custody', [sys.executable, str(SCRIPT), '_custodian', str(root)],
                   durable.read(request)['seconds'])


def main():
    role, directory = sys.argv[1:3]
    root = Path(directory).resolve()
    if role == 'run':
        submit(root, durable.read(sys.argv[3]))
        while not (root/'lifecycle-custody/outcome.json').exists():
            time.sleep(TICK)
        result = durable.observe(root/'lifecycle-custody')
        print(json.dumps(result), flush=True)
        return result['returnCode']
    if role == 'status':
        print(json.dumps(durable.observe(root/'lifecycle-custody')))
        return 0
    config = durable.read(root/'config.json')
    if role == '_custodian':
        return custodian(root, config)
    if role in ('_normal', '_watchdog'):
        return participant(root, config, role[1:])
    raise ValueError(role)


if __name__ == '__main__':
    sys.exit(main())
