"""Observe sealed images and revoke their native owner on wrapper failure."""
from pathlib import Path
import gzip
import hashlib
import json
import time


def remote_wrapper(root, prepared, phase, operation='observe', review=None):
    """The actual Boat payload. Resolve every helper before leaving the caller.

    Keep the exception boundary outside runpy: a missing observer must revoke
    the owner too. Cancellation uses the existing run-scoped native reaper,
    never Browser.close, guest input, a retry, or another runtime budget.
    """
    assert operation in ('observe', 'publish_review')
    root, prepared = Path(root).resolve(), Path(prepared).resolve()
    plan = layout(root, prepared, phase)
    helper = str(root/'tools/q3-phase-observer.py')
    owner = str(root/'tools/q3-native-launch-client.py')
    return ("import runpy,time,json,gzip,os\nfrom pathlib import Path\nowner=None\n"
            "try:\n"
            " owner=runpy.run_path("+repr(owner)+")\n"
            " m=runpy.run_path("+repr(helper)+")\n"
            " v=m["+repr(operation)+"]("+repr(str(root))+","+repr(str(prepared))+","+repr(phase)+","+
            ("time.monotonic()+55" if operation == 'observe' else repr(review))+")\n"
            " if "+repr(operation == 'observe')+":\n"
            "  p=Path(v['image']);q=p.with_name(p.name+'.review.gz');q.write_bytes(gzip.compress(p.read_bytes(),mtime=0));v['download']=str(q)\n"
            " print(json.dumps(v),flush=True)\n"
            "except BaseException:\n"
            " if owner is not None:owner['cancel_remote']("+repr(str(plan['prepared']))+","+repr(str(plan['output']))+")\n"
            " else:\n"
            "  try:\n"
            "   with Path("+repr(str(plan['prepared']/'caller-cancelled.json'))+").open('x') as f:\n"
            "    json.dump(dict(at=time.time(),reason='observer cancellation helper unavailable',noReplay=True,remoteCustody='UNKNOWN'),f);f.flush();os.fsync(f.fileno())\n"
            "  except FileExistsError:pass\n"
            " raise\n")


def layout(root, prepared, phase):
    root, prepared = Path(root).resolve(), Path(prepared).resolve()
    raw = gzip.decompress((prepared/'runtime-pins.json.gz').read_bytes())
    seal = json.loads((prepared/'replacement-pinset-seal.json').read_bytes())
    assert hashlib.sha256(raw).hexdigest() == seal['manifestSHA256'], 'sealed manifest'
    pins = json.loads(raw)
    assert pins['phaseLayout'] == seal['phaseLayout'], 'sealed phase layout'
    plan = pins['phaseLayout'][phase]
    result = {key: (root/value).resolve() for key, value in plan.items()}
    assert all(p.is_relative_to(prepared.parent) for p in result.values()), 'owned phase paths'
    assert result['boundary'].parent == result['prepared'], 'boundary parent'
    return result


def check_terminal(plan):
    for base, names in ((plan['prepared'], ('caller-cancelled.json',)),
                        (plan['output'], ('first-browser-failure.json', 'first-transport-failure.json', 'first-failure.json'))):
        for name in names:
            assert not (base/name).exists(), 'terminal: '+name


def observe(root, prepared, phase, deadline, check=lambda: None):
    plan = layout(root, prepared, phase)
    while True:
        check()
        check_terminal(plan)
        assert time.monotonic() < deadline, 'review observation deadline'
        ready = plan['prepared']/'input-service-review-ready.json'
        if ready.exists():
            value = json.loads(ready.read_bytes())
            assert value['label'] == 'fixture-startup', 'expected fixture capture'
            image = plan['output']/(value['label']+'.png')
            capture = plan['output']/(value['label']+'-capture.json')
            assert Path(value['image']) == image and Path(value['captureFile']) == capture, 'current consumer paths'
            assert json.loads(capture.read_bytes()) == value['capture'], 'capture publication identity'
            data = image.read_bytes()
            assert hashlib.sha256(data).hexdigest() == value['capture']['sha256'], 'returned image SHA'
            check()
            check_terminal(plan)
            return dict(ready=value, image=str(image), size=len(data), sha256=hashlib.sha256(data).hexdigest())
        time.sleep(.02)


def publish_review(root, prepared, phase, review):
    # Reread exact capture/image and sticky terminal immediately before publication.
    observed = observe(root, prepared, phase, time.monotonic()+1)
    capture = observed['ready']['capture']
    assert review['sha256'] == capture['sha256'] and review['identity'] == capture['identity'], 'exact reviewed image identity'
    assert review['clear'] is True and review['review'].strip(), 'separate clear model review'
    plan = layout(root, prepared, phase)
    check_terminal(plan)
    with (plan['prepared']/'input-service-model-review.json').open('x') as stream:
        json.dump(review, stream)
    return observed
